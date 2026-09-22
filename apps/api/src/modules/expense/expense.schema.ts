import { z } from 'zod';
import { ExpenseStatus } from '@messmess/types';
import { dateSchema } from '../../lib/validators';

export const createExpenseSchema = z.object({
  categoryId: z.string().cuid(),
  amount: z.number().positive('amount must be greater than 0'),
  description: z.string().min(2).max(500),
  date: dateSchema,
  receiptRef: z.string().url().optional(),
  // Only meaningful (and required, checked in the service) when the
  // category's distributionMethod is DIRECT_CHARGE.
  directChargeBoarderMembershipId: z.string().cuid().optional(),
  // SRS §15: "Expense = ACTIVE (or DRAFT pending Admin confirm, per Mess
  // config)". No such per-Mess config field exists in the schema, so this is
  // decided per-request instead — a documented simplification.
  asDraft: z.boolean().default(false),
});

export const rejectExpenseSchema = z.object({
  reason: z.string().min(3, 'A rejection reason is required').max(500),
});

export const reverseExpenseSchema = z.object({
  reason: z.string().min(3, 'A reversal reason is required').max(500),
  correctingExpenseId: z.string().cuid().optional(),
});

export const listExpensesQuerySchema = z.object({
  accountingPeriodId: z.string().cuid().optional(),
  status: z.nativeEnum(ExpenseStatus).optional(),
});

export type CreateExpenseDto = z.infer<typeof createExpenseSchema>;
export type RejectExpenseDto = z.infer<typeof rejectExpenseSchema>;
export type ReverseExpenseDto = z.infer<typeof reverseExpenseSchema>;
