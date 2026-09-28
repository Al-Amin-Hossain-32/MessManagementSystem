import { z } from 'zod';

export const updateMessShopLinkSchema = z.object({
  defaultExpenseCategoryId: z.string().cuid(),
});
