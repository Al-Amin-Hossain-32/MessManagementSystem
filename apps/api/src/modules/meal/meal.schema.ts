import { z } from 'zod';
import { MealType, MealRecordStatus } from '@messmess/types';
import { dateSchema } from '../../lib/validators';

export { dateSchema };

export const optOutSchema = z.object({
  date: dateSchema,
  mealType: z.nativeEnum(MealType),
});

export const generateMealsSchema = z.object({
  date: dateSchema.optional(), // defaults to today (server local date) in the service
});

export const listMealsQuerySchema = z.object({
  date: dateSchema.optional(),
});

const CORRECTABLE_STATUSES = [
  MealRecordStatus.DEFAULT_ON,
  MealRecordStatus.OPTED_OUT,
] as const;

export const requestCorrectionSchema = z
  .object({
    requestedStatus: z.enum(CORRECTABLE_STATUSES).optional(),
    requestedWeight: z.number().positive().max(10).optional(),
    reason: z.string().min(3, 'Please explain the requested correction').max(500),
  })
  .refine((data) => data.requestedStatus !== undefined || data.requestedWeight !== undefined, {
    message: 'Provide at least one of requestedStatus or requestedWeight',
  });

export const reviewCorrectionSchema = z.object({
  reviewNotes: z.string().max(500).optional(),
});

export type OptOutDto = z.infer<typeof optOutSchema>;
export type GenerateMealsDto = z.infer<typeof generateMealsSchema>;
export type RequestCorrectionDto = z.infer<typeof requestCorrectionSchema>;
export type ReviewCorrectionDto = z.infer<typeof reviewCorrectionSchema>;
