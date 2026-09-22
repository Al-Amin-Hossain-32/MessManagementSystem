import { z } from 'zod';
import { MealType, GuestMealChargingPolicy } from '@messmess/types';
import { dateSchema } from './meal.schema';

export const upsertGuestMealConfigSchema = z.object({
  chargingPolicy: z.nativeEnum(GuestMealChargingPolicy),
  requiresGuestInfo: z.boolean().default(false),
  rateMultiplier: z.number().positive().max(10).default(1),
});

/**
 * appliedRate is accepted directly from the recorder (Manager/Admin) for V1.
 * The "real" per-meal boarder rate does not exist until the Phase 6
 * Accounting Engine calculates finalMealRate at month-end, so we cannot yet
 * auto-derive appliedRate = liveMealRate x rateMultiplier. Phase 6 should
 * reconcile/backfill this when the period closes if chargingPolicy implies
 * rate parity with boarders.
 */
export const recordGuestMealSchema = z.object({
  hostBoarderMembershipId: z.string().cuid('A host Boarder must be specified'),
  date: dateSchema,
  mealType: z.nativeEnum(MealType),
  quantity: z.number().int().positive().max(50).default(1),
  guestName: z.string().max(100).optional(),
  guestInfo: z.record(z.string(), z.unknown()).optional(),
  appliedRate: z.number().nonnegative(),
});

export const disputeGuestMealSchema = z.object({
  reason: z.string().min(3).max(500),
});

export type UpsertGuestMealConfigDto = z.infer<typeof upsertGuestMealConfigSchema>;
export type RecordGuestMealDto = z.infer<typeof recordGuestMealSchema>;
