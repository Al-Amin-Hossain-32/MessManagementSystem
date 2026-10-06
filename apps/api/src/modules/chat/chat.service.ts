import { prisma } from '../../lib/prisma';

export async function isAuthorizedMessUser(messId: string, userId: string): Promise<boolean> {
  const mess = await prisma.mess.findFirst({
    where: { id: messId, status: { not: 'ARCHIVED' } },
    select: { id: true },
  });
  if (!mess) return false;

  const [adminMembership, boarderMembership, managerAssignment] = await Promise.all([
    prisma.messMembership.findFirst({
      where: { messId, userId, status: 'ACTIVE' },
      select: { id: true },
    }),
    prisma.boarderMembership.findFirst({
      where: { messId, userId, status: { in: ['ACTIVE', 'LEAVE_REQUESTED'] } },
      select: { id: true },
    }),
    prisma.managerAssignment.findFirst({
      where: { messId, userId, status: { in: ['PENDING_ACCEPTANCE', 'ACTIVE'] } },
      select: { id: true },
    }),
  ]);

  return !!adminMembership || !!boarderMembership || !!managerAssignment;
}

export async function listChatMembers(messId: string) {
  const [admins, boarders, managers] = await Promise.all([
    prisma.messMembership.findMany({
      where: { messId, status: 'ACTIVE' },
      select: { role: true, user: { select: { id: true, name: true } } },
    }),
    prisma.boarderMembership.findMany({
      where: { messId, status: { in: ['ACTIVE', 'LEAVE_REQUESTED'] } },
      select: { user: { select: { id: true, name: true } } },
    }),
    prisma.managerAssignment.findMany({
      where: { messId, status: { in: ['PENDING_ACCEPTANCE', 'ACTIVE'] } },
      select: { user: { select: { id: true, name: true } } },
    }),
  ]);

  const members = new Map<string, { id: string; name: string; roles: Set<string> }>();
  const add = (user: { id: string; name: string }, role: string) => {
    const existing = members.get(user.id) ?? { ...user, roles: new Set<string>() };
    existing.roles.add(role);
    members.set(user.id, existing);
  };

  for (const membership of admins) add(membership.user, membership.role);
  for (const membership of boarders) add(membership.user, 'BOARDER');
  for (const assignment of managers) add(assignment.user, 'MANAGER');

  return [...members.values()]
    .map(({ roles, ...member }) => ({ ...member, roles: [...roles] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getUnreadChatCount(messId: string, userId: string) {
  return prisma.chatMessage.count({
    where: {
      messId,
      userId: { not: userId },
      deletedAt: null,
      readReceipts: { none: { userId } },
    },
  });
}
