import { prisma } from '../../lib/prisma';
import { auditService } from '../../lib/audit.service';
import { periodService } from '../accounting/period.service';
import { isMessAdminOrManager } from '../../lib/messAuthz';
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  SelfApprovalError,
} from '../../lib/errors';
import {
  BoarderMembershipStatus,
  MealType,
  MealRecordStatus,
  MealCorrectionRequestStatus,
  AuditAction,
} from '@messmess/types';
import { isPastDeadline } from '@messmess/utils';
import type { OptOutDto, RequestCorrectionDto } from './meal.schema';

function parseDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

class MealService {
  /**
   * Generates DEFAULT_ON MealRecords for every ACTIVE Boarder x every active
   * MealTypeConfig, for the given date. Idempotent — safe to call repeatedly
   * (relies on MealRecord's unique(boarderMembershipId, date, mealType) via
   * Prisma's skipDuplicates).
   *
   * V1: manually triggered (Admin/Manager endpoint) or lazily invoked from
   * opt-out. Production should run this once daily per Mess via a BullMQ
   * repeatable job shortly after midnight in the Mess's local timezone —
   * see the TODO at the bottom of this file for the intended wiring.
   */
  async ensureDailyMealRecords(messId: string, dateStr: string, triggeredByUserId?: string) {
    const date = parseDate(dateStr);

    const config = await prisma.messMealConfig.findUnique({
      where: { messId },
      include: { mealTypes: { where: { isActive: true } } },
    });
    if (!config || config.mealTypes.length === 0) {
      throw new ConflictError('Meal configuration has not been set up for this Mess yet');
    }

    const period = await periodService.getOrCreateActivePeriod(messId, triggeredByUserId, date);

    const activeBoarders = await prisma.boarderMembership.findMany({
      where: { messId, status: BoarderMembershipStatus.ACTIVE },
      select: { id: true },
    });
    if (activeBoarders.length === 0) return { created: 0 };

    const data = activeBoarders.flatMap((boarder) =>
      config.mealTypes.map((mt) => ({
        messId,
        boarderMembershipId: boarder.id,
        accountingPeriodId: period.id,
        date,
        mealType: mt.type,
        weight: mt.weight,
        status: MealRecordStatus.DEFAULT_ON,
      })),
    );

    const result = await prisma.mealRecord.createMany({ data, skipDuplicates: true });
    return { created: result.count };
  }

  // ─── Listing ────────────────────────────────────────────────────────────────

