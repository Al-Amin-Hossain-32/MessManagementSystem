import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { auditService } from '../../lib/audit.service';
import {
  NotFoundError,
  ConflictError,
  ActiveMembershipConflictError,
} from '../../lib/errors';
import { BoarderMembershipStatus, BoarderJoinVia, AuditAction, NotificationType } from '@messmess/types';
import type { InviteBoarderDto, ResidencyChangeDto } from './boarder.schema';
import { notificationService } from '../notification/notification.service';

const INVITE_EXPIRY_DAYS = 7;

/** Statuses that count as "already in the pipeline" for a given Mess. */
const IN_FLIGHT_STATUSES: BoarderMembershipStatus[] = [
  BoarderMembershipStatus.INVITED,
  BoarderMembershipStatus.PENDING_APPROVAL,
  BoarderMembershipStatus.ACTIVE,
];

class BoarderService {
  // ─── Admin Invite Path ────────────────────────────────────────────────────

  /**
   * Mess Admin invites an EXISTING registered user (by email) to join as a Boarder.
   * MVP decision: invites target already-registered accounts only. Inviting an
   * unregistered phone/email (per SRS §11) requires a pre-registration/placeholder
   * flow, deferred — tracked for V1.5.
   */
  async inviteBoarder(messId: string, inviterUserId: string, dto: InviteBoarderDto) {
    const targetUser = await prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, name: true, email: true },
    });
    if (!targetUser) {
      throw new NotFoundError('A registered user with this email');
    }

    const existing = await prisma.boarderMembership.findFirst({
      where: { userId: targetUser.id, messId },
      orderBy: { createdAt: 'desc' },
    });
    if (existing && IN_FLIGHT_STATUSES.includes(existing.status)) {
      throw new ConflictError(
        'This user already has a pending or active membership in this Mess',
      );
    }

    const inviteExpiresAt = new Date();
    inviteExpiresAt.setDate(inviteExpiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const membership = await prisma.boarderMembership.create({
      data: {
        userId: targetUser.id,
        messId,
        status: BoarderMembershipStatus.INVITED,
        joinedVia: BoarderJoinVia.ADMIN_INVITE,
        invitedBy: inviterUserId,
        inviteExpiresAt,
      },
    });

    await auditService.log({
      messId,
      actorUserId: inviterUserId,
      action: AuditAction.BOARDER_INVITED,
      targetType: 'BoarderMembership',
      targetId: membership.id,
      newState: { invitedEmail: targetUser.email },
    });

    await notificationService.notifyUser({
      userId: targetUser.id,
      messId,
      eventId: `boarder.invited:${membership.id}`,
      type: NotificationType.BOARDER_INVITED,
      href: '/dashboard',
    });

    return membership;
  }

  async acceptInvite(messId: string, userId: string) {
    const membership = await prisma.boarderMembership.findFirst({
      where: { messId, userId, status: BoarderMembershipStatus.INVITED },
    });
    if (!membership) throw new NotFoundError('Pending invitation');

    return this.activateMembership(
      messId,
      membership.id,
      BoarderMembershipStatus.INVITED,
      userId,
      AuditAction.BOARDER_APPROVED,
    );
  }

  async declineInvite(messId: string, userId: string) {
    const membership = await prisma.boarderMembership.findFirst({
      where: { messId, userId, status: BoarderMembershipStatus.INVITED },
    });
    if (!membership) throw new NotFoundError('Pending invitation');

    const updated = await prisma.boarderMembership.update({
      where: { id: membership.id },
      data: {
        status: BoarderMembershipStatus.REMOVED,
        leftReason: 'DECLINED_BY_USER',
        leftAt: new Date(),
      },
    });

    await auditService.log({
      messId,
      actorUserId: userId,
      action: AuditAction.BOARDER_INVITE_DECLINED,
      targetType: 'BoarderMembership',
      targetId: updated.id,
    });

    return updated;
  }

  // ─── Join Request Path ────────────────────────────────────────────────────

  /**
   * A user discovers a Mess (via Mess Code / QR / invite link — resolved to
   * `messId` client-side or via a separate public lookup endpoint) and
   * requests to join. Requires the Mess to be ACTIVE (enforced by resolveTenantLoose).
   */
  async createJoinRequest(messId: string, userId: string) {
    const activeElsewhere = await prisma.boarderMembership.findFirst({
      where: { userId, status: BoarderMembershipStatus.ACTIVE },
    });
    if (activeElsewhere) throw new ActiveMembershipConflictError();

    const existing = await prisma.boarderMembership.findFirst({
      where: { userId, messId },
      orderBy: { createdAt: 'desc' },
    });
    if (existing && IN_FLIGHT_STATUSES.includes(existing.status)) {
      throw new ConflictError(
        'You already have a pending or active membership in this Mess',
      );
    }

    const membership = await prisma.boarderMembership.create({
      data: {
        userId,
        messId,
        status: BoarderMembershipStatus.PENDING_APPROVAL,
        joinedVia: BoarderJoinVia.JOIN_REQUEST,
        requestedAt: new Date(),
      },
    });

    await auditService.log({
      messId,
      actorUserId: userId,
      action: AuditAction.BOARDER_JOIN_REQUESTED,
      targetType: 'BoarderMembership',
      targetId: membership.id,
    });

    await notificationService.notifyAdmins({
      messId,
      eventId: `boarder.join-request:${membership.id}`,
      type: NotificationType.JOIN_REQUEST_CREATED,
      href: `/mess/${messId}/members`,
    });

    return membership;
  }

  async approveJoinRequest(messId: string, adminUserId: string, membershipId: string) {
    return this.activateMembership(
      messId,
      membershipId,
      BoarderMembershipStatus.PENDING_APPROVAL,
      adminUserId,
      AuditAction.BOARDER_APPROVED,
    );
  }

  async rejectJoinRequest(
    messId: string,
    adminUserId: string,
    membershipId: string,
    reason?: string,
  ) {
    const membership = await prisma.boarderMembership.findUnique({
      where: { id: membershipId },
    });
    if (!membership || membership.messId !== messId) {
      throw new NotFoundError('Join request');
    }
    if (membership.status !== BoarderMembershipStatus.PENDING_APPROVAL) {
      throw new ConflictError('This join request is no longer pending');
    }

    const updated = await prisma.boarderMembership.update({
      where: { id: membershipId },
      data: {
        status: BoarderMembershipStatus.REMOVED,
        leftReason: reason ?? 'Rejected by Mess Admin',
        leftAt: new Date(),
      },
    });

    await auditService.log({
      messId,
      actorUserId: adminUserId,
      action: AuditAction.BOARDER_JOIN_REJECTED,
      targetType: 'BoarderMembership',
      targetId: updated.id,
      notes: reason,
    });

    return updated;
  }

  // ─── Shared activation logic (One-Active-Mess Rule) ───────────────────────

  /**
   * Transitions a BoarderMembership from INVITED or PENDING_APPROVAL to ACTIVE.
   *
   * SRS §11 One-Active-Mess Rule: a user may hold only one ACTIVE
   * BoarderMembership at any time, platform-wide. This is enforced twice:
   *   1. Application-level pre-check inside the transaction (fast-fail, clear error).
   *   2. DB-level partial unique index (final guard against a race between two
   *      concurrent activation requests for the same user in different Messes).
   * See migration: add_business_constraints (one_active_mess_per_user).
   */
  private async activateMembership(
    messId: string,
    membershipId: string,
    expectedStatus:
      | typeof BoarderMembershipStatus.INVITED
      | typeof BoarderMembershipStatus.PENDING_APPROVAL,
    actorUserId: string,
    auditAction: AuditAction,
  ) {
    try {
      const updated = await prisma.$transaction(async (tx) => {
        const membership = await tx.boarderMembership.findUnique({
          where: { id: membershipId },
        });
        if (!membership || membership.messId !== messId) {
          throw new NotFoundError('Membership request');
        }
        if (membership.status !== expectedStatus) {
          throw new ConflictError(`This request is no longer ${expectedStatus}`);
        }
        if (
          expectedStatus === BoarderMembershipStatus.INVITED &&
          membership.inviteExpiresAt &&
          membership.inviteExpiresAt < new Date()
        ) {
          throw new ConflictError(
            'This invitation has expired. Please ask the Mess Admin to resend it.',
          );
        }

        const activeElsewhere = await tx.boarderMembership.findFirst({
          where: { userId: membership.userId, status: BoarderMembershipStatus.ACTIVE },
        });
        if (activeElsewhere) throw new ActiveMembershipConflictError();

        return tx.boarderMembership.update({
          where: { id: membershipId },
          data: {
            status: BoarderMembershipStatus.ACTIVE,
            joinedAt: new Date(),
            ...(expectedStatus === BoarderMembershipStatus.PENDING_APPROVAL && {
              approvedBy: actorUserId,
            }),
          },
        });
      });

      await auditService.log({
        messId,
        actorUserId,
        action: auditAction,
        targetType: 'BoarderMembership',
        targetId: updated.id,
      });

      await notificationService.notifyAdmins({
        messId,
        eventId: `boarder.joined:${updated.id}`,
        type: NotificationType.MEMBER_JOINED,
        href: `/mess/${messId}/members`,
        excludeUserId: actorUserId,
      });

      return updated;
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ActiveMembershipConflictError();
      }
      throw err;
    }
  }

  // ─── Listing ───────────────────────────────────────────────────────────────

  async listBoarders(messId: string, status?: BoarderMembershipStatus) {
    return prisma.boarderMembership.findMany({
      where: { messId, ...(status && { status }) },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        residencies: { where: { effectiveTo: null }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Leave / Remove ────────────────────────────────────────────────────────

  /** Boarder-initiated leave request — does not immediately end membership. */
  async requestLeave(messId: string, userId: string, reason?: string) {
    const membership = await prisma.boarderMembership.findFirst({
      where: { messId, userId, status: BoarderMembershipStatus.ACTIVE },
    });
    if (!membership) throw new NotFoundError('Active membership');

    const updated = await prisma.boarderMembership.update({
      where: { id: membership.id },
      data: { status: BoarderMembershipStatus.LEAVE_REQUESTED, leftReason: reason },
    });

    await auditService.log({
      messId,
      actorUserId: userId,
      action: AuditAction.BOARDER_LEAVE_REQUESTED,
      targetType: 'BoarderMembership',
      targetId: updated.id,
    });

    return updated;
  }

  /**
   * Admin finalizes a leave (or force-removes a Boarder directly from ACTIVE).
   *
   * NOTE: Once the Meal module (Phase 3) exists, this must also finalize
   * MealRecords up to the leave date and pro-rate expense allocations per
   * Mess policy — SRS §35 edge case "Boarder leaves Mess mid-month". Deferred
   * here since MealRecord does not exist yet; do not forget this when Phase 3 lands.
   */
  async endMembership(
    messId: string,
    adminUserId: string,
    membershipId: string,
    reason?: string,
  ) {
    const membership = await prisma.boarderMembership.findUnique({
      where: { id: membershipId },
    });
    if (!membership || membership.messId !== messId) {
      throw new NotFoundError('BoarderMembership');
    }
    if (
      membership.status !== BoarderMembershipStatus.ACTIVE &&
      membership.status !== BoarderMembershipStatus.LEAVE_REQUESTED
    ) {
      throw new ConflictError(
        'Only an active or leave-requested membership can be ended',
      );
    }

    const updated = await prisma.boarderMembership.update({
      where: { id: membershipId },
      data: {
        status: BoarderMembershipStatus.ENDED,
        leftAt: new Date(),
        leftReason: reason ?? membership.leftReason ?? 'Ended by Mess Admin',
      },
    });

    await auditService.log({
      messId,
      actorUserId: adminUserId,
      action: AuditAction.BOARDER_LEFT,
      targetType: 'BoarderMembership',
      targetId: updated.id,
      notes: reason,
    });

    return updated;
  }

  // ─── Residency ─────────────────────────────────────────────────────────────

  /** Records a mid-period residency type change (RESIDENT <-> MEAL_ONLY). */
  async changeResidency(
    messId: string,
    adminUserId: string,
    membershipId: string,
    dto: ResidencyChangeDto,
  ) {
    const membership = await prisma.boarderMembership.findUnique({
      where: { id: membershipId },
    });
    if (!membership || membership.messId !== messId) {
      throw new NotFoundError('BoarderMembership');
    }
    if (membership.status !== BoarderMembershipStatus.ACTIVE) {
      throw new ConflictError('Residency can only be changed for an active Boarder');
    }

    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();

    const created = await prisma.$transaction(async (tx) => {
      // Close whichever residency record is currently open, if any.
      await tx.boarderResidency.updateMany({
        where: { boarderMembershipId: membershipId, effectiveTo: null },
        data: { effectiveTo: effectiveFrom },
      });

      return tx.boarderResidency.create({
        data: {
          boarderMembershipId: membershipId,
          messId,
          type: dto.type,
          effectiveFrom,
          changedBy: adminUserId,
          reason: dto.reason,
        },
      });
    });

    await auditService.log({
      messId,
      actorUserId: adminUserId,
      action: AuditAction.BOARDER_RESIDENCY_CHANGED,
      targetType: 'BoarderResidency',
      targetId: created.id,
      newState: { type: dto.type, effectiveFrom },
    });

    return created;
  }
}

export const boarderService = new BoarderService();
