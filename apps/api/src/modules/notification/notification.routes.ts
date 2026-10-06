import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { NotFoundError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import {
  listNotificationsQuerySchema,
  notificationParamsSchema,
} from './notification.schema';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  validate(listNotificationsQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { filter, page, limit } = listNotificationsQuerySchema.parse(req.query);
      const where = {
        userId: req.auth.userId,
        ...(filter === 'all' ? {} : { isRead: filter === 'read' }),
      };
      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.notification.count({ where }),
      ]);
      res.json({
        success: true,
        data: { notifications, page, limit, total, hasMore: page * limit < total },
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get('/unread-count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.auth.userId, isRead: false },
    });
    res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/read-all',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await prisma.notification.updateMany({
        where: { userId: req.auth.userId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
      res.json({ success: true, data: { updatedCount: result.count } });
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/:notificationId/read',
  validate(notificationParamsSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notificationId = req.params.notificationId as string;
      const updated = await prisma.notification.updateMany({
        where: { id: notificationId, userId: req.auth.userId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
      const notification = await prisma.notification.findFirst({
        where: { id: notificationId, userId: req.auth.userId },
      });
      if (!notification) throw new NotFoundError('Notification');
      res.status(StatusCodes.OK).json({
        success: true,
        data: { notification, changed: updated.count > 0 },
      });
    } catch (error) {
      next(error);
    }
  },
);

export { router as notificationRouter };
