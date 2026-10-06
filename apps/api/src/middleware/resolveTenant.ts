import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { TenantAccessError, NotFoundError } from '../lib/errors';
import { requireManagerOrAdmin } from './requireManager';
import {
  MessStatus,
  MessMembershipRole,
  MessMembershipStatus,
  BoarderMembershipStatus,
  ManagerAssignmentStatus,
  DirectorRelationshipStatus,
} from '@messmess/types';

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
        isDirector?: boolean;
        /** PATCH(frontend): caller is an ACTIVE / LEAVE_REQUESTED Boarder of this Mess. */
        isBoarder?: boolean;
        /** PATCH(frontend): caller has a PENDING_ACCEPTANCE or ACTIVE Manager assignment here. */
        isManagerParty?: boolean;
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
  return _resolveTenant(req, next, { requireMembership: true, allowDirector: false });
}

/** Use only on read-only dashboard/financial routes where Director access is explicitly allowed. */
export function resolveTenantForDirectorRead(req: Request, _res: Response, next: NextFunction): Promise<void> {
  return _resolveTenant(req, next, { requireMembership: true, allowDirector: true });
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
  return _resolveTenant(req, next, { requireMembership: false, allowDirector: false });
}

async function _resolveTenant(
  req: Request,
  next: NextFunction,
  options: { requireMembership: boolean; allowDirector: boolean },
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
      // PATCH(frontend): Boarders and Managers have no MessMembership row — they hold a
      // BoarderMembership / ManagerAssignment instead. Let them resolve the tenant with
      // NO admin flags; every admin route still gates on requireMessAdmin/requirePrimaryOwner.
      const userId = req.auth.userId;
      const [boarder, managerParty] = await Promise.all([
        prisma.boarderMembership.findFirst({
          where: {
            messId,
            userId,
            status: { in: [BoarderMembershipStatus.ACTIVE, BoarderMembershipStatus.LEAVE_REQUESTED] },
          },
          select: { id: true },
        }),
        prisma.managerAssignment.findFirst({
          where: {
            messId,
            userId,
            status: { in: [ManagerAssignmentStatus.PENDING_ACCEPTANCE, ManagerAssignmentStatus.ACTIVE] },
          },
          select: { id: true },
        }),
      ]);
      const director = options.allowDirector
        ? await prisma.directorRelationship.findUnique({
          where: { directorUserId_messId: { directorUserId: userId, messId } },
          select: { status: true },
        })
        : null;
      const isDirector = director?.status === DirectorRelationshipStatus.ACTIVE;
      if (!boarder && !managerParty && !isDirector) {
        throw new TenantAccessError();
      }
      req.tenant = {
        messId,
        memberRole: null,
        isPrimaryOwner: false,
        isCoAdmin: false,
        isBoarder: !!boarder,
        isManagerParty: !!managerParty,
        isDirector,
      };
      next();
      return;
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

/** Allows an active Director only for endpoints whose handler is a read operation. */
export function requireMessAdminOrDirectorRead(req: Request, _res: Response, next: NextFunction): void {
  if (req.tenant?.isPrimaryOwner || req.tenant?.isCoAdmin || req.tenant?.isDirector) {
    next();
    return;
  }
  next(new TenantAccessError('Mess Admin or Director access required'));
}

export async function requireManagerOrAdminOrDirectorRead(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.tenant?.isDirector) {
    next();
    return;
  }
  await requireManagerOrAdmin(req, res, next);
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
 * PATCH(frontend) Guard: Mess Admin OR anyone with a Manager assignment (pending/active).
 * Used for handover reads, where the incoming Manager may not be ACTIVE yet.
 */
export function requireAdminOrManagerParty(req: Request, _res: Response, next: NextFunction): void {
  if (req.tenant?.isPrimaryOwner || req.tenant?.isCoAdmin || req.tenant?.isManagerParty) {
    next();
    return;
  }
  next(new TenantAccessError('Admin or Manager access required'));
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
