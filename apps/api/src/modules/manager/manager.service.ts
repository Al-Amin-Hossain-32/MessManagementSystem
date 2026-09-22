import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { auditService } from '../../lib/audit.service';
import { NotFoundError, ConflictError, ForbiddenError } from '../../lib/errors';
import { ManagerAssignmentStatus, AuditAction } from '@messmess/types';
import type { AssignManagerDto } from './manager.schema';

/** Statuses that block a new assignment from being created for the same Mess. */
const IN_FLIGHT_STATUSES: ManagerAssignmentStatus[] = [
  ManagerAssignmentStatus.PENDING_ACCEPTANCE,
  ManagerAssignmentStatus.ACTIVE,
];

class ManagerService {
  /**
   * Primary Owner (or authorized Co-Admin) assigns a Manager for a period.
   *
   * SRS §12: "Only one ACTIVE Manager assignment per Mess at any time."
   * We extend this pre-check to also block a second PENDING_ACCEPTANCE
   * assignment, since having two unresolved assignments in flight for the
   * same Mess has no valid business meaning. Final guard is the DB partial
   * unique index (migration: add_business_constraints).
   */
  async assignManager(messId: string, assignedByUserId: string, dto: AssignManagerDto) {
    const targetUser = await prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, name: true, email: true, isActive: true },
    });
    if (!targetUser || !targetUser.isActive) {
      throw new NotFoundError('Target user');
    }

    try {
      const assignment = await prisma.$transaction(async (tx) => {
        const inFlight = await tx.managerAssignment.findFirst({
          where: { messId, status: { in: IN_FLIGHT_STATUSES } },
        });
        if (inFlight) {
          throw new ConflictError(
            'This Mess already has a Manager assignment in progress. Terminate or complete it before assigning a new one.',
          );
        }

        return tx.managerAssignment.create({
          data: {
            messId,
            userId: dto.userId,
            periodLabel: dto.periodLabel,
            startDate: new Date(dto.startDate),
            endDate: new Date(dto.endDate),
            status: ManagerAssignmentStatus.PENDING_ACCEPTANCE,
            assignedBy: assignedByUserId,
          },
        });
      });

      await auditService.log({
        messId,
        actorUserId: assignedByUserId,
        action: AuditAction.MANAGER_ASSIGNED,
        targetType: 'ManagerAssignment',
        targetId: assignment.id,
        newState: { userId: dto.userId, periodLabel: dto.periodLabel },
      });

      // TODO(notifications): "Manager assignment" event — SRS §25.

      return assignment;
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError(
          'This Mess already has a Manager assignment in progress.',
        );
      }
      throw err;
    }
  }

  /** The assigned user accepts — PENDING_ACCEPTANCE -> ACTIVE. */
  async acceptAssignment(messId: string, userId: string, assignmentId: string) {
    const assignment = await prisma.managerAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment || assignment.messId !== messId) {
      throw new NotFoundError('Manager assignment');
    }
    if (assignment.userId !== userId) {
      throw new ForbiddenError('Only the assigned user can accept this assignment');
    }
    if (assignment.status !== ManagerAssignmentStatus.PENDING_ACCEPTANCE) {
      throw new ConflictError('This assignment is no longer pending acceptance');
    }

    const updated = await prisma.managerAssignment.update({
      where: { id: assignmentId },
      data: { status: ManagerAssignmentStatus.ACTIVE, acceptedAt: new Date() },
    });

    await auditService.log({
      messId,
      actorUserId: userId,
      action: AuditAction.MANAGER_ACCEPTED,
      targetType: 'ManagerAssignment',
      targetId: updated.id,
    });

    return updated;
  }

  /**
   * Marks a completed period as COMPLETED. Only valid once endDate has passed.
   * V1: triggered manually (by the Manager or a Mess Admin). Automatic
   * end-of-period completion via a scheduled job is planned for Phase 3
   * infra (BullMQ cron) alongside the meal-deadline lock job.
   */
  async completeAssignment(messId: string, actorUserId: string, assignmentId: string) {
    const assignment = await prisma.managerAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment || assignment.messId !== messId) {
      throw new NotFoundError('Manager assignment');
    }
    if (assignment.status !== ManagerAssignmentStatus.ACTIVE) {
      throw new ConflictError('Only an active assignment can be completed');
    }
    if (assignment.endDate > new Date()) {
      throw new ConflictError(
        'This assignment period has not ended yet. Use early termination if the Manager must be changed now.',
      );
    }

    const updated = await prisma.managerAssignment.update({
      where: { id: assignmentId },
      data: { status: ManagerAssignmentStatus.COMPLETED },
    });

    await auditService.log({
      messId,
      actorUserId,
      action: AuditAction.MANAGER_COMPLETED,
      targetType: 'ManagerAssignment',
      targetId: updated.id,
    });

    return updated;
  }

  /**
   * Admin-only early termination — e.g. Manager becomes unreachable mid-period.
   * SRS §35 edge case: a FundHandover should follow, but is not force-blocked
   * here so emergencies can be handled immediately; the Handover module flags
   * an outstanding handover for any TERMINATED_EARLY/COMPLETED assignment
   * with no ACCEPTED/ADJUSTED FundHandover record.
   */
  async terminateEarly(
    messId: string,
    adminUserId: string,
    assignmentId: string,
    reason: string,
  ) {
    const assignment = await prisma.managerAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment || assignment.messId !== messId) {
      throw new NotFoundError('Manager assignment');
    }
    if (
      assignment.status !== ManagerAssignmentStatus.ACTIVE &&
      assignment.status !== ManagerAssignmentStatus.PENDING_ACCEPTANCE
    ) {
      throw new ConflictError('Only an active or pending assignment can be terminated');
    }

    const updated = await prisma.managerAssignment.update({
      where: { id: assignmentId },
      data: {
        status: ManagerAssignmentStatus.TERMINATED_EARLY,
        terminatedAt: new Date(),
        terminationReason: reason,
      },
    });

    await auditService.log({
      messId,
      actorUserId: adminUserId,
      action: AuditAction.MANAGER_TERMINATED,
      targetType: 'ManagerAssignment',
      targetId: updated.id,
      notes: reason,
    });

    return updated;
  }

  async getCurrentManager(messId: string) {
    const now = new Date();
    return prisma.managerAssignment.findFirst({
      where: {
        messId,
        status: ManagerAssignmentStatus.ACTIVE,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    });
  }

  async listAssignments(messId: string) {
    return prisma.managerAssignment.findMany({
      where: { messId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { assignedAt: 'desc' },
    });
  }
}

export const managerService = new ManagerService();
