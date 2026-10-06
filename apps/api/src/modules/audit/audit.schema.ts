import { z } from 'zod';
import { AuditAction } from '@messmess/types';

export const auditQuerySchema = z.object({
  action: z.nativeEnum(AuditAction).optional(),
  targetType: z.string().trim().min(1).max(80).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  path: ['to'],
  message: 'End date must not be earlier than start date',
});
