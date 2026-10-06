import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { userContextService } from './userContext.service';
import { authenticate } from '../../middleware/authenticate';
import { requirePlatformAdmin } from '../../middleware/platformAuth';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';

const router = Router();
router.use(authenticate);

const searchUsersQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
});

// Platform Admin-only lookup for assigning Shop administrators.
router.get(
  '/search',
  requirePlatformAdmin,
  validate(searchUsersQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q } = searchUsersQuerySchema.parse(req.query);
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, email: true },
        orderBy: [{ name: 'asc' }, { email: 'asc' }],
        take: 10,
      });
      res.json({ success: true, data: { users } });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/users/me/context
router.get('/me/context', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = await userContextService.getContext(req.auth.userId);
    res.json({ success: true, data: context });
  } catch (err) {
    next(err);
  }
});

// PATCH(frontend) GET /api/v1/users/me/invitations
router.get('/me/invitations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invitations = await userContextService.getInvitations(req.auth.userId);
    res.json({ success: true, data: invitations });
  } catch (err) {
    next(err);
  }
});

export { router as userRouter };
