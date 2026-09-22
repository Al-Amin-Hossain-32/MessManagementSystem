import { prisma } from './prisma';
import {
  MessMembershipStatus,
  MessMembershipRole,
  ManagerAssignmentStatus,
} from '@messmess/types';

/**
 * True if userId is an ACTIVE Primary Owner/Co-Admin OR the ACTIVE Manager
 * for this Mess. Used by service-layer checks that need this beyond what
 * route middleware (resolveTenant/requireMessAdmin/requireManagerOrAdmin)
 * already covers — e.g. deciding whether a non-owner may act on someone
 * else's record within the same handler.
 */
export async function isMessAdminOrManager(messId: string, userId: string): Promise<boolean> {
  const [membership, managerAssignment] = await Promise.all([
    prisma.messMembership.findUnique({
      where: { userId_messId: { userId, messId } },
      select: { role: true, status: true },
    }),
    prisma.managerAssignment.findFirst({
      where: { messId, userId, status: ManagerAssignmentStatus.ACTIVE },
      select: { id: true },
    }),
  ]);

  const isAdmin =
    !!membership &&
    membership.status === MessMembershipStatus.ACTIVE &&
    (membership.role === MessMembershipRole.PRIMARY_OWNER ||
      membership.role === MessMembershipRole.CO_ADMIN);

  return isAdmin || !!managerAssignment;
}
