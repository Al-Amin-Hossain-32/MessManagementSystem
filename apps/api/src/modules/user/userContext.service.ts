import { prisma } from '../../lib/prisma';
import {
  MessMembershipStatus,
  BoarderMembershipStatus,
  ManagerAssignmentStatus,
  PlatformRole,
} from '@messmess/types';

class UserContextService {
  /**
   * Everything the frontend needs right after login to decide what to show:
   * which Messes this user administers, which they board at, which they
   * currently manage, which Shops they run, and whether they're a Platform
   * Admin. No single role field exists anywhere by design (SRS §6) — this
   * endpoint is the intended replacement for "what's my role".
   */
  async getContext(userId: string) {
    const [user, messMemberships, boarderMemberships, managerAssignments, shopsManaged] =
      await Promise.all([
        prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { id: true, name: true, email: true, platformRole: true },
        }),
        prisma.messMembership.findMany({
          where: { userId, status: MessMembershipStatus.ACTIVE },
          select: { role: true, mess: { select: { id: true, name: true, status: true } } },
        }),
        prisma.boarderMembership.findMany({
          where: { userId, status: BoarderMembershipStatus.ACTIVE },
          select: { id: true, mess: { select: { id: true, name: true, status: true } } },
        }),
        prisma.managerAssignment.findMany({
          where: { userId, status: ManagerAssignmentStatus.ACTIVE },
          select: {
            id: true,
            periodLabel: true,
            mess: { select: { id: true, name: true } },
          },
        }),
        prisma.shop.findMany({
          where: { managedBy: userId },
          select: { id: true, name: true },
        }),
      ]);

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      platformRole: user.platformRole,
      isPlatformAdmin: user.platformRole === PlatformRole.PLATFORM_ADMIN,
      messMemberships: messMemberships.map((m) => ({
        messId: m.mess.id,
        messName: m.mess.name,
        messStatus: m.mess.status,
        role: m.role,
      })),
      boarderOf: boarderMemberships.map((b) => ({
        boarderMembershipId: b.id,
        messId: b.mess.id,
        messName: b.mess.name,
        messStatus: b.mess.status,
      })),
      activeManagerAssignments: managerAssignments.map((a) => ({
        managerAssignmentId: a.id,
        messId: a.mess.id,
        messName: a.mess.name,
        periodLabel: a.periodLabel,
      })),
      shopsManaged: shopsManaged.map((s) => ({ shopId: s.id, shopName: s.name })),
    };
  }
}

export const userContextService = new UserContextService();
