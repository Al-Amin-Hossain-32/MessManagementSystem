import { z } from 'zod';
import { DisputeTargetType } from '@messmess/types';

export const raiseDisputeSchema = z.object({
  accountingPeriodId: z.string().cuid().optional(),
  targetType: z.nativeEnum(DisputeTargetType),
  targetId: z.string().cuid(),
  description: z.string().min(5, 'Please describe the issue').max(1000),
});

export const resolveDisputeSchema = z.object({
  resolution: z.string().min(3, 'Please describe the resolution').max(1000),
});

export const dismissDisputeSchema = z.object({
  reason: z.string().min(3, 'A reason is required').max(1000),
});

export const listDisputesQuerySchema = z.object({
  accountingPeriodId: z.string().cuid().optional(),
  status: z.enum(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED', 'ESCALATED']).optional(),
});

export type RaiseDisputeDto = z.infer<typeof raiseDisputeSchema>;
