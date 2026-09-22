import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { auditService } from '../../lib/audit.service';
import { expenseAllocationService } from '../expense/expenseAllocation.service';
import { statementService } from './statement.service';
import { NotFoundError, ConflictError } from '../../lib/errors';
import {
  AccountingPeriodStatus,
  MealRecordStatus,
  ExpenseStatus,
  DisputeStatus,
  AuditAction,
} from '@messmess/types';

export interface CreateAdjustmentDto {
  targetType: 'BOARDER_STATEMENT' | 'EXPENSE' | 'PAYMENT';
  targetId: string;
  reason: string;
  adjustedAmount?: number;
  notes?: string;
}

class PeriodCloseService {
  /**
   * ACTIVE -> PREPARING -> UNDER_REVIEW, run atomically as one admin action.
   * SRS's lifecycle diagram treats PREPARING as a brief system-calculation
   * step, not a separate manually-triggered waiting state, so this method
   * performs both transitions together:
   *   1. Finalize meal records (DEFAULT_ON/LOCKED -> FINALIZED)
   *   2. Calculate finalMealRate (with the zero-meal guard)
   *   3. Run the Expense Distribution Engine one last time before locking
   *   4. Snapshot meal config + expense categories for historical accuracy
   *   5. Generate Boarder Monthly Statements
   *   6. Open the period for Boarder review
   */
  async initiateClose(messId: string, adminUserId: string, periodId: string) {
    const period = await prisma.accountingPeriod.findUnique({ where: { id: periodId } });
    if (!period || period.messId !== messId) throw new NotFoundError('AccountingPeriod');
    if (period.status !== AccountingPeriodStatus.ACTIVE) {
      throw new ConflictError('Only an ACTIVE period can be closed for review');
    }
    if (period.endDate > new Date()) {
      throw new ConflictError('This period has not ended yet');
    }

    // 1. Finalize meal records. OPTED_OUT stays OPTED_OUT (never eaten);
    // already-CORRECTED records are left as-is (SRS §13 lifecycle).
    await prisma.mealRecord.updateMany({
      where: {
        messId,
        accountingPeriodId: periodId,
        status: { in: [MealRecordStatus.DEFAULT_ON, MealRecordStatus.LOCKED] },
      },
      data: { status: MealRecordStatus.FINALIZED },
    });

    // 2. Meal rate calculation
    const weightedAgg = await prisma.mealRecord.aggregate({
      where: {
        messId,
        accountingPeriodId: periodId,
        status: { in: [MealRecordStatus.FINALIZED, MealRecordStatus.CORRECTED] },
      },
      _sum: { weight: true },
    });
    const totalFinalizedWeightedMeals = new Prisma.Decimal(weightedAgg._sum.weight ?? 0);

    const eligibleAgg = await prisma.expense.aggregate({
      where: {
        messId,
        accountingPeriodId: periodId,
        status: ExpenseStatus.ACTIVE,
        category: { countsTowardMealRate: true },
      },
      _sum: { amount: true },
    });
    const eligibleMealExpenseTotal = new Prisma.Decimal(eligibleAgg._sum.amount ?? 0);

    // Zero-meal guard (SRS §17): zero weighted meals + non-zero eligible
    // expenses is unresolvable without Admin intervention (e.g. reclassify
    // the expense, or wait for meal records to exist) — flag and block
    // closing later, but still let PREPARING complete so the exception is
    // visible. Zero meals AND zero expenses is a valid closed month.
    let hasAccountingException = false;
    let accountingExceptionReason: string | null = null;
    let finalMealRate = new Prisma.Decimal(0);

    if (totalFinalizedWeightedMeals.isZero()) {
      if (!eligibleMealExpenseTotal.isZero()) {
        hasAccountingException = true;
        accountingExceptionReason =
          'Zero finalized weighted meals but non-zero eligible meal expenses — the meal rate cannot be calculated. Resolve (e.g. reclassify the expense) before closing.';
      }
    } else {
      finalMealRate = eligibleMealExpenseTotal.div(totalFinalizedWeightedMeals);
    }

    // 3. Final Expense Distribution Engine run before the period locks.
    await expenseAllocationService.allocateForPeriod(messId, periodId, adminUserId);

    // 4. Snapshot config
    const [mealConfig, expenseCategories] = await Promise.all([
      prisma.messMealConfig.findUnique({ where: { messId }, include: { mealTypes: true } }),
      prisma.expenseCategory.findMany({ where: { messId } }),
    ]);

    await prisma.accountingPeriod.update({
      where: { id: periodId },
      data: {
        status: AccountingPeriodStatus.PREPARING,
        preparingAt: new Date(),
        totalFinalizedWeightedMeals,
        eligibleMealExpenseTotal,
        finalMealRate,
        hasAccountingException,
        accountingExceptionReason,
        mealConfigSnapshot: mealConfig
          ? (mealConfig as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        expenseCategorySnapshot: expenseCategories as unknown as Prisma.InputJsonValue,
      },
    });

    await auditService.log({
      messId,
      actorUserId: adminUserId,
      action: AuditAction.PERIOD_PREPARING,
      targetType: 'AccountingPeriod',
      targetId: periodId,
      newState: {
        finalMealRate: finalMealRate.toString(),
        totalFinalizedWeightedMeals: totalFinalizedWeightedMeals.toString(),
        hasAccountingException,
      },
    });

    // 5. Generate statements
    const { statementsGenerated } = await statementService.generateStatementsForPeriod(
      messId,
      periodId,
    );

    // 6. Open for review
    const reviewPeriod = await prisma.accountingPeriod.update({
      where: { id: periodId },
      data: { status: AccountingPeriodStatus.UNDER_REVIEW, underReviewAt: new Date() },
    });

    await auditService.log({
      messId,
      actorUserId: adminUserId,
      action: AuditAction.PERIOD_UNDER_REVIEW,
      targetType: 'AccountingPeriod',
      targetId: periodId,
      notes: `${statementsGenerated} statement(s) generated`,
    });

    return reviewPeriod;
  }

  /**
   * UNDER_REVIEW -> CLOSED. Blocked outright by an unresolved accounting
   * exception (no override — the numbers would be wrong for everyone). Open
   * disputes may be overridden per SRS §18 ("Month can close with OPEN
   * disputes if Admin overrides").
   */
  async closePeriod(messId: string, adminUserId: string, periodId: string, forceOverride = false) {
    const period = await prisma.accountingPeriod.findUnique({ where: { id: periodId } });
    if (!period || period.messId !== messId) throw new NotFoundError('AccountingPeriod');
    if (period.status !== AccountingPeriodStatus.UNDER_REVIEW) {
      throw new ConflictError('Only a period UNDER_REVIEW can be closed');
    }
    if (period.hasAccountingException) {
      throw new ConflictError(
        period.accountingExceptionReason ??
          'This period has an unresolved accounting exception and cannot be closed',
      );
    }

    const openDisputeCount = await prisma.disputeRecord.count({
      where: {
        messId,
        accountingPeriodId: periodId,
        status: { in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW] },
      },
    });
    if (openDisputeCount > 0 && !forceOverride) {
      throw new ConflictError(
        `${openDisputeCount} unresolved dispute(s) for this period — pass forceOverride to close anyway`,
      );
    }

    const updated = await prisma.accountingPeriod.update({
      where: { id: periodId },
      data: {
        status: AccountingPeriodStatus.CLOSED,
        closedAt: new Date(),
        closedBy: adminUserId,
        hasUnresolvedDisputes: openDisputeCount > 0,
      },
    });

    await auditService.log({
      messId,
      actorUserId: adminUserId,
      action: AuditAction.PERIOD_CLOSED,
      targetType: 'AccountingPeriod',
      targetId: periodId,
      notes:
        openDisputeCount > 0
          ? `Closed with ${openDisputeCount} unresolved dispute(s) (override)`
          : undefined,
    });

    return updated;
  }

