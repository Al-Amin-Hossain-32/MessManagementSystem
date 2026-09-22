import { z } from 'zod';
import { PaymentMethod, PaymentStatus } from '@messmess/types';

export const recordCashPaymentSchema = z.object({
  boarderMembershipId: z.string().cuid(),
  amount: z.number().positive('amount must be greater than 0'),
  notes: z.string().max(500).optional(),
});

export const submitDigitalPaymentSchema = z.object({
  method: z
    .nativeEnum(PaymentMethod)
    .refine((m) => m !== PaymentMethod.CASH, {
      message: 'Use the cash-payment endpoint for CASH payments',
    }),
  amount: z.number().positive('amount must be greater than 0'),
  transactionRef: z.string().min(3).max(100),
  proofRef: z.string().url().optional(),
  notes: z.string().max(500).optional(),
});

export const rejectPaymentSchema = z.object({
  reason: z.string().min(3, 'A rejection reason is required').max(500),
});

export const disputePaymentSchema = z.object({
  reason: z.string().min(3, 'Please describe the discrepancy').max(500),
});

export const resolveDisputeSchema = z.object({
  decision: z.enum(['CONFIRMED', 'REJECTED']),
  reason: z.string().min(3).max(500).optional(),
});

export const reversePaymentSchema = z.object({
  reason: z.string().min(3, 'A reversal reason is required').max(500),
  correctingPaymentId: z.string().cuid().optional(),
});

export const listPaymentsQuerySchema = z.object({
  accountingPeriodId: z.string().cuid().optional(),
  status: z.nativeEnum(PaymentStatus).optional(),
});

export type RecordCashPaymentDto = z.infer<typeof recordCashPaymentSchema>;
export type SubmitDigitalPaymentDto = z.infer<typeof submitDigitalPaymentSchema>;
export type ResolveDisputeDto = z.infer<typeof resolveDisputeSchema>;
export type ReversePaymentDto = z.infer<typeof reversePaymentSchema>;
