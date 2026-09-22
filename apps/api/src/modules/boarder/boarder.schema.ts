import { z } from 'zod';
import { BoarderResidencyType } from '@messmess/types';

// ─── Admin Invite Path ────────────────────────────────────────────────────────

export const inviteBoarderSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
});

// ─── Rejection / Removal reasons ──────────────────────────────────────────────

export const reasonSchema = z.object({
  reason: z.string().min(3).max(500).optional(),
});

// ─── Residency Change ─────────────────────────────────────────────────────────

export const residencyChangeSchema = z.object({
  type: z.nativeEnum(BoarderResidencyType),
  // Defaults to "now" in the service layer if omitted.
  effectiveFrom: z.string().datetime().optional(),
  reason: z.string().max(500).optional(),
});

// ─── List query ───────────────────────────────────────────────────────────────

export const listBoardersQuerySchema = z.object({
  status: z
    .enum(['INVITED', 'PENDING_APPROVAL', 'ACTIVE', 'LEAVE_REQUESTED', 'ENDED', 'REMOVED'])
    .optional(),
});

export type InviteBoarderDto = z.infer<typeof inviteBoarderSchema>;
export type ReasonDto = z.infer<typeof reasonSchema>;
export type ResidencyChangeDto = z.infer<typeof residencyChangeSchema>;
export type ListBoardersQueryDto = z.infer<typeof listBoardersQuerySchema>;
