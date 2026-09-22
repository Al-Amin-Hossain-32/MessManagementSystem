import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { auditService } from '../../lib/audit.service';
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  SelfApprovalError,
  ImmutableRecordError,
} from '../../lib/errors';
import { ManagerAssignmentStatus, FundHandoverStatus, AuditAction } from '@messmess/types';
import type { InitiateHandoverDto, ResolveDisputeDto } from './handover.schema';

/** Assignment states from which an outgoing Manager may declare a handover. */
const OUTGOING_ELIGIBLE_STATUSES: ManagerAssignmentStatus[] = [
  ManagerAssignmentStatus.ACTIVE,
  ManagerAssignmentStatus.TERMINATED_EARLY,
  ManagerAssignmentStatus.COMPLETED,
];

class HandoverService {
  /**
   * Sums declaredAmount using Prisma.Decimal (not native JS number arithmetic)
   * to avoid floating-point rounding drift on financial values — see the
   * codebase-wide note: `roundCurrency()` in packages/utils still operates on
   * `number` and should be migrated to Decimal.js when the Accounting Engine
   * (Phase 6) is built. This service establishes the correct pattern.
   */
  private sumDeclaredItems(items: InitiateHandoverDto['declaredItems']): Prisma.Decimal {
    return items.reduce(
      (sum, item) => sum.add(new Prisma.Decimal(item.declaredAmount)),
      new Prisma.Decimal(0),
    );
  }

  /** Finds the caller's own outgoing assignment for this Mess, if any. */
  private async findOutgoingAssignment(messId: string, userId: string) {
    return prisma.managerAssignment.findFirst({
      where: { messId, userId, status: { in: OUTGOING_ELIGIBLE_STATUSES } },
      orderBy: { assignedAt: 'desc' },
    });
  }

  /** Outgoing Manager declares fund items — creates the handover as DRAFT. */
  async initiateHandover(messId: string, outgoingUserId: string, dto: InitiateHandoverDto) {
    const outgoingAssignment = await this.findOutgoingAssignment(messId, outgoingUserId);
    if (!outgoingAssignment) {
      throw new ForbiddenError(
        'You do not have an active or recently-ended Manager assignment for this Mess',
      );
    }

    const existing = await prisma.fundHandover.findFirst({
      where: { outgoingAssignmentId: outgoingAssignment.id },
    });
    if (existing) {
      throw new ConflictError(
        'A handover already exists for this assignment. Use submit/dispute instead of creating a new one.',
      );
    }

    const totalDeclaredAmount = this.sumDeclaredItems(dto.declaredItems);

    const handover = await prisma.fundHandover.create({
      data: {
        messId,
        outgoingAssignmentId: outgoingAssignment.id,
        incomingAssignmentId: dto.incomingAssignmentId ?? null,
        declaredItems: dto.declaredItems as unknown as Prisma.InputJsonValue,
        totalDeclaredAmount,
        status: FundHandoverStatus.DRAFT,
      },
    });

    return handover;
  }

