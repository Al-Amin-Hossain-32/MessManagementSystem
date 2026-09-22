import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { TenantAccessError, NotFoundError } from '../lib/errors';
import { MessStatus, MessMembershipRole, MessMembershipStatus } from '@messmess/types';

// Extend Request with tenant context
declare global {
  namespace Express {
    interface Request {
      tenant: {
        messId: string;
        /**
         * The authenticated user's role in this Mess, if they are a member.
         * Null if they access via DirectorRelationship or as Platform Admin.
         */
        memberRole: MessMembershipRole | null;
        isPrimaryOwner: boolean;
        isCoAdmin: boolean;
      };
    }
  }
}

/**
 * Resolves :messId from URL params, verifies the Mess exists and is accessible,
 * verifies the authenticated user has an active membership role in this Mess,
 * and attaches verified tenant context to req.tenant.
 *
 * SECURITY: messId is ALWAYS taken from the verified URL param — never from req.body or req.query.
 * This prevents tenant spoofing attacks.
 */
export function resolveTenant(req: Request, _res: Response, next: NextFunction): Promise<void> {
  return _resolveTenant(req, next, { requireMembership: true });
}

/**
 * Resolves tenant context but does NOT require MessMembership.
 * Use for routes accessible to Directors (who have DirectorRelationship, not MessMembership).
 * The route handler is responsible for verifying the appropriate relationship.
 */
export function resolveTenantLoose(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  return _resolveTenant(req, next, { requireMembership: false });
}

async function _resolveTenant(
  req: Request,
  next: NextFunction,
  options: { requireMembership: boolean },
): Promise<void> {
  try {
    const messId = req.params['messId'];
    if (!messId) {
      throw new TenantAccessError('Mess ID is required');
    }

    // 1. Verify Mess exists and is not archived
    const mess = await prisma.mess.findUnique({
      where: { id: messId },
      select: { id: true, status: true },
    });

    if (!mess) {
      throw new NotFoundError('Mess');
    }

    if (mess.status === MessStatus.ARCHIVED) {
      throw new TenantAccessError('This Mess has been archived');
    }

    if (!options.requireMembership) {
      req.tenant = { messId, memberRole: null, isPrimaryOwner: false, isCoAdmin: false };
      next();
      return;
    }

    // 2. Verify the authenticated user has an active MessMembership in this Mess
    const membership = await prisma.messMembership.findUnique({
      where: {
        userId_messId: {
          userId: req.auth.userId,
          messId,
        },
      },
      select: { role: true, status: true },
    });

    if (!membership || membership.status !== MessMembershipStatus.ACTIVE) {
      throw new TenantAccessError();
    }

    const memberRole = membership.role as MessMembershipRole;

    req.tenant = {
      messId,
      memberRole,
      isPrimaryOwner: memberRole === MessMembershipRole.PRIMARY_OWNER,
      isCoAdmin: memberRole === MessMembershipRole.CO_ADMIN,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Guard: only PRIMARY_OWNER may proceed.
 * Must be used after resolveTenant.
 */
export function requirePrimaryOwner(req: Request, _res: Response, next: NextFunction): void {
  if (!req.tenant?.isPrimaryOwner) {
    next(new TenantAccessError('Only the Primary Owner can perform this action'));
    return;
  }
  next();
}

/**
 * Guard: PRIMARY_OWNER or CO_ADMIN may proceed.
 * Must be used after resolveTenant.
 */
export function requireMessAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.tenant?.isPrimaryOwner && !req.tenant?.isCoAdmin) {
    next(new TenantAccessError('Mess Admin access required'));
    return;
  }
  next();
}
