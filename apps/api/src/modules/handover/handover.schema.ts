import { z } from 'zod';
import { FundHandoverItemType } from '@messmess/types';

const declaredItemSchema = z.object({
  type: z.nativeEnum(FundHandoverItemType),
  declaredAmount: z.number().positive('declaredAmount must be greater than 0'),
  notes: z.string().max(500).optional(),
});

export const initiateHandoverSchema = z.object({
  incomingAssignmentId: z.string().cuid().optional(), // may be unknown at DRAFT time
  declaredItems: z.array(declaredItemSchema).min(1, 'At least one declared item is required'),
});

export const submitHandoverSchema = z.object({
  incomingAssignmentId: z.string().cuid('An incoming Manager assignment is required to submit'),
});

export const disputeHandoverSchema = z.object({
  disputeNotes: z.string().min(3, 'Please describe the discrepancy').max(1000),
});

export const resolveDisputeSchema = z.object({
  adjustedAmount: z.number().positive('adjustedAmount must be greater than 0'),
  notes: z.string().max(1000).optional(),
});

export type InitiateHandoverDto = z.infer<typeof initiateHandoverSchema>;
export type SubmitHandoverDto = z.infer<typeof submitHandoverSchema>;
export type DisputeHandoverDto = z.infer<typeof disputeHandoverSchema>;
export type ResolveDisputeDto = z.infer<typeof resolveDisputeSchema>;
