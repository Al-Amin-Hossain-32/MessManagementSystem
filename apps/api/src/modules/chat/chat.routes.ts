import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../lib/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../lib/errors';
import { authenticate } from '../../middleware/authenticate';
import { resolveTenant } from '../../middleware/resolveTenant';
import { validate } from '../../middleware/validate';
import { emitChatMessage, emitChatMessageDeleted } from './chat.socket';
import { getUnreadChatCount, listChatMembers } from './chat.service';
import { chatListQuerySchema, chatMessageParamsSchema, chatMessageSchema } from './chat.schema';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get(
  '/members',
  resolveTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const members = await listChatMembers(req.tenant.messId);
      res.json({ success: true, data: { members } });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/unread-count',
  resolveTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const count = await getUnreadChatCount(req.tenant.messId, req.auth.userId);
      res.json({ success: true, data: { count } });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/',
  resolveTenant,
  validate(chatListQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = chatListQuerySchema.parse(req.query);
      const where = { messId: req.tenant.messId };

      const [messages, total] = await Promise.all([
        prisma.chatMessage.findMany({
          where,
          include: {
            sender: {
              select: { id: true, name: true, email: true, phone: true },
            },
            readReceipts: {
              include: { user: { select: { id: true, name: true } } },
              orderBy: { seenAt: 'asc' },
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.chatMessage.count({ where }),
      ]);

      const visibleMessages = messages.map((message) => ({
        ...message,
        content: message.deletedAt ? '' : message.content,
      }));
      res.json({
        success: true,
        data: {
          messages: visibleMessages,
          page,
          limit,
          total,
          hasMore: page * limit < total,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/',
  resolveTenant,
  validate(chatMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const content = req.body.content as string;
      const trimmed = content.trim();
      if (!trimmed) throw new BadRequestError('Message content cannot be empty');

      const message = await prisma.chatMessage.create({
        data: {
          messId: req.tenant.messId,
          userId: req.auth.userId,
          content: trimmed,
        },
        include: {
          sender: {
            select: { id: true, name: true, email: true, phone: true },
          },
        },
      });
      emitChatMessage(req.tenant.messId, message);

      res.status(StatusCodes.CREATED).json({
        success: true,
        data: { message },
        message: 'Message sent successfully',
      });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  '/:messageId',
  resolveTenant,
  validate(chatMessageParamsSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const message = await prisma.chatMessage.findFirst({
        where: {
          id: req.params.messageId,
          messId: req.tenant.messId,
          deletedAt: null,
        },
        select: { id: true, userId: true },
      });

      if (!message) throw new NotFoundError('Chat message');
      if (message.userId !== req.auth.userId) {
        throw new ForbiddenError('You can only delete your own messages');
      }

      const deletedAt = new Date();
      const deleted = await prisma.chatMessage.update({
        where: { id: message.id },
        data: { deletedAt },
        include: {
          sender: {
            select: { id: true, name: true, email: true, phone: true },
          },
        },
      });
      emitChatMessageDeleted(req.tenant.messId, deleted.id, deletedAt);

      res.json({
        success: true,
        data: { message: { ...deleted, content: '' }, deleted: true },
      });
    } catch (error) {
      next(error);
    }
  },
);

export { router as chatRouter };
