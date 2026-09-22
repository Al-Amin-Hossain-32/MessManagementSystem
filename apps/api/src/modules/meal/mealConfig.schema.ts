import { z } from 'zod';
import { MealType } from '@messmess/types';

const mealTypeConfigSchema = z.object({
  type: z.nativeEnum(MealType),
  label: z.string().min(1).max(50),
  weight: z.number().positive('weight must be greater than 0').max(10),
  isActive: z.boolean().default(true),
  optOutDeadline: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'optOutDeadline must be in HH:MM (24h) format'),
});

export const upsertMealConfigSchema = z.object({
  mealTypes: z
    .array(mealTypeConfigSchema)
    .min(1, 'At least one meal type is required')
    .refine(
      (types) => new Set(types.map((t) => t.type)).size === types.length,
      { message: 'Each meal type may only be configured once' },
    ),
});

export type UpsertMealConfigDto = z.infer<typeof upsertMealConfigSchema>;
