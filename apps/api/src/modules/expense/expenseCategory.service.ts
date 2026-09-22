import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { auditService } from '../../lib/audit.service';
import { NotFoundError, ConflictError } from '../../lib/errors';
import { BoarderMembershipStatus, ExpenseEligibleScope, AuditAction } from '@messmess/types';
import type { CreateExpenseCategoryDto, UpdateExpenseCategoryDto } from './expenseCategory.schema';

class ExpenseCategoryService {
  async create(messId: string, adminUserId: string, dto: CreateExpenseCategoryDto) {
    if (dto.eligibleMemberScope === ExpenseEligibleScope.SELECTED_MEMBERS) {
      await this.validateSelectedMembers(messId, dto.selectedMemberIds!);
    }

    try {
      const category = await prisma.expenseCategory.create({
        data: {
          messId,
          name: dto.name,
          countsTowardMealRate: dto.countsTowardMealRate,
          distributionMethod: dto.distributionMethod,
          eligibleMemberScope: dto.eligibleMemberScope,
          selectedMemberIds: dto.selectedMemberIds ?? [],
          createdBy: adminUserId,
        },
      });

      await auditService.log({
        messId,
        actorUserId: adminUserId,
        action: AuditAction.EXPENSE_CATEGORY_CREATED,
        targetType: 'ExpenseCategory',
        targetId: category.id,
        newState: { name: dto.name, distributionMethod: dto.distributionMethod },
      });

      return category;
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError(`A category named "${dto.name}" already exists for this Mess`);
      }
      throw err;
    }
  }

  async update(
    messId: string,
    adminUserId: string,
    categoryId: string,
    dto: UpdateExpenseCategoryDto,
  ) {
    const existing = await prisma.expenseCategory.findUnique({ where: { id: categoryId } });
    if (!existing || existing.messId !== messId) throw new NotFoundError('Expense category');

    const finalScope = dto.eligibleMemberScope ?? existing.eligibleMemberScope;
    const finalSelected = dto.selectedMemberIds ?? existing.selectedMemberIds;
    if (finalScope === ExpenseEligibleScope.SELECTED_MEMBERS) {
      if (finalSelected.length === 0) {
        throw new ConflictError('selectedMemberIds cannot be empty when scope is SELECTED_MEMBERS');
      }
      await this.validateSelectedMembers(messId, finalSelected);
    }

    try {
      const category = await prisma.expenseCategory.update({
        where: { id: categoryId },
        data: dto,
      });

      await auditService.log({
        messId,
        actorUserId: adminUserId,
        action: AuditAction.EXPENSE_CATEGORY_UPDATED,
        targetType: 'ExpenseCategory',
        targetId: category.id,
        previousState: existing,
        newState: dto,
      });

      return category;
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError(`A category named "${dto.name}" already exists for this Mess`);
      }
      throw err;
    }
  }

  async list(messId: string, activeOnly = false) {
    return prisma.expenseCategory.findMany({
      where: { messId, ...(activeOnly && { isActive: true }) },
      orderBy: { name: 'asc' },
    });
  }

  async getById(messId: string, categoryId: string) {
    const category = await prisma.expenseCategory.findUnique({ where: { id: categoryId } });
    if (!category || category.messId !== messId) throw new NotFoundError('Expense category');
    return category;
  }

  private async validateSelectedMembers(messId: string, ids: string[]) {
    const count = await prisma.boarderMembership.count({
      where: { id: { in: ids }, messId, status: BoarderMembershipStatus.ACTIVE },
    });
    if (count !== ids.length) {
      throw new ConflictError(
        'One or more selectedMemberIds are not active Boarders of this Mess',
      );
    }
  }
}

export const expenseCategoryService = new ExpenseCategoryService();
