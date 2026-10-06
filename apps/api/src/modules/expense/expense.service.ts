import { prisma } from '../../lib/prisma';
import { auditService } from '../../lib/audit.service';
import { periodService } from '../accounting/period.service';
import { NotFoundError, ConflictError } from '../../lib/errors';
import {
  BoarderMembershipStatus,
  ExpenseDistributionMethod,
  ExpenseSourceType,
  ExpenseStatus,
  AuditAction,
  NotificationType,
} from '@messmess/types';
import type { CreateExpenseDto } from './expense.schema';
import { notificationService } from '../notification/notification.service';

function parseDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

const DRAFT_STATUSES: ExpenseStatus[] = [ExpenseStatus.DRAFT, ExpenseStatus.DRAFT_FROM_SHOP];

class ExpenseService {
  async createExpense(messId: string, actorUserId: string, dto: CreateExpenseDto) {
    const category = await prisma.expenseCategory.findUnique({ where: { id: dto.categoryId } });
    if (!category || category.messId !== messId || !category.isActive) {
      throw new NotFoundError('Active expense category');
    }

    if (category.distributionMethod === ExpenseDistributionMethod.DIRECT_CHARGE) {
      if (!dto.directChargeBoarderMembershipId) {
        throw new ConflictError(
          'directChargeBoarderMembershipId is required for a DIRECT_CHARGE category',
        );
      }
      const target = await prisma.boarderMembership.findUnique({
        where: { id: dto.directChargeBoarderMembershipId },
      });
      if (!target || target.messId !== messId || target.status !== BoarderMembershipStatus.ACTIVE) {
        throw new NotFoundError('Active target Boarder for the direct charge');
      }
    } else if (dto.directChargeBoarderMembershipId) {
      throw new ConflictError(
        'directChargeBoarderMembershipId only applies to a DIRECT_CHARGE category',
      );
    }

    const date = parseDate(dto.date);
    const period = await periodService.getOrCreateActivePeriod(messId, actorUserId, date);

    const expense = await prisma.expense.create({
      data: {
        messId,
        accountingPeriodId: period.id,
        categoryId: dto.categoryId,
        sourceType: ExpenseSourceType.MANUAL_EXTERNAL,
        amount: dto.amount,
        description: dto.description,
        date,
        receiptRef: dto.receiptRef,
        status: dto.asDraft ? ExpenseStatus.DRAFT : ExpenseStatus.ACTIVE,
        recordedBy: actorUserId,
        directChargeBoarderMembershipId: dto.directChargeBoarderMembershipId,
      },
    });

    await auditService.log({
      messId,
      actorUserId,
      action: AuditAction.EXPENSE_CREATED,
      targetType: 'Expense',
      targetId: expense.id,
      newState: { amount: dto.amount, categoryId: dto.categoryId, status: expense.status },
    });

    if (expense.status === ExpenseStatus.ACTIVE) {
      await notificationService.notifyBoarders({
        messId,
        eventId: `expense.created:${expense.id}`,
        type: NotificationType.EXPENSE_CREATED,
        href: `/mess/${messId}/expenses`,
        params: { amount: dto.amount },
        excludeUserId: actorUserId,
      });
    }

    return expense;
  }

  /** Confirms a DRAFT or DRAFT_FROM_SHOP expense — makes it eligible for accounting. */
  async confirmDraft(messId: string, adminUserId: string, expenseId: string) {
    const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense || expense.messId !== messId) throw new NotFoundError('Expense');
    if (!DRAFT_STATUSES.includes(expense.status)) {
      throw new ConflictError('Only a DRAFT expense can be confirmed');
    }

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: { status: ExpenseStatus.ACTIVE, confirmedBy: adminUserId, confirmedAt: new Date() },
    });

    await auditService.log({
      messId,
      actorUserId: adminUserId,
      action: AuditAction.EXPENSE_CONFIRMED,
      targetType: 'Expense',
      targetId: updated.id,
    });

    return updated;
  }

  /** Rejects a still-DRAFT expense (SRS §35: e.g. a cancelled Shop order's draft). */
  async rejectExpense(messId: string, adminUserId: string, expenseId: string, reason: string) {
    const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense || expense.messId !== messId) throw new NotFoundError('Expense');
    if (!DRAFT_STATUSES.includes(expense.status)) {
      throw new ConflictError('Only a DRAFT expense can be rejected — use reversal for an ACTIVE one');
    }

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: { status: ExpenseStatus.REJECTED, rejectedBy: adminUserId, rejectionReason: reason },
    });

    await auditService.log({
      messId,
      actorUserId: adminUserId,
      action: AuditAction.EXPENSE_REJECTED,
      targetType: 'Expense',
      targetId: updated.id,
      notes: reason,
    });

    return updated;
  }

  /**
   * Reverses an ACTIVE (already-confirmed/eligible) expense. SRS §35:
   * "Manager/Admin creates reversal Expense + correcting Expense; original
   * not deleted." The original is never deleted or mutated beyond its status
   * — `correctingExpenseId` (a separately created Expense) may optionally be
   * linked via reversalRef for traceability.
   */
  async reverseExpense(
    messId: string,
    adminUserId: string,
    expenseId: string,
    reason: string,
    correctingExpenseId?: string,
  ) {
    const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense || expense.messId !== messId) throw new NotFoundError('Expense');
    if (expense.status !== ExpenseStatus.ACTIVE) {
      throw new ConflictError('Only an ACTIVE expense can be reversed');
    }

    if (correctingExpenseId) {
      const correcting = await prisma.expense.findUnique({ where: { id: correctingExpenseId } });
      if (!correcting || correcting.messId !== messId) {
        throw new NotFoundError('Correcting expense');
      }
    }

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: { status: ExpenseStatus.REVERSED, reversalRef: correctingExpenseId ?? null },
    });

    await auditService.log({
      messId,
      actorUserId: adminUserId,
      action: AuditAction.EXPENSE_REVERSED,
      targetType: 'Expense',
      targetId: updated.id,
      notes: reason,
      newState: { correctingExpenseId },
    });

    return updated;
  }

  async listExpenses(
    messId: string,
    filters: { accountingPeriodId?: string; status?: ExpenseStatus },
  ) {
    return prisma.expense.findMany({
      where: {
        messId,
        ...(filters.accountingPeriodId && { accountingPeriodId: filters.accountingPeriodId }),
        ...(filters.status && { status: filters.status }),
      },
      include: { category: { select: { id: true, name: true, distributionMethod: true } } },
      orderBy: { date: 'desc' },
    });
  }

  async getExpense(messId: string, expenseId: string) {
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        category: true,
        allocations: { include: { boarderMembership: { include: { user: { select: { name: true } } } } } },
      },
    });
    if (!expense || expense.messId !== messId) throw new NotFoundError('Expense');
    return expense;
  }
}

export const expenseService = new ExpenseService();
