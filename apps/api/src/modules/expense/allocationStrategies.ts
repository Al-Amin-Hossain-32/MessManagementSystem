import { Prisma } from '@prisma/client';

export interface EligibleBoarder {
  boarderMembershipId: string;
  weightedMeals: Prisma.Decimal;
}

export interface AllocationResult {
  boarderMembershipId: string;
  allocatedAmount: Prisma.Decimal;
  calculationSnapshot: Record<string, unknown>;
}

export interface AllocationStrategy {
  allocate(
    totalAmount: Prisma.Decimal,
    eligibleBoarders: EligibleBoarder[],
    directChargeBoarderMembershipId?: string | null,
  ): AllocationResult[];
}

/**
 * Rounds every allocation to 2dp, then folds the rounding remainder into the
 * last allocation so the sum always reconciles exactly to totalAmount — a
 * split can never silently gain or lose a paisa/cent.
 */
function reconcileRounding(
  totalAmount: Prisma.Decimal,
  results: AllocationResult[],
): AllocationResult[] {
  if (results.length === 0) return results;
  const rounded = results.map((r) => ({ ...r, allocatedAmount: r.allocatedAmount.toDecimalPlaces(2) }));
  const sum = rounded.reduce((s, r) => s.add(r.allocatedAmount), new Prisma.Decimal(0));
  const diff = totalAmount.sub(sum);
  if (!diff.isZero()) {
    const last = rounded[rounded.length - 1];
    last.allocatedAmount = last.allocatedAmount.add(diff);
  }
  return rounded;
}

class EqualSplitStrategy implements AllocationStrategy {
  allocate(totalAmount: Prisma.Decimal, eligibleBoarders: EligibleBoarder[]): AllocationResult[] {
    if (eligibleBoarders.length === 0) return [];
    const share = totalAmount.div(eligibleBoarders.length);
    const results = eligibleBoarders.map((b) => ({
      boarderMembershipId: b.boarderMembershipId,
      allocatedAmount: share,
      calculationSnapshot: {
        method: 'EQUAL_SPLIT',
        totalAmount: totalAmount.toString(),
        eligibleCount: eligibleBoarders.length,
      },
    }));
    return reconcileRounding(totalAmount, results);
  }
}

class MealProportionalStrategy implements AllocationStrategy {
  allocate(totalAmount: Prisma.Decimal, eligibleBoarders: EligibleBoarder[]): AllocationResult[] {
    const totalWeighted = eligibleBoarders.reduce(
      (sum, b) => sum.add(b.weightedMeals),
      new Prisma.Decimal(0),
    );
    // Zero-meal guard at the single-expense level (e.g. brand-new Mess with
    // no meals logged yet this period). SRS §17's period-wide
    // ACCOUNTING_EXCEPTION guard is Phase 6's concern at month-close.
    if (totalWeighted.isZero()) return [];

    const results = eligibleBoarders
      .filter((b) => !b.weightedMeals.isZero())
      .map((b) => ({
        boarderMembershipId: b.boarderMembershipId,
        allocatedAmount: totalAmount.mul(b.weightedMeals).div(totalWeighted),
        calculationSnapshot: {
          method: 'MEAL_PROPORTIONAL',
          totalAmount: totalAmount.toString(),
          boarderWeightedMeals: b.weightedMeals.toString(),
          totalWeightedMeals: totalWeighted.toString(),
        },
      }));
    return reconcileRounding(totalAmount, results);
  }
}

class DirectChargeStrategy implements AllocationStrategy {
  allocate(
    totalAmount: Prisma.Decimal,
    _eligibleBoarders: EligibleBoarder[],
    directChargeBoarderMembershipId?: string | null,
  ): AllocationResult[] {
    if (!directChargeBoarderMembershipId) return [];
    return [
      {
        boarderMembershipId: directChargeBoarderMembershipId,
        allocatedAmount: totalAmount,
        calculationSnapshot: { method: 'DIRECT_CHARGE', totalAmount: totalAmount.toString() },
      },
    ];
  }
}

/** Keyed by ExpenseDistributionMethod's string value. */
export const allocationStrategies: Record<string, AllocationStrategy> = {
  EQUAL_SPLIT: new EqualSplitStrategy(),
  MEAL_PROPORTIONAL: new MealProportionalStrategy(),
  DIRECT_CHARGE: new DirectChargeStrategy(),
};
