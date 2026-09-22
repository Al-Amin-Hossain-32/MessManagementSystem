import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { auditService } from '../../lib/audit.service';
import { periodService } from '../accounting/period.service';
import { isMessAdminOrManager } from '../../lib/messAuthz';
import { NotFoundError, ConflictError, ForbiddenError } from '../../lib/errors';
import {
  BoarderMembershipStatus,
  GuestMealChargingPolicy,
  GuestMealStatus,
  AuditAction,
} from '@messmess/types';
import type { RecordGuestMealDto } from './guestMeal.schema';

function parseDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

class GuestMealService {
  /**
   * Records a guest meal. `appliedRate` is supplied by the recorder for V1
   * (see guestMeal.schema.ts doc comment) — see also the note on SHARED_POOL
   * below.
   */
  async recordGuestMeal(messId: string, recordedByUserId: string, dto: RecordGuestMealDto) {
    const host = await prisma.boarderMembership.findUnique({
      where: { id: dto.hostBoarderMembershipId },
    });
    if (!host || host.messId !== messId || host.status !== BoarderMembershipStatus.ACTIVE) {
      throw new NotFoundError('Active host Boarder');
    }

    const config = await prisma.messGuestMealConfig.findUnique({ where: { messId } });
    if (!config) {
      throw new ConflictError('Guest meal configuration has not been set up for this Mess yet');
    }
    if (config.requiresGuestInfo && !dto.guestName && !dto.guestInfo) {
      throw new ConflictError('Guest information is required by this Mess\'s configuration');
    }

    const date = parseDate(dto.date);
    const period = await periodService.getOrCreateActivePeriod(messId, recordedByUserId, date);

    const totalCharge = new Prisma.Decimal(dto.appliedRate).mul(dto.quantity);

    // NOTE: SHARED_POOL policy means this cost should be spread across
    // eligible Boarders — but per SRS §17's statement formula, guestMealCharge
    // is its OWN line item on the Boarder Monthly Statement, computed directly
    // from GuestMeal records (chargedToHost=false, summed and divided) during
    // Phase 6 statement calculation. It does NOT flow through the
    // Expense/ExpenseAllocation engine (confirmed while building Phase 4) —
    // chargedToHost=false is all that's needed here; Phase 6 reads it later.
    const chargedToHost = config.chargingPolicy !== GuestMealChargingPolicy.SHARED_POOL;

    const guestMeal = await prisma.guestMeal.create({
      data: {
        messId,
        hostBoarderMembershipId: dto.hostBoarderMembershipId,
        accountingPeriodId: period.id,
        date,
        mealType: dto.mealType,
        quantity: dto.quantity,
        guestName: dto.guestName,
        guestInfo: dto.guestInfo as Prisma.InputJsonValue | undefined,
        appliedRate: dto.appliedRate,
        totalCharge,
        chargedToHost,
        status: GuestMealStatus.RECORDED,
        recordedBy: recordedByUserId,
      },
    });

    await auditService.log({
      messId,
      actorUserId: recordedByUserId,
      action: AuditAction.GUEST_MEAL_RECORDED,
      targetType: 'GuestMeal',
      targetId: guestMeal.id,
      newState: { hostBoarderMembershipId: dto.hostBoarderMembershipId, totalCharge: totalCharge.toString() },
    });

    return guestMeal;
  }

  async listForPeriod(messId: string, accountingPeriodId?: string) {
    const period = accountingPeriodId
      ? { id: accountingPeriodId }
      : await periodService.getCurrentPeriod(messId);
    if (!period) return [];

    return prisma.guestMeal.findMany({
      where: { messId, accountingPeriodId: period.id },
      include: {
        hostBoarder: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { date: 'desc' },
    });
  }

  /** Host Boarder (or Admin/Manager) disputes a charge recorded against them. */
  async disputeGuestMeal(messId: string, actorUserId: string, guestMealId: string, reason: string) {
    const guestMeal = await prisma.guestMeal.findUnique({
      where: { id: guestMealId },
      include: { hostBoarder: true },
    });
    if (!guestMeal || guestMeal.messId !== messId) throw new NotFoundError('GuestMeal record');
    if (guestMeal.status !== GuestMealStatus.RECORDED) {
      throw new ConflictError('Only a RECORDED guest meal can be disputed');
    }

    const isHost = guestMeal.hostBoarder.userId === actorUserId;
    if (!isHost && !(await isMessAdminOrManager(messId, actorUserId))) {
      throw new ForbiddenError(
        'Only the host Boarder or a Mess Admin/Manager may dispute this charge',
      );
    }

    const updated = await prisma.guestMeal.update({
      where: { id: guestMealId },
      data: { status: GuestMealStatus.DISPUTED },
    });

    await auditService.log({
      messId,
      actorUserId,
      action: AuditAction.GUEST_MEAL_DISPUTED,
      targetType: 'GuestMeal',
      targetId: updated.id,
      notes: reason,
    });

    return updated;
  }
}

export const guestMealService = new GuestMealService();
