import { prisma } from '../../lib/prisma';
import { auditService } from '../../lib/audit.service';
import { ConflictError, NotFoundError, ForbiddenError, UnprocessableError } from '../../lib/errors';
import {
  MessStatus,
  MessMembershipRole,
  MessMembershipStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  AuditAction,
  NotificationType,
} from '@messmess/types';
import { generateSlug } from '@messmess/utils';
import type { CreateMessDto, UpdateMessDto } from './mess.schema';
import { notificationService } from '../notification/notification.service';

export class MessService {
  /**
   * Create a new Mess with the creator as PRIMARY_OWNER.
   * Automatically:
   * - Creates a BillingAccount for the owner (if not existing)
   * - Creates a trial Subscription
   * - Links the platform default Shop
   */
  async createMess(creatorUserId: string, dto: CreateMessDto) {
    // Generate unique slug
    let slug = generateSlug(dto.name);
    const existingSlug = await prisma.mess.findUnique({ where: { slug }, select: { id: true } });
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the Mess
      const mess = await tx.mess.create({
        data: {
          name: dto.name,
          slug,
          address: dto.address ?? null,
          description: dto.description ?? null,
          status: MessStatus.PENDING_SETUP,
        },
      });

      // 2. Create PRIMARY_OWNER MessMembership
      await tx.messMembership.create({
        data: {
          userId: creatorUserId,
          messId: mess.id,
          role: MessMembershipRole.PRIMARY_OWNER,
          status: MessMembershipStatus.ACTIVE,
          acceptedAt: new Date(),
        },
      });

      // 3. Create or fetch BillingAccount
      let billingAccount = await tx.billingAccount.findUnique({
        where: { ownerUserId: creatorUserId },
      });
      if (!billingAccount) {
        const user = await tx.user.findUnique({
          where: { id: creatorUserId },
          select: { email: true },
        });
        billingAccount = await tx.billingAccount.create({
          data: {
            ownerUserId: creatorUserId,
            billingEmail: user!.email,
          },
        });
      }

      // 4. Create trial Subscription
      const trialStart = new Date();
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14); // 14-day trial

      await tx.subscription.create({
        data: {
          billingAccountId: billingAccount.id,
          messId: mess.id,
          plan: SubscriptionPlan.BASIC,
          status: SubscriptionStatus.TRIAL,
          currentPeriodStart: trialStart,
          currentPeriodEnd: trialEnd,
          trialEndsAt: trialEnd,
        },
      });

      // 5. Link platform default Shop (SRS: auto-linked on Mess creation)
      const defaultShop = await tx.shop.findFirst({
        where: { isDefault: true, status: 'ACTIVE' },
        select: { id: true },
      });
      if (defaultShop) {
        await tx.messShopLink.create({
          data: {
            messId: mess.id,
            shopId: defaultShop.id,
            isDefault: true,
          },
        });
      }

      return mess;
    });

    await auditService.log({
      messId: result.id,
      actorUserId: creatorUserId,
      actorRole: MessMembershipRole.PRIMARY_OWNER,
      action: AuditAction.MESS_CREATED,
      targetType: 'Mess',
      targetId: result.id,
      newState: { name: result.name, slug: result.slug },
    });

    return result;
  }

  async getMessById(messId: string, requestingUserId: string) {
    const mess = await prisma.mess.findUnique({
      where: { id: messId },
      include: {
        subscription: { select: { plan: true, status: true, trialEndsAt: true } },
        _count: {
          select: {
            boarderMemberships: { where: { status: 'ACTIVE' } },
          },
        },
      },
    });

    if (!mess) throw new NotFoundError('Mess');
    return mess;
  }

  async updateMess(messId: string, actorUserId: string, dto: UpdateMessDto) {
    const previous = await prisma.mess.findUnique({
      where: { id: messId },
      select: { name: true, address: true, description: true },
    });
    if (!previous) throw new NotFoundError('Mess');

    const updated = await prisma.mess.update({
      where: { id: messId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });

    await auditService.log({
      messId,
      actorUserId,
      action: AuditAction.MESS_UPDATED,
      targetType: 'Mess',
      targetId: messId,
      previousState: previous,
      newState: dto,
    });

    return updated;
  }

  async getUserMesses(userId: string) {
    const memberships = await prisma.messMembership.findMany({
      where: { userId, status: MessMembershipStatus.ACTIVE },
      include: {
        mess: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            subscription: { select: { plan: true, status: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return memberships.map((m: (typeof memberships)[number]) => ({
      mess: m.mess,
      role: m.role,
    }));
  }

  /**
   * Invite a Co-Admin to the Mess.
   * Only PRIMARY_OWNER can invite Co-Admins.
   */
  async inviteCoAdmin(messId: string, inviterUserId: string, targetEmail: string) {
    const targetUser = await prisma.user.findUnique({
      where: { email: targetEmail.toLowerCase() },
      select: { id: true, name: true, email: true },
    });
    if (!targetUser) throw new NotFoundError('User with this email');

    const existing = await prisma.messMembership.findUnique({
      where: { userId_messId: { userId: targetUser.id, messId } },
    });
    if (existing) {
      throw new ConflictError('This user already has a membership in this Mess');
    }

    const membership = await prisma.messMembership.create({
      data: {
        userId: targetUser.id,
        messId,
        role: MessMembershipRole.CO_ADMIN,
        status: MessMembershipStatus.INVITED,
        invitedBy: inviterUserId,
      },
    });

    await auditService.log({
      messId,
      actorUserId: inviterUserId,
      actorRole: MessMembershipRole.PRIMARY_OWNER,
      action: AuditAction.MESS_MEMBERSHIP_INVITED,
      targetType: 'MessMembership',
      targetId: membership.id,
      newState: { targetEmail, role: MessMembershipRole.CO_ADMIN },
    });

    await notificationService.notifyUser({
      userId: targetUser.id,
      messId,
      eventId: `co-admin.invited:${membership.id}`,
      type: NotificationType.CO_ADMIN_INVITED,
      href: '/dashboard',
    });

    return { membership, targetUser };
  }

  // ─── PATCH(frontend) ────────────────────────────────────────────────────────

  /** Minimal, non-sensitive Mess card for the join flow. Only non-archived Messes. */
  async findPublicBySlug(slug: string) {
    const mess = await prisma.mess.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { id: true, name: true, slug: true, address: true, status: true },
    });
    if (!mess || mess.status === MessStatus.ARCHIVED) throw new NotFoundError('Mess');
    return mess;
  }

  /** The invited Co-Admin flips their own INVITED membership to ACTIVE. */
  async acceptCoAdminInvite(messId: string, userId: string) {
    const existing = await prisma.messMembership.findUnique({
      where: { userId_messId: { userId, messId } },
    });
    if (
      !existing ||
      existing.role !== MessMembershipRole.CO_ADMIN ||
      existing.status !== MessMembershipStatus.INVITED
    ) {
      throw new NotFoundError('Pending Co-Admin invitation');
    }
    const membership = await prisma.messMembership.update({
      where: { id: existing.id },
      data: { status: MessMembershipStatus.ACTIVE, acceptedAt: new Date() },
    });
    await auditService.log({
      messId,
      actorUserId: userId,
      actorRole: MessMembershipRole.CO_ADMIN,
      action: AuditAction.MESS_MEMBERSHIP_ACCEPTED,
      targetType: 'MessMembership',
      targetId: membership.id,
    });
    return membership;
  }
}

export const messService = new MessService();
