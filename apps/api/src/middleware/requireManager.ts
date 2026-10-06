import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { TenantAccessError } from '../lib/errors';
import { isManagerAssignmentInPeriod } from '../lib/managerPeriod';
import { ManagerAssignmentStatus } from '@messmess/types';

declare global {
  namespace Express {
    interface Request {
      managerContext?: {
        assignmentId: string;
        periodLabel: string;
        startDate: Date;
        endDate: Date;
      };
    }
  }
}

/**
 * Verifies the authenticated user is the ACTIVE Manager for req.tenant.messId.
 * Must be used after authenticate + resolveTenantLoose (or resolveTenant).
 *
 * SECURITY: Authorization is checked server-side against the database —
 * not based on any role claim in the JWT or request body.
 */
export async function requireActiveManager(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const messId = req.params['messId'];
    if (!messId) {
      throw new TenantAccessError('Mess ID is required');
    }

    const assignments = await prisma.managerAssignment.findMany({
      where: {
        messId,
        userId: req.auth.userId,
        status: ManagerAssignmentStatus.ACTIVE,
      },
      select: {
        id: true,
        periodLabel: true,
        startDate: true,
        endDate: true,
      },
      orderBy: { assignedAt: 'desc' },
    });
    const assignment = assignments.find((candidate) =>
      isManagerAssignmentInPeriod(candidate.startDate, candidate.endDate),
    );

    if (!assignment) {
      throw new TenantAccessError(
        'You are not the active Manager for this Mess in the current period',
      );
    }

    req.managerContext = {
      assignmentId: assignment.id,
      periodLabel: assignment.periodLabel,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Allows access if user is EITHER an active Mess Admin (PRIMARY_OWNER/CO_ADMIN)
 * OR the active Manager for this Mess.
 * Must be used after resolveTenant.
 */
export async function requireManagerOrAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // If already confirmed as Mess Admin via resolveTenant, allow through
  if (req.tenant?.isPrimaryOwner || req.tenant?.isCoAdmin) {
    next();
    return;
  }

  // Otherwise check for active manager assignment
  await requireActiveManager(req, res, next);
}
