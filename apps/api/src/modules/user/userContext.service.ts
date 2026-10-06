import { prisma } from '../../lib/prisma';
import {
  MessMembershipStatus,
  BoarderMembershipStatus,
  ManagerAssignmentStatus,
  PlatformRole,
  DirectorRelationshipStatus,
} from '@messmess/types';
import { isManagerAssignmentInPeriod } from '../../lib/managerPeriod';

class UserContextService {
  /**
   * Everything the frontend needs right after login to decide what to show:
   * which Messes this user administers, which they board at, which they
   * currently manage, which Shops they run, and whether they're a Platform
   * Admin. No single role field exists anywhere by design (SRS §6) — this
   * endpoint is the intended replacement for "what's my role".
   */
  async getContext(userId: string) {
    const [user, messMemberships, boarderMemberships, managerAssignments, shopsManaged, directorships] =
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
            startDate: true,
            endDate: true,
            mess: { select: { id: true, name: true } },
          },
        }),
        prisma.shop.findMany({
          where: { managedBy: userId },
          select: { id: true, name: true },
        }),
        prisma.directorRelationship.findMany({
          where: { directorUserId: userId, status: DirectorRelationshipStatus.ACTIVE },
          select: { id: true, status: true, mess: { select: { id: true, name: true, status: true } } },
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
      activeManagerAssignments: managerAssignments
        .filter((assignment) => isManagerAssignmentInPeriod(assignment.startDate, assignment.endDate))
        .map((a) => ({
        managerAssignmentId: a.id,
        messId: a.mess.id,
        messName: a.mess.name,
        periodLabel: a.periodLabel,
      })),
      shopsManaged: shopsManaged.map((s) => ({ shopId: s.id, shopName: s.name })),
      activeDirectorships: directorships.map((d) => ({
        relationshipId: d.id, messId: d.mess.id, messName: d.mess.name, messStatus: d.mess.status,
      })),
    };
  }

  /**
   * PATCH(frontend): everything waiting on THIS user — the invitations inbox.
   * Accept/decline endpoints need a messId, and nothing else tells the invitee which one.
   */
  async getInvitations(userId: string) {
    const [coAdmin, boarder, joinRequests, managers, directors] = await Promise.all([
      prisma.messMembership.findMany({
        where: { userId, status: MessMembershipStatus.INVITED },
        select: { id: true, role: true, createdAt: true, mess: { select: { id: true, name: true } } },
      }),
      prisma.boarderMembership.findMany({
        where: { userId, status: BoarderMembershipStatus.INVITED },
        select: { id: true, createdAt: true, mess: { select: { id: true, name: true } } },
      }),
      prisma.boarderMembership.findMany({
        where: { userId, status: BoarderMembershipStatus.PENDING_APPROVAL },
        select: { id: true, createdAt: true, mess: { select: { id: true, name: true } } },
      }),
      prisma.managerAssignment.findMany({
        where: { userId, status: ManagerAssignmentStatus.PENDING_ACCEPTANCE },
        select: {
          id: true,
          periodLabel: true,
          startDate: true,
          endDate: true,
          mess: { select: { id: true, name: true } },
        },
      }),
      prisma.directorRelationship.findMany({
        where: { directorUserId: userId, status: DirectorRelationshipStatus.PENDING },
        select: { id: true, invitedAt: true, mess: { select: { id: true, name: true } } },
      }),
    ]);
    return {
      coAdminInvites: coAdmin.map((m) => ({ membershipId: m.id, messId: m.mess.id, messName: m.mess.name })),
      boarderInvites: boarder.map((m) => ({ membershipId: m.id, messId: m.mess.id, messName: m.mess.name })),
      pendingJoinRequests: joinRequests.map((m) => ({ membershipId: m.id, messId: m.mess.id, messName: m.mess.name })),
      managerAssignments: managers.map((a) => ({
        assignmentId: a.id,
        messId: a.mess.id,
        messName: a.mess.name,
        periodLabel: a.periodLabel,
        startDate: a.startDate,
        endDate: a.endDate,
      })),
      directorInvites: directors.map((d) => ({
        relationshipId: d.id, messId: d.mess.id, messName: d.mess.name, invitedAt: d.invitedAt,
      })),
    };
  }
}

export const userContextService = new UserContextService();
