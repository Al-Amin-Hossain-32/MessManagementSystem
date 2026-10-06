import { z } from 'zod';
import { OfflinePaymentMethod, SubscriptionPlan } from '@messmess/types';

export const createBillingRequestSchema = z.object({
  plan: z.nativeEnum(SubscriptionPlan),
  amount: z.number().positive().max(10000000),
  method: z.nativeEnum(OfflinePaymentMethod),
  paymentReference: z.string().trim().min(3).max(120),
  proofUrl: z.string().url().max(1000).refine((value) => /^https?:\/\//i.test(value), 'Proof URL must use http or https').optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const listBillingRequestsSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const billingRequestIdSchema = z.object({ requestId: z.string().cuid() });
export const rejectBillingRequestSchema = z.object({ reason: z.string().trim().min(3).max(1000) });
