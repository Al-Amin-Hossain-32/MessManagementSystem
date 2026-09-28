import { z } from 'zod';
import { StockStatus } from '@messmess/types';

export const createProductSchema = z.object({
  name: z.string().min(2).max(150),
  category: z.string().max(100).optional(),
  unit: z.string().min(1).max(20), // e.g. "kg", "litre", "piece"
  basePrice: z.number().positive(),
  stockStatus: z.nativeEnum(StockStatus).default(StockStatus.IN_STOCK),
});

export const updateProductSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  category: z.string().max(100).optional(),
  unit: z.string().min(1).max(20).optional(),
  basePrice: z.number().positive().optional(),
  stockStatus: z.nativeEnum(StockStatus).optional(),
  isActive: z.boolean().optional(),
});

export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