  /** Outgoing Manager locks in the declaration — DRAFT -> SUBMITTED. */
  async submitHandover(
    messId: string,
    outgoingUserId: string,
    handoverId: string,
    incomingAssignmentId: string,
  ) {
    const handover = await prisma.fundHandover.findUnique({
      where: { id: handoverId },
      include: { outgoingAssignment: true },
    });
    if (!handover || handover.messId !== messId) throw new NotFoundError('FundHandover');
    if (handover.outgoingAssignment.userId !== outgoingUserId) {
      throw new ForbiddenError('Only the outgoing Manager can submit this handover');
    }
    if (handover.status !== FundHandoverStatus.DRAFT) {
      throw new ConflictError('Only a DRAFT handover can be submitted');
    }

    const incomingAssignment = await prisma.managerAssignment.findUnique({
      where: { id: incomingAssignmentId },
    });
    if (!incomingAssignment || incomingAssignment.messId !== messId) {
      throw new NotFoundError('Incoming Manager assignment');
    }
    if (incomingAssignment.userId === outgoingUserId) {
      throw new SelfApprovalError('fund handover submission to yourself');
    }

    const updated = await prisma.fundHandover.update({
      where: { id: handoverId },
      data: {
        incomingAssignmentId,
        status: FundHandoverStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    await auditService.log({
      messId,
      actorUserId: outgoingUserId,
      action: AuditAction.HANDOVER_SUBMITTED,
      targetType: 'FundHandover',
      targetId: updated.id,
      newState: { totalDeclaredAmount: updated.totalDeclaredAmount.toString() },
    });

    return updated;
  }

  /**
   * Incoming Manager accepts the declared handover — SUBMITTED -> ACCEPTED.
   * Self-approval blocked: the incoming Manager cannot be the same person as
   * the outgoing Manager (SRS §12/§28 self-approval prevention principle).
   */
  async acceptHandover(messId: string, incomingUserId: string, handoverId: string) {
    const handover = await prisma.fundHandover.findUnique({
      where: { id: handoverId },
      include: { outgoingAssignment: true },
    });
    if (!handover || handover.messId !== messId) throw new NotFoundError('FundHandover');
    if (!handover.incomingAssignmentId) {
      throw new ConflictError('This handover has not been submitted to an incoming Manager yet');
    }

    const incomingAssignment = await prisma.managerAssignment.findUnique({
      where: { id: handover.incomingAssignmentId },
    });
    if (!incomingAssignment || incomingAssignment.userId !== incomingUserId) {
      throw new ForbiddenError('Only the incoming Manager can accept this handover');
    }
    if (handover.outgoingAssignment.userId === incomingUserId) {
      throw new SelfApprovalError('accepting your own fund handover');
    }
    if (handover.status !== FundHandoverStatus.SUBMITTED) {
      throw new ConflictError('Only a SUBMITTED handover can be accepted');
    }

    const updated = await prisma.fundHandover.update({
      where: { id: handoverId },
      data: {
        status: FundHandoverStatus.ACCEPTED,
        acceptedAmount: handover.totalDeclaredAmount,
        acceptedAt: new Date(),
      },
    });

    await auditService.log({
      messId,
      actorUserId: incomingUserId,
      action: AuditAction.HANDOVER_ACCEPTED,
      targetType: 'FundHandover',
      targetId: updated.id,
    });

    return updated;
  }

  /** Incoming Manager disputes the declared amount — SUBMITTED -> DISPUTED. */
  async disputeHandover(
    messId: string,
    incomingUserId: string,
    handoverId: string,
    disputeNotes: string,
  ) {
    const handover = await prisma.fundHandover.findUnique({ where: { id: handoverId } });
    if (!handover || handover.messId !== messId) throw new NotFoundError('FundHandover');
    if (!handover.incomingAssignmentId) {
      throw new ConflictError('This handover has not been submitted to an incoming Manager yet');
    }

    const incomingAssignment = await prisma.managerAssignment.findUnique({
      where: { id: handover.incomingAssignmentId },
    });
    if (!incomingAssignment || incomingAssignment.userId !== incomingUserId) {
      throw new ForbiddenError('Only the incoming Manager can dispute this handover');
    }
    if (handover.status !== FundHandoverStatus.SUBMITTED) {
      throw new ConflictError('Only a SUBMITTED handover can be disputed');
    }

    const updated = await prisma.fundHandover.update({
      where: { id: handoverId },
      data: { status: FundHandoverStatus.DISPUTED, disputeNotes },
    });

    await auditService.log({
      messId,
      actorUserId: incomingUserId,
      action: AuditAction.HANDOVER_DISPUTED,
      targetType: 'FundHandover',
      targetId: updated.id,
      notes: disputeNotes,
    });

    return updated;
  }

  /** Mess Admin resolves a disputed handover — DISPUTED -> ADJUSTED. Admin-only. */
  async resolveDispute(
    messId: string,
    adminUserId: string,
    handoverId: string,
    dto: ResolveDisputeDto,
  ) {
    const handover = await prisma.fundHandover.findUnique({ where: { id: handoverId } });
    if (!handover || handover.messId !== messId) throw new NotFoundError('FundHandover');
    if (handover.status !== FundHandoverStatus.DISPUTED) {
      throw new ConflictError('Only a DISPUTED handover can be resolved');
    }

    const updated = await prisma.fundHandover.update({
      where: { id: handoverId },
      data: {
        status: FundHandoverStatus.ADJUSTED,
        adjustedAmount: new Prisma.Decimal(dto.adjustedAmount),
        resolvedBy: adminUserId,
        resolvedAt: new Date(),
        disputeNotes: dto.notes
          ? `${handover.disputeNotes ?? ''}\n[Resolution note] ${dto.notes}`.trim()
          : handover.disputeNotes,
      },
    });

    await auditService.log({
      messId,
      actorUserId: adminUserId,
      action: AuditAction.HANDOVER_ADJUSTED,
      targetType: 'FundHandover',
      targetId: updated.id,
      previousState: { totalDeclaredAmount: handover.totalDeclaredAmount.toString() },
      newState: { adjustedAmount: dto.adjustedAmount },
    });

    return updated;
  }

  /**
   * ACCEPTED and ADJUSTED handovers are immutable — corrections must go
   * through a brand-new adjustment initiated by resolveDispute (SRS §12:
   * "Handover history immutable after ACCEPTED/ADJUSTED. Corrections via new
   * adjustment record only"). This guard exists for any future direct-edit
   * endpoint someone might be tempted to add.
   */
  assertMutable(handover: { status: FundHandoverStatus }) {
    if (
      handover.status === FundHandoverStatus.ACCEPTED ||
      handover.status === FundHandoverStatus.ADJUSTED
    ) {
      throw new ImmutableRecordError('FundHandover');
    }
  }

  async getHandover(messId: string, handoverId: string) {
    const handover = await prisma.fundHandover.findUnique({
      where: { id: handoverId },
      include: {
        outgoingAssignment: { include: { user: { select: { id: true, name: true } } } },
        incomingAssignment: { include: { user: { select: { id: true, name: true } } } },
      },
    });
    if (!handover || handover.messId !== messId) throw new NotFoundError('FundHandover');
    return handover;
  }

  async listHandovers(messId: string) {
    return prisma.fundHandover.findMany({
      where: { messId },
      include: {
        outgoingAssignment: { include: { user: { select: { id: true, name: true } } } },
        incomingAssignment: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const handoverService = new HandoverService();
