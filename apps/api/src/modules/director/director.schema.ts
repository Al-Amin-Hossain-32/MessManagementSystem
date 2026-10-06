import { z } from 'zod';
export const inviteDirectorSchema = z.object({ email: z.string().trim().email().max(254) });
export const directorIdSchema = z.object({ relationshipId: z.string().cuid() });
export const suspendDirectorSchema = z.object({ reason: z.string().trim().min(3).max(500) });
