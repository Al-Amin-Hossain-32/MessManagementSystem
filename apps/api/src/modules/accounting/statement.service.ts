import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../lib/errors';
import {
  MealRecordStatus,
  ExpenseDistributionMethod,
  PaymentStatus,
  AccountingPeriodStatus,
} from '@messmess/types';

type BoarderAllocationTotals = { nonMeal: Prisma.Decimal; direct: Prisma.Decimal };

class StatementService {
  /**
   * Computes and persists BoarderMonthlyStatement rows for every Boarder
   * with financial activity in the period (this correctly includes a
   * Boarder who left mid-month, since their records stay tied to
   * accountingPeriodId). Re-runnable while UNDER_REVIEW (e.g. after a
   * correction) — upserts rather than duplicating.
   */
  async generateStatementsForPeriod(messId: string, periodId: string) {
    const period = await prisma.accountingPeriod.findUniqueOrThrow({ where: { id: periodId } });
    const finalMealRate = new Prisma.Decimal(period.finalMealRate ?? 0);

    const boarderIds = await this.collectActiveBoarderIds(messId, periodId);
    if (boarderIds.size === 0) return { statementsGenerated: 0 };

    const [weightedMeals, allocations, hostGuestCharges, poolShare, confirmedPayments, openingBalances] =
      await Promise.all([
        this.computeFinalizedWeightedMeals(messId, periodId),
        this.computeExpenseAllocations(messId, periodId),
        this.computeHostGuestCharges(messId, periodId),
        this.computeGuestMealPoolShare(messId, periodId, boarderIds.size),
        this.computeConfirmedPayments(messId, periodId),
        this.getPreviousClosingBalances(messId, periodId, Array.from(boarderIds)),
      ]);

    const rows: Prisma.BoarderMonthlyStatementUncheckedCreateInput[] = [];

    for (const boarderMembershipId of boarderIds) {
      const boarderWeightedMeals = weightedMeals.get(boarderMembershipId) ?? new Prisma.Decimal(0);
      const mealCost = boarderWeightedMeals.mul(finalMealRate).toDecimalPlaces(2);

      const hostCharge = hostGuestCharges.get(boarderMembershipId) ?? new Prisma.Decimal(0);
      const guestMealCharge = hostCharge.add(poolShare).toDecimalPlaces(2);

      const alloc: BoarderAllocationTotals = allocations.get(boarderMembershipId) ?? {
        nonMeal: new Prisma.Decimal(0),
        direct: new Prisma.Decimal(0),
      };

      const openingBalance = openingBalances.get(boarderMembershipId) ?? new Prisma.Decimal(0);

      const totalDue = mealCost
        .add(guestMealCharge)
        .add(alloc.nonMeal)
        .add(alloc.direct)
        .add(openingBalance)
        .toDecimalPlaces(2);

      const confirmedPaymentsTotal = confirmedPayments.get(boarderMembershipId) ?? new Prisma.Decimal(0);
      const closingBalance = totalDue.sub(confirmedPaymentsTotal).toDecimalPlaces(2);

      rows.push({
        boarderMembershipId,
        accountingPeriodId: periodId,
        messId,
        mealCost,
        guestMealCharge,
        totalExpenseAllocation: alloc.nonMeal,
        directCharges: alloc.direct,
        openingBalance,
        totalDue,
        confirmedPayments: confirmedPaymentsTotal,
        closingBalance,
        isAdjusted: false,
        calculationSnapshot: {
          weightedMeals: boarderWeightedMeals.toString(),
          finalMealRate: finalMealRate.toString(),
          hostGuestCharge: hostCharge.toString(),
          guestMealPoolShare: poolShare.toString(),
          calculatedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      });
    }

    await prisma.$transaction(
      rows.map((row) =>
        prisma.boarderMonthlyStatement.upsert({
          where: {
            boarderMembershipId_accountingPeriodId: {
              boarderMembershipId: row.boarderMembershipId,
              accountingPeriodId: periodId,
            },
          },
          create: row,
          update: row,
        }),
      ),
    );

    return { statementsGenerated: rows.length };
  }

  async getStatement(messId: string, statementId: string) {
    const statement = await prisma.boarderMonthlyStatement.findUnique({
      where: { id: statementId },
      include: { boarderMembership: { include: { user: { select: { id: true, name: true } } } } },
    });
    if (!statement || statement.messId !== messId) throw new NotFoundError('Statement');
    return statement;
  }

  async listStatementsForPeriod(messId: string, periodId: string) {
    return prisma.boarderMonthlyStatement.findMany({
      where: { messId, accountingPeriodId: periodId },
      include: { boarderMembership: { include: { user: { select: { id: true, name: true } } } } },
      orderBy: { closingBalance: 'desc' },
    });
  }

  async getMyStatement(messId: string, userId: string, periodId: string) {
    const statement = await prisma.boarderMonthlyStatement.findFirst({
      where: { messId, accountingPeriodId: periodId, boarderMembership: { userId } },
    });
    if (!statement) throw new NotFoundError('Statement');
    return statement;
  }

  async getMyStatementHistory(messId: string, userId: string, limit = 12) {
    return prisma.boarderMonthlyStatement.findMany({
      where: { messId, boarderMembership: { userId } },
      include: { accountingPeriod: { select: { periodLabel: true, status: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ─── Aggregation helpers ────────────────────────────────────────────────────

  private async collectActiveBoarderIds(messId: string, periodId: string): Promise<Set<string>> {
    const [meals, allocations, payments, guestHosts] = await Promise.all([
      prisma.mealRecord.findMany({
        where: { messId, accountingPeriodId: periodId },
        distinct: ['boarderMembershipId'],
        select: { boarderMembershipId: true },
      }),
      prisma.expenseAllocation.findMany({
        where: { expense: { messId, accountingPeriodId: periodId } },
        distinct: ['boarderMembershipId'],
        select: { boarderMembershipId: true },
      }),
      prisma.payment.findMany({
        where: { messId, accountingPeriodId: periodId, status: PaymentStatus.CONFIRMED },
        distinct: ['boarderMembershipId'],
        select: { boarderMembershipId: true },
      }),
      prisma.guestMeal.findMany({
        where: { messId, accountingPeriodId: periodId },
        distinct: ['hostBoarderMembershipId'],
        select: { hostBoarderMembershipId: true },
      }),
    ]);

    const ids = new Set<string>();
    meals.forEach((r) => ids.add(r.boarderMembershipId));
    allocations.forEach((r) => ids.add(r.boarderMembershipId));
    payments.forEach((r) => ids.add(r.boarderMembershipId));
    guestHosts.forEach((r) => ids.add(r.hostBoarderMembershipId));
    return ids;
  }

  /** Only FINALIZED/CORRECTED count — caller must finalize meal records first. */
  private async computeFinalizedWeightedMeals(
    messId: string,
    periodId: string,
  ): Promise<Map<string, Prisma.Decimal>> {
    const grouped = await prisma.mealRecord.groupBy({
      by: ['boarderMembershipId'],
      where: {
        messId,
        accountingPeriodId: periodId,
        status: { in: [MealRecordStatus.FINALIZED, MealRecordStatus.CORRECTED] },
      },
      _sum: { weight: true },
    });
    const map = new Map<string, Prisma.Decimal>();
    for (const row of grouped) map.set(row.boarderMembershipId, new Prisma.Decimal(row._sum.weight ?? 0));
    return map;
  }

  /**
   * Splits ExpenseAllocation rows into nonMeal (EQUAL_SPLIT/MEAL_PROPORTIONAL)
   * vs direct (DIRECT_CHARGE) per boarder — mirrors the Boarder Monthly
   * Statement's separate `totalExpenseAllocation` and `directCharges` fields.
   */
  private async computeExpenseAllocations(
    messId: string,
    periodId: string,
  ): Promise<Map<string, BoarderAllocationTotals>> {
    const allocations = await prisma.expenseAllocation.findMany({
      where: { expense: { messId, accountingPeriodId: periodId } },
      include: { expense: { include: { category: true } } },
    });

    const map = new Map<string, BoarderAllocationTotals>();
    for (const allocation of allocations) {
      const entry = map.get(allocation.boarderMembershipId) ?? {
        nonMeal: new Prisma.Decimal(0),
        direct: new Prisma.Decimal(0),
      };
      const amount = new Prisma.Decimal(allocation.allocatedAmount);
      if (allocation.expense.category.distributionMethod === ExpenseDistributionMethod.DIRECT_CHARGE) {
        entry.direct = entry.direct.add(amount);
      } else {
        entry.nonMeal = entry.nonMeal.add(amount);
      }
      map.set(allocation.boarderMembershipId, entry);
    }
    return map;
  }

  private async computeHostGuestCharges(
    messId: string,
    periodId: string,
  ): Promise<Map<string, Prisma.Decimal>> {
    const grouped = await prisma.guestMeal.groupBy({
      by: ['hostBoarderMembershipId'],
      where: { messId, accountingPeriodId: periodId, chargedToHost: true },
      _sum: { totalCharge: true },
    });
    const map = new Map<string, Prisma.Decimal>();
    for (const row of grouped) {
      map.set(row.hostBoarderMembershipId, new Prisma.Decimal(row._sum.totalCharge ?? 0));
    }
    return map;
  }

  /**
   * SHARED_POOL guest meals (chargedToHost=false) split equally across every
   * Boarder receiving a statement this period. SRS §14 does not specify a
   * finer eligibility scope for the pool (unlike ExpenseCategory), so equal
   * split across all statement recipients is the documented default.
   */
  private async computeGuestMealPoolShare(
    messId: string,
    periodId: string,
    boarderCount: number,
  ): Promise<Prisma.Decimal> {
    if (boarderCount === 0) return new Prisma.Decimal(0);
    const pool = await prisma.guestMeal.aggregate({
      where: { messId, accountingPeriodId: periodId, chargedToHost: false },
      _sum: { totalCharge: true },
    });
    const total = new Prisma.Decimal(pool._sum.totalCharge ?? 0);
    return total.isZero() ? total : total.div(boarderCount);
  }

  private async computeConfirmedPayments(
    messId: string,
    periodId: string,
  ): Promise<Map<string, Prisma.Decimal>> {
    const grouped = await prisma.payment.groupBy({
      by: ['boarderMembershipId'],
      where: { messId, accountingPeriodId: periodId, status: PaymentStatus.CONFIRMED },
      _sum: { amount: true },
    });
    const map = new Map<string, Prisma.Decimal>();
    for (const row of grouped) map.set(row.boarderMembershipId, new Prisma.Decimal(row._sum.amount ?? 0));
    return map;
  }

  /**
   * Opening balance = the immediately-prior CLOSED period's closingBalance
   * for the SAME boarderMembershipId. Continuity breaks if a Boarder left
   * and re-joined (a re-join creates a new BoarderMembership row per the
   * One-Active-Mess rule) — their new membership starts at 0. This is a
   * documented V1 simplification.
   */
  private async getPreviousClosingBalances(
    messId: string,
    periodId: string,
    boarderMembershipIds: string[],
  ): Promise<Map<string, Prisma.Decimal>> {
    const map = new Map<string, Prisma.Decimal>();
    const currentPeriod = await prisma.accountingPeriod.findUniqueOrThrow({ where: { id: periodId } });

    const previousPeriod = await prisma.accountingPeriod.findFirst({
      where: { messId, status: AccountingPeriodStatus.CLOSED, endDate: { lt: currentPeriod.startDate } },
      orderBy: { endDate: 'desc' },
    });
    if (!previousPeriod) return map;

    const previousStatements = await prisma.boarderMonthlyStatement.findMany({
      where: { accountingPeriodId: previousPeriod.id, boarderMembershipId: { in: boarderMembershipIds } },
      select: { boarderMembershipId: true, closingBalance: true },
    });
    for (const s of previousStatements) {
      map.set(s.boarderMembershipId, new Prisma.Decimal(s.closingBalance));
    }
    return map;
  }
}

export const statementService = new StatementService();
