'use client';
import { useSession } from './session';

export interface MessAccess {
  known: boolean;          // false → user has no relationship with this Mess (per /users/me/context)
  messName: string;
  isOwner: boolean;        // PRIMARY_OWNER
  isAdmin: boolean;        // PRIMARY_OWNER or CO_ADMIN
  isManager: boolean;      // ACTIVE manager assignment
  isBoarder: boolean;      // ACTIVE boarder membership
  isDirector: boolean;     // ACTIVE, read-only Director relationship
  isStaff: boolean;        // admin or manager
  boarderMembershipId?: string;
  managerAssignmentId?: string;
  userId: string;
}

/**
 * UI capability flags for one Mess, derived from GET /users/me/context.
 * These only decide what to SHOW — the API remains the authority (403 is handled globally).
 */
export function useMessAccess(messId: string): MessAccess {
  const { ctx } = useSession();
  const mm = ctx?.messMemberships.find((x) => x.messId === messId);
  const b = ctx?.boarderOf.find((x) => x.messId === messId);
  const mg = ctx?.activeManagerAssignments.find((x) => x.messId === messId);
  const dr = ctx?.activeDirectorships?.find((x) => x.messId === messId);
  const isAdmin = !!mm;
  const isManager = !!mg;
  return {
    known: !!(mm || b || mg || dr),
    messName: mm?.messName ?? b?.messName ?? mg?.messName ?? dr?.messName ?? '',
    isOwner: mm?.role === 'PRIMARY_OWNER',
    isAdmin, isManager,
    isBoarder: !!b,
    isDirector: !!dr,
    isStaff: isAdmin || isManager,
    boarderMembershipId: b?.boarderMembershipId,
    managerAssignmentId: mg?.managerAssignmentId,
    userId: ctx?.userId ?? '',
  };
}
