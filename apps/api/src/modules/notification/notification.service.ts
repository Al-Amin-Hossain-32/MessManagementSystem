import { Prisma } from '@prisma/client';
import {
  BoarderMembershipStatus,
  ManagerAssignmentStatus,
  MessMembershipStatus,
  NotificationType,
} from '@messmess/types';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';

type NotificationParams = Record<string, string | number>;

interface NotificationEvent {
  messId: string;
  eventId: string;
  type: NotificationType;
  href: string;
  params?: NotificationParams;
  userIds: string[];
  excludeUserId?: string;
}

class NotificationService {
  async notifyUser(
    input: Omit<NotificationEvent, 'userIds'> & { userId: string },
  ): Promise<void> {
    await this.publish({ ...input, userIds: [input.userId] });
  }

  async notifyAdmins(
    input: Omit<NotificationEvent, 'userIds'>,
  ): Promise<void> {
    try {
      const [memberships, managers] = await Promise.all([
        prisma.messMembership.findMany({
          where: { messId: input.messId, status: MessMembershipStatus.ACTIVE },
          select: { userId: true },
        }),
        prisma.managerAssignment.findMany({
          where: { messId: input.messId, status: ManagerAssignmentStatus.ACTIVE },
          select: { userId: true },
        }),
      ]);
      await this.publish({
        ...input,
        userIds: [...memberships, ...managers].map(({ userId }) => userId),
      });
    } catch (error) {
      this.logFailure(input, error);
    }
  }

  async notifyBoarders(
    input: Omit<NotificationEvent, 'userIds'> & { excludeUserId?: string },
  ): Promise<void> {
    try {
      const memberships = await prisma.boarderMembership.findMany({
        where: {
          messId: input.messId,
          status: BoarderMembershipStatus.ACTIVE,
          ...(input.excludeUserId ? { userId: { not: input.excludeUserId } } : {}),
        },
        select: { userId: true },
      });
      await this.publish({ ...input, userIds: memberships.map(({ userId }) => userId) });
    } catch (error) {
      this.logFailure(input, error);
    }
  }

  private async publish(input: NotificationEvent): Promise<void> {
    const userIds = [...new Set(input.userIds)].filter((userId) => userId !== input.excludeUserId);
    if (userIds.length === 0) return;

    try {
      const data: Prisma.InputJsonObject = {
        href: input.href,
        messId: input.messId,
        params: input.params ?? {},
        eventId: input.eventId,
      };
      await prisma.notification.createMany({
        data: userIds.map((userId) => ({
          userId,
          messId: input.messId,
          channel: 'IN_APP',
          type: input.type,
          title: `notifications.types.${input.type}.title`,
          body: `notifications.types.${input.type}.body`,
          data,
          idempotencyKey: `${input.eventId}:${userId}`,
          sentAt: new Date(),
        })),
        skipDuplicates: true,
      });
    } catch (error) {
      this.logFailure(input, error);
    }
  }

  private logFailure(input: Pick<NotificationEvent, 'messId' | 'eventId' | 'type'>, error: unknown) {
    logger.warn(
      { error, messId: input.messId, eventId: input.eventId, type: input.type },
      'Could not persist in-app notification',
    );
  }
}

export const notificationService = new NotificationService();
