import { AuditAction, DirectorRelationshipStatus, NotificationType } from '@messmess/types';
import { prisma } from '../../lib/prisma';
import { auditService } from '../../lib/audit.service';
import { notificationService } from '../notification/notification.service';
import { ConflictError, NotFoundError, TenantAccessError } from '../../lib/errors';

const relationshipInclude = {
  director: { select: { id: true, name: true, email: true } },
} as const;

class DirectorService {
  async list(messId: string) {
    return prisma.directorRelationship.findMany({
      where: { messId },
      include: relationshipInclude,
      orderBy: { invitedAt: 'desc' },
    });
  }

  async invite(messId: string, ownerId: string, email: string) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true, name: true } });
    if (!user) throw new NotFoundError('Registered user with this email');
    if (user.id === ownerId) throw new ConflictError('The Primary Owner cannot invite themselves as a Director');

    const previous = await prisma.directorRelationship.findUnique({
      where: { directorUserId_messId: { directorUserId: user.id, messId } },
    });
    if (previous?.status === DirectorRelationshipStatus.ACTIVE || previous?.status === DirectorRelationshipStatus.PENDING) {
      throw new ConflictError('This user already has an active relationship or pending invitation');
    }
    const relationship = previous
      ? await prisma.directorRelationship.update({
        where: { id: previous.id },
        data: {
          status: DirectorRelationshipStatus.PENDING, invitedBy: ownerId, invitedAt: new Date(),
          acceptedAt: null, revokedAt: null, revokedBy: null, suspendedAt: null, suspendedBy: null,
          suspensionReason: null, expiresAt: null,
        },
        include: relationshipInclude,
      })
      : await prisma.directorRelationship.create({
        data: { messId, directorUserId: user.id, invitedBy: ownerId },
        include: relationshipInclude,
      });
    await auditService.log({
      messId, actorUserId: ownerId, action: AuditAction.DIRECTOR_INVITED,
      targetType: 'DirectorRelationship', targetId: relationship.id,
      newState: { directorUserId: user.id, email: email.toLowerCase() },
    });
    await notificationService.notifyUser({
      userId: user.id,
      messId,
      eventId: `director.invited:${relationship.id}`,
      type: NotificationType.DIRECTOR_INVITED,
      href: '/dashboard',
    });
    return relationship;
  }

  async respond(messId: string, relationshipId: string, userId: string, accept: boolean) {
    const relationship = await prisma.directorRelationship.findFirst({ where: { id: relationshipId, messId } });
    if (!relationship || relationship.directorUserId !== userId) throw new NotFoundError('Director invitation');
    if (relationship.status !== DirectorRelationshipStatus.PENDING ||
        (relationship.expiresAt && relationship.expiresAt < new Date())) {
      throw new ConflictError('This invitation is no longer pending');
    }
    const result = await prisma.directorRelationship.update({
      where: { id: relationshipId },
      data: {
        status: accept ? DirectorRelationshipStatus.ACTIVE : DirectorRelationshipStatus.DECLINED,
        acceptedAt: accept ? new Date() : null,
      },
      include: relationshipInclude,
    });
    if (accept) {
      await auditService.log({
        messId: relationship.messId, actorUserId: userId, action: AuditAction.DIRECTOR_ACCEPTED,
        targetType: 'DirectorRelationship', targetId: relationshipId,
      });
    }
    return result;
  }

  async setStatus(messId: string, relationshipId: string, actorId: string, action: 'suspend' | 'reactivate' | 'revoke', reason?: string) {
    const relationship = await prisma.directorRelationship.findFirst({ where: { id: relationshipId, messId } });
    if (!relationship) throw new NotFoundError('Director relationship');
    if (action === 'suspend' && relationship.status !== DirectorRelationshipStatus.ACTIVE) {
      throw new ConflictError('Only active Directors can be suspended');
    }
    if (action === 'reactivate' && relationship.status !== DirectorRelationshipStatus.SUSPENDED) {
      throw new ConflictError('Only suspended Directors can be reactivated');
    }
    if (action === 'revoke' &&
        relationship.status !== DirectorRelationshipStatus.ACTIVE &&
        relationship.status !== DirectorRelationshipStatus.PENDING &&
        relationship.status !== DirectorRelationshipStatus.SUSPENDED) {
      throw new ConflictError('This Director relationship cannot be revoked');
    }
    const updated = await prisma.directorRelationship.update({
      where: { id: relationship.id },
      data: action === 'suspend'
        ? { status: DirectorRelationshipStatus.SUSPENDED, suspendedAt: new Date(), suspendedBy: actorId, suspensionReason: reason }
        : action === 'reactivate'
          ? { status: DirectorRelationshipStatus.ACTIVE, suspendedAt: null, suspendedBy: null, suspensionReason: null }
          : { status: DirectorRelationshipStatus.REVOKED, revokedAt: new Date(), revokedBy: actorId },
      include: relationshipInclude,
    });
    await auditService.log({
      messId, actorUserId: actorId,
      action: action === 'suspend' ? AuditAction.DIRECTOR_SUSPENDED : AuditAction.DIRECTOR_REVOKED,
      targetType: 'DirectorRelationship', targetId: relationshipId,
      newState: { status: updated.status, reason },
    });
    return updated;
  }

  async assertActiveDirector(messId: string, userId: string) {
    const relationship = await prisma.directorRelationship.findUnique({
      where: { directorUserId_messId: { directorUserId: userId, messId } },
      select: { status: true },
    });
    if (relationship?.status !== DirectorRelationshipStatus.ACTIVE) throw new TenantAccessError();
  }
}

export const directorService = new DirectorService();
