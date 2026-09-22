import { prisma } from '../../lib/prisma';
import { auditService } from '../../lib/audit.service';
import { NotFoundError, ConflictError, ForbiddenError } from '../../lib/errors';
import { BoarderMembershipStatus, DisputeStatus, AuditAction } from '@messmess/types';
import type { RaiseDisputeDto } from './dispute.schema';

const REVIEWABLE_STATUSES: DisputeStatus[] = [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW];

class DisputeService {
  /** An active Boarder raises a dispute against a Meal/Payment/Expense/Statement record. */
  async raiseDispute(messId: string, boarderUserId: string, dto: RaiseDisputeDto) {
    const membership = await prisma.boarderMembership.findFirst({
      where: { messId, userId: boarderUserId, status: BoarderMembershipStatus.ACTIVE },
    });
    if (!membership) throw new ForbiddenError('You are not an active Boarder of this Mess');

    const dispute = await prisma.disputeRecord.create({
      data: {
        messId,
        accountingPeriodId: dto.accountingPeriodId,
        raisedByBoarderId: membership.id,
        targetType: dto.targetType,
        targetId: dto.targetId,
        description: dto.description,
        status: DisputeStatus.OPEN,
      },
    });

    await auditService.log({
      messId,
      actorUserId: boarderUserId,
      action: AuditAction.DISPUTE_RAISED,
      targetType: 'DisputeRecord',
      targetId: dispute.id,
      newState: { targetType: dto.targetType, targetId: dto.targetId },
    });

    return dispute;
  }

  /** Manager marks a dispute as being actively looked into (optional transitional step). */
  async markUnderReview(messId: string, actorUserId: string, disputeId: string) {
    const dispute = await this.getDisputeOrThrow(messId, disputeId);
    if (dispute.status !== DisputeStatus.OPEN) {
      throw new ConflictError('Only an OPEN dispute can be marked UNDER_REVIEW');
    }

    return prisma.disputeRecord.update({
      where: { id: disputeId },
      data: { status: DisputeStatus.UNDER_REVIEW },
    });
  }

  /**
   * Admin resolves a dispute. This records the resolution as a workflow
   * decision — it does NOT itself reverse a payment, correct a meal record,
   * or adjust a statement. Admin applies the actual correction separately
   * using the target module's own mechanism (Payment reversal, Meal
   * correction, or a post-close PeriodAdjustment), then resolves the dispute
   * here to close the loop. Keeping these separate avoids a single dispute
   * endpoint needing to know how to mutate four unrelated domains.
   */
  async resolveDispute(messId: string, adminUserId: string, disputeId: string, resolution: string) {
    const dispute = await this.getDisputeOrThrow(messId, disputeId);
    if (!REVIEWABLE_STATUSES.includes(dispute.status)) {
      throw new ConflictError('This dispute has already been resolved or dismissed');
    }

    const updated = await prisma.disputeRecord.update({
      where: { id: disputeId },
      data: {
        status: DisputeStatus.RESOLVED,
        resolution,
        resolvedBy: adminUserId,
        resolvedAt: new Date(),
      },
    });

    await auditService.log({
      messId,
      actorUserId: adminUserId,
      action: AuditAction.DISPUTE_RESOLVED,
      targetType: 'DisputeRecord',
      targetId: updated.id,
      notes: resolution,
    });

    return updated;
  }

  async dismissDispute(messId: string, adminUserId: string, disputeId: string, reason: string) {
    const dispute = await this.getDisputeOrThrow(messId, disputeId);
    if (!REVIEWABLE_STATUSES.includes(dispute.status)) {
      throw new ConflictError('This dispute has already been resolved or dismissed');
    }

    const updated = await prisma.disputeRecord.update({
      where: { id: disputeId },
      data: {
        status: DisputeStatus.DISMISSED,
        resolution: reason,
        resolvedBy: adminUserId,
        resolvedAt: new Date(),
      },
    });

    await auditService.log({
      messId,
      actorUserId: adminUserId,
      action: AuditAction.DISPUTE_DISMISSED,
      targetType: 'DisputeRecord',
      targetId: updated.id,
      notes: reason,
    });

    return updated;
  }

  async listDisputes(
    messId: string,
    filters: { accountingPeriodId?: string; status?: DisputeStatus },
  ) {
    return prisma.disputeRecord.findMany({
      where: {
        messId,
        ...(filters.accountingPeriodId && { accountingPeriodId: filters.accountingPeriodId }),
        ...(filters.status && { status: filters.status }),
      },
      include: { raisedBy: { include: { user: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDispute(messId: string, disputeId: string) {
    return this.getDisputeOrThrow(messId, disputeId);
  }

  async getMyDisputes(messId: string, userId: string) {
    return prisma.disputeRecord.findMany({
      where: { messId, raisedBy: { userId } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getDisputeOrThrow(messId: string, disputeId: string) {
    const dispute = await prisma.disputeRecord.findUnique({ where: { id: disputeId } });
    if (!dispute || dispute.messId !== messId) throw new NotFoundError('Dispute');
    return dispute;
  }
}

export const disputeService = new DisputeService();
