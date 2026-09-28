import { z } from 'zod';

export const createShopSchema = z.object({
  name: z.string().min(2).max(100),
  managedByUserId: z.string().cuid('A Shop Admin user must be specified'),
  vendorId: z.string().cuid().optional(), // defaults to the platform Vendor
  isDefault: z.boolean().default(false),
});

export const updateShopSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED']).optional(),
});

export const reassignShopAdminSchema = z.object({
  managedByUserId: z.string().cuid(),
});

export type CreateShopDto = z.infer<typeof createShopSchema>;
export type UpdateShopDto = z.infer<typeof updateShopSchema>;
