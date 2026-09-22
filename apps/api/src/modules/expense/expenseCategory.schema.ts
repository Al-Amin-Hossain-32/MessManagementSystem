import { z } from 'zod';
import { ExpenseDistributionMethod, ExpenseEligibleScope } from '@messmess/types';

export const createExpenseCategorySchema = z
  .object({
    name: z.string().min(2).max(100),
    countsTowardMealRate: z.boolean().default(false),
    distributionMethod: z.nativeEnum(ExpenseDistributionMethod),
    eligibleMemberScope: z.nativeEnum(ExpenseEligibleScope).default(ExpenseEligibleScope.ALL),
    selectedMemberIds: z.array(z.string().cuid()).optional(),
  })
  .refine(
    (data) =>
      data.eligibleMemberScope !== ExpenseEligibleScope.SELECTED_MEMBERS ||
      (data.selectedMemberIds && data.selectedMemberIds.length > 0),
    {
      message: 'selectedMemberIds is required when eligibleMemberScope is SELECTED_MEMBERS',
      path: ['selectedMemberIds'],
    },
  );

export const updateExpenseCategorySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  countsTowardMealRate: z.boolean().optional(),
  distributionMethod: z.nativeEnum(ExpenseDistributionMethod).optional(),
  eligibleMemberScope: z.nativeEnum(ExpenseEligibleScope).optional(),
  selectedMemberIds: z.array(z.string().cuid()).optional(),
  isActive: z.boolean().optional(),
});
// Cross-field validation (SELECTED_MEMBERS requires a non-empty list) is
// checked in the service layer for updates, since a PATCH may change only
// one of the two related fields at a time — a static .refine() here cannot
// see the pre-existing category state.

export type CreateExpenseCategoryDto = z.infer<typeof createExpenseCategorySchema>;
export type UpdateExpenseCategoryDto = z.infer<typeof updateExpenseCategorySchema>;
