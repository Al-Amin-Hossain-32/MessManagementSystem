import { Request, Response, NextFunction } from 'express';
import { Shop } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ForbiddenError, NotFoundError } from '../lib/errors';
import { PlatformRole } from '@messmess/types';

declare global {
  namespace Express {
    interface Request {
      shop: Shop;
    }
  }
}

/** Requires the authenticated user to hold the global PLATFORM_ADMIN role. */
export async function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      select: { platformRole: true },
    });
    if (!user || user.platformRole !== PlatformRole.PLATFORM_ADMIN) {
      throw new ForbiddenError('Platform Admin access required');
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Requires the authenticated user to be the managing Shop Admin for
 * :shopId, OR a Platform Admin (who can act on any Shop). Attaches the
 * fetched shop to req.shop so downstream handlers don't re-query it.
 */
export async function requireShopAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const shopId = req.params.shopId;
    const [user, shop] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.auth.userId }, select: { platformRole: true } }),
      prisma.shop.findUnique({ where: { id: shopId } }),
    ]);
    if (!shop) throw new NotFoundError('Shop');

    const isPlatformAdmin = user?.platformRole === PlatformRole.PLATFORM_ADMIN;
    const isShopAdmin = shop.managedBy === req.auth.userId;
    if (!isPlatformAdmin && !isShopAdmin) {
      throw new ForbiddenError('Shop Admin access required for this Shop');
    }

    req.shop = shop;
    next();
  } catch (err) {
    next(err);
  }
}
