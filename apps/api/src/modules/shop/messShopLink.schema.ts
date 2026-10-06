import { z } from 'zod';

export const linkShopSchema = z.object({
  shopId: z.string().cuid(),
});

export const updateMessShopLinkSchema = z.object({
  defaultExpenseCategoryId: z.string().cuid(),
});
