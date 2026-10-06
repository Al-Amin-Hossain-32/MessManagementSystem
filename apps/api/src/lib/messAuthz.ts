import { prisma } from './prisma';
import { ForbiddenError } from './errors';
import {
  MessMembershipStatus,
  MessMembershipRole,
  ManagerAssignmentStatus,
} from '@messmess/types';
import { isManagerAssignmentInPeriod } from './managerPeriod';

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
    prisma.managerAssignment.findMany({
      where: { messId, userId, status: ManagerAssignmentStatus.ACTIVE },
      select: { startDate: true, endDate: true },
    }),
  ]);

  const isAdmin =
    !!membership &&
    membership.status === MessMembershipStatus.ACTIVE &&
    (membership.role === MessMembershipRole.PRIMARY_OWNER ||
      membership.role === MessMembershipRole.CO_ADMIN);

  return isAdmin || managerAssignment.some((assignment) =>
    isManagerAssignmentInPeriod(assignment.startDate, assignment.endDate),
  );
}

/**
 * PATCH(frontend): a Boarder may read only records belonging to their own
 * BoarderMembership; Admins/Managers may read any record in the Mess.
 */
export async function assertSelfOrStaff(
  messId: string,
  userId: string,
  boarderMembershipId: string,
): Promise<void> {
  if (await isMessAdminOrManager(messId, userId)) return;
  const own = await prisma.boarderMembership.findFirst({
    where: { id: boarderMembershipId, messId, userId },
    select: { id: true },
  });
  if (!own) throw new ForbiddenError('You can only view your own records');
}
