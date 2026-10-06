import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
  filter: z.enum(['all', 'unread', 'read']).default('all'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const notificationParamsSchema = z.object({
  notificationId: z.string().min(1).max(100),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
