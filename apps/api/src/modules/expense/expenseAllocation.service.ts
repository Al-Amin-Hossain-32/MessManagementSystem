import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { auditService } from '../../lib/audit.service';
import { NotFoundError } from '../../lib/errors';
import {
  BoarderMembershipStatus,
  BoarderResidencyType,
  ExpenseEligibleScope,
  ExpenseStatus,
  MealRecordStatus,
  AuditAction,
} from '@messmess/types';
import { allocationStrategies, type EligibleBoarder, type AllocationResult } from './allocationStrategies';

type BoarderWithResidency = {
  id: string;
  residencies: { type: BoarderResidencyType }[];
};

type CategoryForFilter = {
  eligibleMemberScope: ExpenseEligibleScope;
  selectedMemberIds: string[];
};

class ExpenseAllocationService {
  /**
   * Recalculates and persists ExpenseAllocation rows for every ACTIVE
   * Expense in the given period. Safe to re-run any number of times while
   * the period is still open (ACTIVE) — each run clears and rebuilds
   * allocations for the affected expenses, so this doubles as a live
   * "running total" the Mess Admin/Manager can check mid-month.
   *
   * Phase 6 will call this same method at period-PREPARING time as the
   * authoritative final calculation, then lock the period (no more expenses
   * can be added/changed) — this method itself has no concept of "final".
   */
  async allocateForPeriod(messId: string, periodId: string, triggeredByUserId: string) {
    const period = await prisma.accountingPeriod.findUnique({ where: { id: periodId } });
    if (!period || period.messId !== messId) throw new NotFoundError('AccountingPeriod');

    const expenses = await prisma.expense.findMany({
      where: {
        messId,
        accountingPeriodId: periodId,
        status: ExpenseStatus.ACTIVE,
        // Expenses that count toward the meal rate are distributed via the
        // mealCost formula (weightedMeals x finalMealRate) in Phase 6's
        // statement calculation instead — NOT via this per-category engine.
        // Including them here would double-charge Boarders.
        category: { countsTowardMealRate: false },
      },
      include: { category: true },
    });
    if (expenses.length === 0) return { expensesProcessed: 0 };

    const [allBoarders, weightedMealsByBoarder] = await Promise.all([
      prisma.boarderMembership.findMany({
        where: { messId, status: BoarderMembershipStatus.ACTIVE },
        select: { id: true, residencies: { where: { effectiveTo: null }, select: { type: true } } },
      }),
      this.computeWeightedMeals(messId, periodId),
    ]);

    const plannedAllocations: { expenseId: string; allocations: AllocationResult[] }[] = [];

    for (const expense of expenses) {
      const eligible: EligibleBoarder[] = this.filterEligible(allBoarders, expense.category).map(
        (b) => ({
          boarderMembershipId: b.id,
          weightedMeals: weightedMealsByBoarder.get(b.id) ?? new Prisma.Decimal(0),
        }),
      );

      const strategy = allocationStrategies[expense.category.distributionMethod];
      const allocations = strategy.allocate(
        new Prisma.Decimal(expense.amount),
        eligible,
        expense.directChargeBoarderMembershipId,
      );

      plannedAllocations.push({ expenseId: expense.id, allocations });
    }

    await prisma.$transaction(async (tx) => {
      for (const { expenseId, allocations } of plannedAllocations) {
        await tx.expenseAllocation.deleteMany({ where: { expenseId } });
        if (allocations.length > 0) {
          await tx.expenseAllocation.createMany({
            data: allocations.map((a) => ({
              expenseId,
              boarderMembershipId: a.boarderMembershipId,
              allocatedAmount: a.allocatedAmount,
              calculationSnapshot: a.calculationSnapshot as Prisma.InputJsonValue,
            })),
          });
        }
      }
    });

    await auditService.log({
      messId,
      actorUserId: triggeredByUserId,
      action: AuditAction.EXPENSE_ALLOCATED,
      targetType: 'AccountingPeriod',
      targetId: periodId,
      notes: `Recalculated allocations for ${expenses.length} expense(s)`,
    });

    return { expensesProcessed: expenses.length };
  }

  async getAllocationSummaryForPeriod(messId: string, periodId: string) {
    const period = await prisma.accountingPeriod.findUnique({ where: { id: periodId } });
    if (!period || period.messId !== messId) throw new NotFoundError('AccountingPeriod');

    const allocations = await prisma.expenseAllocation.findMany({
      where: { expense: { messId, accountingPeriodId: periodId } },
      include: { boarderMembership: { include: { user: { select: { id: true, name: true } } } } },
    });

    const totalsByBoarder = new Map<
      string,
      { boarderMembershipId: string; name: string; total: Prisma.Decimal }
    >();
    for (const allocation of allocations) {
      const key = allocation.boarderMembershipId;
      const existing = totalsByBoarder.get(key);
      const amount = new Prisma.Decimal(allocation.allocatedAmount);
      if (existing) {
        existing.total = existing.total.add(amount);
      } else {
        totalsByBoarder.set(key, {
          boarderMembershipId: key,
          name: allocation.boarderMembership.user.name,
          total: amount,
        });
      }
    }

    return Array.from(totalsByBoarder.values()).map((t) => ({ ...t, total: t.total.toString() }));
  }

  private filterEligible(
    boarders: BoarderWithResidency[],
    category: CategoryForFilter,
  ): BoarderWithResidency[] {
    switch (category.eligibleMemberScope) {
      case ExpenseEligibleScope.RESIDENT_ONLY:
        return boarders.filter((b) => b.residencies[0]?.type === BoarderResidencyType.RESIDENT);
      case ExpenseEligibleScope.MEAL_ONLY:
        return boarders.filter((b) => b.residencies[0]?.type === BoarderResidencyType.MEAL_ONLY);
      case ExpenseEligibleScope.SELECTED_MEMBERS:
        return boarders.filter((b) => category.selectedMemberIds.includes(b.id));
      case ExpenseEligibleScope.ALL:
      default:
        return boarders;
    }
  }

  /**
   * "Counted" weighted meals = every MealRecord except OPTED_OUT. FINALIZED
   * only exists after Phase 6 closes the period, so during an ACTIVE period
   * this is necessarily a running estimate, not the final total.
   */
  private async computeWeightedMeals(
    messId: string,
    periodId: string,
  ): Promise<Map<string, Prisma.Decimal>> {
    const grouped = await prisma.mealRecord.groupBy({
      by: ['boarderMembershipId'],
      where: {
        messId,
        accountingPeriodId: periodId,
        status: { not: MealRecordStatus.OPTED_OUT },
      },
      _sum: { weight: true },
    });

    const map = new Map<string, Prisma.Decimal>();
    for (const row of grouped) {
      map.set(row.boarderMembershipId, new Prisma.Decimal(row._sum.weight ?? 0));
    }
    return map;
  }
}

export const expenseAllocationService = new ExpenseAllocationService();
