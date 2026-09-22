import { z } from 'zod';

export const createMessSchema = z.object({
  name: z.string().min(3, 'Mess name must be at least 3 characters').max(100),
  address: z.string().max(500).optional(),
  description: z.string().max(1000).optional(),
});

export const updateMessSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  address: z.string().max(500).optional(),
  description: z.string().max(1000).optional(),
});

export const inviteCoAdminSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
});

export const inviteDirectorSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
});

export type CreateMessDto = z.infer<typeof createMessSchema>;
export type UpdateMessDto = z.infer<typeof updateMessSchema>;