  async listMealsForDate(messId: string, dateStr: string) {
    return prisma.mealRecord.findMany({
      where: { messId, date: parseDate(dateStr) },
      include: {
        boarderMembership: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: [{ mealType: 'asc' }],
    });
  }

  async getMyMealsForDate(messId: string, userId: string, dateStr: string) {
    const membership = await this.requireOwnActiveMembership(messId, userId);
    return prisma.mealRecord.findMany({
      where: { messId, boarderMembershipId: membership.id, date: parseDate(dateStr) },
      orderBy: { mealType: 'asc' },
    });
  }

  async getMyMealHistory(messId: string, userId: string, limit = 30) {
    const membership = await this.requireOwnActiveMembership(messId, userId);
    return prisma.mealRecord.findMany({
      where: { messId, boarderMembershipId: membership.id },
      orderBy: { date: 'desc' },
      take: limit,
    });
  }

  private async requireOwnActiveMembership(messId: string, userId: string) {
    const membership = await prisma.boarderMembership.findFirst({
      where: { messId, userId, status: BoarderMembershipStatus.ACTIVE },
    });
    if (!membership) throw new ForbiddenError('You are not an active Boarder of this Mess');
    return membership;
  }

  // ─── Opt-out / Opt-in ───────────────────────────────────────────────────────

  /**
   * SRS §13: Boarder cancels a meal before the configured optOutDeadline.
   * Deadline check also naturally rejects past dates, since isPastDeadline()
   * returns true whenever "now" is on a later calendar day than the target.
   */
  async optOut(messId: string, userId: string, dto: OptOutDto) {
    const membership = await this.requireOwnActiveMembership(messId, userId);
    const mealTypeConfig = await this.getActiveMealTypeConfig(messId, dto.mealType);

    // Lazily ensure today's/target date's records exist — do not depend on a
    // cron having already run.
    await this.ensureDailyMealRecords(messId, dto.date, userId);

    const record = await prisma.mealRecord.findUniqueOrThrow({
      where: {
        boarderMembershipId_date_mealType: {
          boarderMembershipId: membership.id,
          date: parseDate(dto.date),
          mealType: dto.mealType,
        },
      },
    });

    if (record.status !== MealRecordStatus.DEFAULT_ON) {
      throw new ConflictError(`This meal is already ${record.status.toLowerCase()}`);
    }
    if (isPastDeadline(record.date, mealTypeConfig.optOutDeadline)) {
      throw new ConflictError('The opt-out deadline for this meal has passed');
    }

    const updated = await prisma.mealRecord.update({
      where: { id: record.id },
      data: { status: MealRecordStatus.OPTED_OUT },
    });

    await auditService.log({
      messId,
      actorUserId: userId,
      action: AuditAction.MEAL_OPTED_OUT,
      targetType: 'MealRecord',
      targetId: updated.id,
    });

    return updated;
  }

  /** Boarder reverses their own opt-out, before the deadline. */
  async optIn(messId: string, userId: string, dto: OptOutDto) {
    const membership = await this.requireOwnActiveMembership(messId, userId);
    const mealTypeConfig = await this.getActiveMealTypeConfig(messId, dto.mealType);

    const record = await prisma.mealRecord.findUnique({
      where: {
        boarderMembershipId_date_mealType: {
          boarderMembershipId: membership.id,
          date: parseDate(dto.date),
          mealType: dto.mealType,
        },
      },
    });
    if (!record) throw new NotFoundError('Meal record');
    if (record.status !== MealRecordStatus.OPTED_OUT) {
      throw new ConflictError('Only an opted-out meal can be reversed');
    }
    if (isPastDeadline(record.date, mealTypeConfig.optOutDeadline)) {
      throw new ConflictError('The opt-out deadline for this meal has passed');
    }

    const updated = await prisma.mealRecord.update({
      where: { id: record.id },
      data: { status: MealRecordStatus.DEFAULT_ON },
    });

    await auditService.log({
      messId,
      actorUserId: userId,
      action: AuditAction.MEAL_OPT_IN_REVERTED,
      targetType: 'MealRecord',
      targetId: updated.id,
    });

    return updated;
  }

  private async getActiveMealTypeConfig(messId: string, mealType: MealType) {
    const config = await prisma.messMealConfig.findUnique({
      where: { messId },
      include: { mealTypes: { where: { type: mealType, isActive: true } } },
    });
    const mealTypeConfig = config?.mealTypes[0];
    if (!mealTypeConfig) {
      throw new NotFoundError(`Active configuration for meal type ${mealType}`);
    }
    return mealTypeConfig;
  }

  // ─── Deadline Lock Sweep ────────────────────────────────────────────────────

  /**
   * Transitions DEFAULT_ON/OPTED_OUT records whose deadline has passed to
   * LOCKED. V1: manually triggered by an Admin/Manager. Intended to run via
   * a BullMQ repeatable job (e.g. every 15 minutes) once Redis/queue infra
   * is provisioned — see TODO at the bottom of this file.
   */
  async lockExpiredMeals(messId: string, triggeredByUserId: string) {
    const config = await prisma.messMealConfig.findUnique({
      where: { messId },
      include: { mealTypes: true },
    });
    if (!config) return { locked: 0 };

    const deadlineByType = new Map(config.mealTypes.map((mt) => [mt.type, mt.optOutDeadline]));

    const candidates = await prisma.mealRecord.findMany({
      where: {
        messId,
        status: { in: [MealRecordStatus.DEFAULT_ON, MealRecordStatus.OPTED_OUT] },
      },
      select: { id: true, date: true, mealType: true },
    });

    const idsToLock = candidates
      .filter((record) => {
        const deadline = deadlineByType.get(record.mealType);
        return deadline ? isPastDeadline(record.date, deadline) : false;
      })
      .map((record) => record.id);

    if (idsToLock.length === 0) return { locked: 0 };

    await prisma.mealRecord.updateMany({
      where: { id: { in: idsToLock } },
      data: { status: MealRecordStatus.LOCKED, lockedAt: new Date() },
    });

    await auditService.log({
      messId,
      actorUserId: triggeredByUserId,
      action: AuditAction.MEAL_LOCKED,
      targetType: 'MealRecord',
      notes: `Locked ${idsToLock.length} meal record(s) past their opt-out deadline`,
    });

    return { locked: idsToLock.length };
  }

  // ─── Correction Workflow ────────────────────────────────────────────────────
  // See schema.prisma MealCorrectionRequest doc comment: an approved
  // correction updates the MealRecord row in place (the unique constraint on
  // boarderMembershipId+date+mealType forbids a second row); the "original
  // preserved" requirement from SRS §13 is satisfied by the AuditLog
  // previousState/newState snapshot taken at approval time.

  /** Boarder (own record, post-deadline) or Manager/Admin (any record) requests a correction. */
  async requestCorrection(
    messId: string,
    requesterUserId: string,
    mealRecordId: string,
    dto: RequestCorrectionDto,
  ) {
    const record = await prisma.mealRecord.findUnique({
      where: { id: mealRecordId },
      include: { boarderMembership: true },
    });
    if (!record || record.messId !== messId) throw new NotFoundError('Meal record');

    const isOwner = record.boarderMembership.userId === requesterUserId;
    if (!isOwner && !(await isMessAdminOrManager(messId, requesterUserId))) {
      throw new ForbiddenError(
        'Only the Boarder themself or a Mess Admin/Manager may request a correction for this meal',
      );
    }

    const request = await prisma.mealCorrectionRequest.create({
      data: {
        messId,
        mealRecordId,
        requestedBy: requesterUserId,
        requestedStatus: dto.requestedStatus ?? record.status,
        requestedWeight: dto.requestedWeight,
        reason: dto.reason,
      },
    });

    await auditService.log({
      messId,
      actorUserId: requesterUserId,
      action: AuditAction.MEAL_CORRECTION_REQUESTED,
      targetType: 'MealCorrectionRequest',
      targetId: request.id,
      newState: {
        mealRecordId,
        requestedStatus: dto.requestedStatus,
        requestedWeight: dto.requestedWeight,
      },
    });

    return request;
  }

  /**
   * Manager/Admin approves or rejects a correction request.
   * Self-approval blocked: a Manager cannot approve a correction on their
   * OWN meal record (SRS §13: "Manager reviews (cannot approve own meal)").
   */
  async reviewCorrection(
    messId: string,
    reviewerUserId: string,
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
    reviewNotes?: string,
  ) {
    const request = await prisma.mealCorrectionRequest.findUnique({
      where: { id: requestId },
      include: { mealRecord: { include: { boarderMembership: true } } },
    });
    if (!request || request.messId !== messId) throw new NotFoundError('Correction request');
    if (request.status !== MealCorrectionRequestStatus.PENDING) {
      throw new ConflictError('This correction request has already been reviewed');
    }
    if (request.mealRecord.boarderMembership.userId === reviewerUserId) {
      throw new SelfApprovalError('correcting your own meal record');
    }

    if (decision === 'REJECTED') {
      const updated = await prisma.mealCorrectionRequest.update({
        where: { id: requestId },
        data: {
          status: MealCorrectionRequestStatus.REJECTED,
          reviewedBy: reviewerUserId,
          reviewedAt: new Date(),
          reviewNotes,
        },
      });

      await auditService.log({
        messId,
        actorUserId: reviewerUserId,
        action: AuditAction.MEAL_CORRECTION_REJECTED,
        targetType: 'MealCorrectionRequest',
        targetId: updated.id,
        notes: reviewNotes,
      });

      return updated;
    }

    // APPROVED — update the MealRecord in place; AuditLog captures the
    // before/after snapshot as the "original preserved" history.
    const previousState = {
      status: request.mealRecord.status,
      weight: request.mealRecord.weight.toString(),
    };

    const [updatedRecord, updatedRequest] = await prisma.$transaction([
      prisma.mealRecord.update({
        where: { id: request.mealRecordId },
        data: {
          status: request.requestedStatus,
          weight: request.requestedWeight ?? undefined,
          correctionRef: request.id,
          correctionReason: request.reason,
          correctedBy: reviewerUserId,
          correctedAt: new Date(),
        },
      }),
      prisma.mealCorrectionRequest.update({
        where: { id: requestId },
        data: {
          status: MealCorrectionRequestStatus.APPROVED,
          reviewedBy: reviewerUserId,
          reviewedAt: new Date(),
          reviewNotes,
        },
      }),
    ]);

    await auditService.log({
      messId,
      actorUserId: reviewerUserId,
      action: AuditAction.MEAL_CORRECTED,
      targetType: 'MealRecord',
      targetId: request.mealRecordId,
      previousState,
      newState: {
        status: updatedRecord.status,
        weight: updatedRecord.weight.toString(),
      },
    });

    return updatedRequest;
  }

  async listCorrectionRequests(messId: string, status?: MealCorrectionRequestStatus) {
    return prisma.mealCorrectionRequest.findMany({
      where: { messId, ...(status && { status }) },
      include: {
        mealRecord: {
          include: { boarderMembership: { include: { user: { select: { name: true } } } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const mealService = new MealService();

// TODO(Phase 3 infra / BullMQ): wire two repeatable jobs once Redis is
// provisioned:
//   1. Daily, shortly after midnight per Mess timezone:
//        for each ACTIVE Mess -> mealService.ensureDailyMealRecords(messId, today)
//   2. Every ~15 minutes:
//        for each ACTIVE Mess -> mealService.lockExpiredMeals(messId, <acting admin/manager id>)
//      A true unattended "system" actor for #2 needs the AuditLog.actorUserId
//      FK-to-User constraint revisited (see period.service.ts note) before
//      this can run without a human triggeredByUserId.
