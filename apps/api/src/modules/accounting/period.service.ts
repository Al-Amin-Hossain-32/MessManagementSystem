import { prisma } from '../../lib/prisma';
import { auditService } from '../../lib/audit.service';
import { ConflictError } from '../../lib/errors';
import { AccountingPeriodStatus, AuditAction } from '@messmess/types';
import { startOfMonth, endOfMonth, formatPeriodLabel } from '@messmess/utils';

/**
 * Minimal period-bootstrap service.
 *
 * WHY THIS EXISTS: MealRecord/Expense/GuestMeal all require a non-nullable
 * accountingPeriodId (schema.prisma), but the full Accounting Engine
 * (meal rate calculation, PREPARING -> UNDER_REVIEW -> CLOSED, statements)
 * is Phase 6 work. This service only guarantees "there is an ACTIVE period
 * covering today for this Mess" so Phase 3/4 modules have something to
 * attach records to. Phase 6 will own closing this period, calculating
 * finalMealRate, and snapshotting mealConfigSnapshot/expenseCategorySnapshot.
 */
class PeriodService {
  /**
   * Returns the ACTIVE period covering `at` for this Mess, creating one for
   * the current calendar month if none exists yet. Idempotent-safe: uses a
   * transaction + a defensive re-check to avoid creating duplicate periods
   * under concurrent requests.
   *
   * Throws if a period already exists for this date but is no longer ACTIVE
   * (PREPARING/UNDER_REVIEW/CLOSED) — without this guard, a new Expense or
   * Payment could silently attach itself to a period whose accounting has
   * already moved past the editable stage.
   *
   * @param triggeredByUserId The real user whose action caused this
   *   auto-creation (e.g. a Boarder opting out, an Admin saving meal config).
   *   AuditLog.actorUserId has a required FK to User.id, so we only write an
   *   audit entry when we have a real user to attribute it to — we do not
   *   invent a synthetic "system" user, which would violate that constraint.
   */
  async getOrCreateActivePeriod(
    messId: string,
    triggeredByUserId?: string,
    at: Date = new Date(),
  ) {
    const existing = await prisma.accountingPeriod.findFirst({
      where: { messId, startDate: { lte: at }, endDate: { gte: at } },
    });
    if (existing) {
      if (existing.status !== AccountingPeriodStatus.ACTIVE) {
        throw new ConflictError(
          `This Mess's accounting period ("${existing.periodLabel}") is no longer open for new entries (status: ${existing.status})`,
        );
      }
      return existing;
    }

    const startDate = startOfMonth(at);
    const endDate = endOfMonth(at);
    const periodLabel = formatPeriodLabel(at);

    return prisma.$transaction(async (tx) => {
      // Re-check inside the transaction in case of a concurrent request.
      const recheck = await tx.accountingPeriod.findFirst({
        where: { messId, startDate, endDate },
      });
      if (recheck) return recheck;

      const period = await tx.accountingPeriod.create({
        data: {
          messId,
          periodLabel,
          startDate,
          endDate,
          status: AccountingPeriodStatus.ACTIVE,
        },
      });

      if (triggeredByUserId) {
        await auditService.log({
          messId,
          actorUserId: triggeredByUserId,
          action: AuditAction.PERIOD_CREATED,
          targetType: 'AccountingPeriod',
          targetId: period.id,
          newState: { periodLabel, startDate, endDate },
          notes: 'Auto-created on first use of the period for this month',
        });
      }

      return period;
    });
  }

  async getCurrentPeriod(messId: string) {
    return prisma.accountingPeriod.findFirst({
      where: { messId, status: AccountingPeriodStatus.ACTIVE },
      orderBy: { startDate: 'desc' },
    });
  }

  async listPeriods(messId: string) {
    return prisma.accountingPeriod.findMany({
      where: { messId },
      orderBy: { startDate: 'desc' },
    });
  }
}

export const periodService = new PeriodService();