  /**
   * Post-close correction (SRS §18). Never overwrites the original
   * statement/expense/payment record — creates an immutable PeriodAdjustment
   * and, for a BOARDER_STATEMENT target, additively adjusts closingBalance
   * and flags isAdjusted=true.
   */
  async createAdjustment(
    messId: string,
    adminUserId: string,
    periodId: string,
    dto: CreateAdjustmentDto,
  ) {
    const period = await prisma.accountingPeriod.findUnique({ where: { id: periodId } });
    if (!period || period.messId !== messId) throw new NotFoundError('AccountingPeriod');
    if (period.status !== AccountingPeriodStatus.CLOSED) {
      throw new ConflictError('Adjustments can only be made to a CLOSED period');
    }

    const adjustment = await prisma.$transaction(async (tx) => {
      const created = await tx.periodAdjustment.create({
        data: {
          accountingPeriodId: periodId,
          messId,
          targetType: dto.targetType,
          targetId: dto.targetId,
          reason: dto.reason,
          adjustedAmount: dto.adjustedAmount,
          approvedBy: adminUserId,
          notes: dto.notes,
        },
      });

      if (dto.targetType === 'BOARDER_STATEMENT' && dto.adjustedAmount !== undefined) {
        const statement = await tx.boarderMonthlyStatement.findUnique({
          where: { id: dto.targetId },
        });
        if (statement && statement.messId === messId) {
          await tx.boarderMonthlyStatement.update({
            where: { id: dto.targetId },
            data: {
              closingBalance: new Prisma.Decimal(statement.closingBalance).add(dto.adjustedAmount),
              isAdjusted: true,
            },
          });
        }
      }

      return created;
    });

    await auditService.log({
      messId,
      actorUserId: adminUserId,
      action: AuditAction.PERIOD_ADJUSTMENT,
      targetType: dto.targetType,
      targetId: dto.targetId,
      notes: dto.reason,
      newState: { adjustedAmount: dto.adjustedAmount },
    });

    return adjustment;
  }

  async listAdjustments(messId: string, periodId: string) {
    return prisma.periodAdjustment.findMany({
      where: { messId, accountingPeriodId: periodId },
      orderBy: { appliedAt: 'desc' },
    });
  }
}

export const periodCloseService = new PeriodCloseService();
