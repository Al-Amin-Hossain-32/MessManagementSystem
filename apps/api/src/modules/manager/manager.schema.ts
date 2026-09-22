import { z } from 'zod';

export const assignManagerSchema = z
  .object({
    userId: z.string().cuid('Invalid user ID'),
    periodLabel: z.string().min(3).max(50), // e.g. "October 2025"
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: 'endDate must be after startDate',
    path: ['endDate'],
  });

export const terminateAssignmentSchema = z.object({
  reason: z.string().min(3, 'A termination reason is required').max(500),
});

export type AssignManagerDto = z.infer<typeof assignManagerSchema>;
export type TerminateAssignmentDto = z.infer<typeof terminateAssignmentSchema>;
