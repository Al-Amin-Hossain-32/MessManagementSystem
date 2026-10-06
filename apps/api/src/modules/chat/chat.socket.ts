import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';
import type { JwtPayload } from '@messmess/types';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { getUnreadChatCount, isAuthorizedMessUser, listChatMembers } from './chat.service';
import {
  socketChatDeleteSchema,
  socketChatMessageSchema,
  socketChatReadSchema,
  socketChatRoomSchema,
  socketChatTypingSchema,
} from './chat.schema';

type ChatMessageRecord = Awaited<ReturnType<typeof createMessage>>['message'];
type ChatReadReceipt = { messageId: string; userId: string; seenAt: Date; user: { id: string; name: string } };
type Acknowledge = (result: {
  ok: true;
  message?: ChatMessageRecord;
  receipts?: ChatReadReceipt[];
  unreadCount?: number;
} | { ok: false; code: string; message: string }) => void;

let chatIo: Server | null = null;

const roomName = (messId: string) => `mess:${messId}`;
const senderInclude = { sender: { select: { id: true, name: true, email: true, phone: true } } } as const;
const TYPING_TIMEOUT_MS = 5_000;

interface TypingSocket {
  timer: ReturnType<typeof setTimeout>;
}

interface TypingUser {
  userId: string;
  name: string;
  sockets: Map<string, TypingSocket>;
}

const typingByMess = new Map<string, Map<string, TypingUser>>();

async function createMessage(
  messId: string,
  userId: string,
  content: string,
  clientMessageId: string,
) {
  try {
    const message = await prisma.chatMessage.create({
      data: { messId, userId, content, clientMessageId },
      include: senderInclude,
    });
    return { message, created: true };
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      const existing = await prisma.chatMessage.findUnique({
        where: { userId_clientMessageId: { userId, clientMessageId } },
        include: senderInclude,
      });
      if (existing && existing.messId === messId && existing.content === content) {
        return { message: existing, created: false };
      }
      throw new Error('This message id was already used for different content');
    }
    throw error;
  }
}

function reject(ack: Acknowledge | undefined, code: string, message: string) {
  ack?.({ ok: false, code, message });
}

function emitTypingState(
  messId: string,
  event: 'chat:typing_start' | 'chat:typing_stop',
  user: Pick<TypingUser, 'userId' | 'name'>,
  exceptSocketId?: string,
) {
  const room = chatIo?.to(roomName(messId));
  (exceptSocketId ? room?.except(exceptSocketId) : room)?.emit(event, { messId, ...user });
}

function stopTypingForSocket(socket: Socket, messId: string, userId: string) {
  const users = typingByMess.get(messId);
  const user = users?.get(userId);
  const activeSocket = user?.sockets.get(socket.id);
  if (!user || !activeSocket) return;

  clearTimeout(activeSocket.timer);
  user.sockets.delete(socket.id);
  delete socket.data.typingMessId;
  if (user.sockets.size > 0) return;

  users!.delete(userId);
  if (users!.size === 0) typingByMess.delete(messId);
  emitTypingState(messId, 'chat:typing_stop', user);
}

function clearSocketTyping(socket: Socket) {
  const messId = socket.data.typingMessId as string | undefined;
  const userId = socket.data.userId as string | undefined;
  if (messId && userId) stopTypingForSocket(socket, messId, userId);
}

function stopTyping(socket: Socket, messId: string, userId: string) {
  const user = typingByMess.get(messId)?.get(userId);
  if (!user?.sockets.has(socket.id)) return;
  stopTypingForSocket(socket, messId, userId);
}

export function emitChatMessage(messId: string, message: ChatMessageRecord) {
  chatIo?.to(roomName(messId)).emit('chat:message', message);
}

export function emitChatMessageDeleted(messId: string, messageId: string, deletedAt: Date) {
  chatIo?.to(roomName(messId)).emit('chat:message_deleted', { messId, messageId, deletedAt: deletedAt.toISOString() });
}

export function attachChatSocket(server: HttpServer): Server {
  const io = new Server(server, {
    cors: { origin: env.CORS_ORIGINS, credentials: true },
    maxHttpBufferSize: 16 * 1024,
  });
  chatIo = io;

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) {
        next(new Error('UNAUTHORIZED'));
        return;
      }
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
      if (typeof payload.sub !== 'string' || !payload.sub) {
        next(new Error('UNAUTHORIZED'));
        return;
      }
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket: Socket) => {
    socket.on('chat:join', async (input: unknown, acknowledge?: Acknowledge) => {
      try {
        const { messId } = socketChatRoomSchema.parse(input);
        const userId = socket.data.userId as string;
        if (!(await isAuthorizedMessUser(messId, userId))) {
          reject(acknowledge, 'TENANT_ACCESS_DENIED', 'You do not have access to this mess chat');
          return;
        }

        const previousMessId = socket.data.chatMessId as string | undefined;
        if (previousMessId && previousMessId !== messId) {
          clearSocketTyping(socket);
          await socket.leave(roomName(previousMessId));
        }
        await socket.join(roomName(messId));
        socket.data.chatMessId = messId;
        acknowledge?.({ ok: true });
      } catch (error) {
        if (error instanceof Error && 'issues' in error) {
          reject(acknowledge, 'VALIDATION_ERROR', 'Invalid chat room');
          return;
        }
        logger.error({ err: error, socketId: socket.id }, 'Could not join chat room');
        reject(acknowledge, 'INTERNAL_SERVER_ERROR', 'Could not join chat room');
      }
    });

    socket.on('chat:typing_start', async (input: unknown, acknowledge?: Acknowledge) => {
      try {
        const { messId } = socketChatTypingSchema.parse(input);
        const userId = socket.data.userId as string;
        if (!socket.rooms.has(roomName(messId)) || socket.data.chatMessId !== messId) {
          reject(acknowledge, 'TENANT_ACCESS_DENIED', 'Join this mess chat before sending typing status');
          return;
        }
        if (!(await isAuthorizedMessUser(messId, userId))) {
          clearSocketTyping(socket);
          await socket.leave(roomName(messId));
          delete socket.data.chatMessId;
          reject(acknowledge, 'TENANT_ACCESS_DENIED', 'You no longer have access to this mess chat');
          return;
        }

        const member = (await listChatMembers(messId)).find((candidate) => candidate.id === userId);
        if (!member) {
          reject(acknowledge, 'TENANT_ACCESS_DENIED', 'You are not a member of this mess chat');
          return;
        }

        let users = typingByMess.get(messId);
        if (!users) {
          users = new Map();
          typingByMess.set(messId, users);
        }
        let user = users.get(userId);
        const isFirstSocket = !user;
        if (!user) {
          user = { userId, name: member.name, sockets: new Map() };
          users.set(userId, user);
        }

        const existingSocket = user.sockets.get(socket.id);
        if (existingSocket) clearTimeout(existingSocket.timer);
        const timer = setTimeout(() => stopTyping(socket, messId, userId), TYPING_TIMEOUT_MS);
        user.sockets.set(socket.id, { timer });
        socket.data.typingMessId = messId;

        if (isFirstSocket) emitTypingState(messId, 'chat:typing_start', user, socket.id);
        acknowledge?.({ ok: true });
      } catch (error) {
        if (error instanceof Error && 'issues' in error) {
          reject(acknowledge, 'VALIDATION_ERROR', 'Invalid typing status request');
          return;
        }
        logger.error({ err: error, socketId: socket.id }, 'Could not update chat typing status');
        reject(acknowledge, 'INTERNAL_SERVER_ERROR', 'Could not update typing status');
      }
    });

    socket.on('chat:typing_stop', async (input: unknown, acknowledge?: Acknowledge) => {
      try {
        const { messId } = socketChatTypingSchema.parse(input);
        const userId = socket.data.userId as string;
        if (!socket.rooms.has(roomName(messId)) || socket.data.chatMessId !== messId) {
          reject(acknowledge, 'TENANT_ACCESS_DENIED', 'You do not have access to this mess chat');
          return;
        }
        if (!(await isAuthorizedMessUser(messId, userId))) {
          clearSocketTyping(socket);
          await socket.leave(roomName(messId));
          delete socket.data.chatMessId;
          reject(acknowledge, 'TENANT_ACCESS_DENIED', 'You no longer have access to this mess chat');
          return;
        }

        stopTypingForSocket(socket, messId, userId);
        acknowledge?.({ ok: true });
      } catch (error) {
        if (error instanceof Error && 'issues' in error) {
          reject(acknowledge, 'VALIDATION_ERROR', 'Invalid typing status request');
          return;
        }
        logger.error({ err: error, socketId: socket.id }, 'Could not stop chat typing status');
        reject(acknowledge, 'INTERNAL_SERVER_ERROR', 'Could not stop typing status');
      }
    });

    socket.on('chat:read', async (input: unknown, acknowledge?: Acknowledge) => {
      try {
        const { messId, messageIds } = socketChatReadSchema.parse(input);
        const userId = socket.data.userId as string;
        if (!socket.rooms.has(roomName(messId)) || socket.data.chatMessId !== messId) {
          reject(acknowledge, 'TENANT_ACCESS_DENIED', 'You do not have access to this mess chat');
          return;
        }
        if (!(await isAuthorizedMessUser(messId, userId))) {
          await socket.leave(roomName(messId));
          delete socket.data.chatMessId;
          reject(acknowledge, 'TENANT_ACCESS_DENIED', 'You no longer have access to this mess chat');
          return;
        }

        const messages = await prisma.chatMessage.findMany({
          where: { id: { in: [...new Set(messageIds)] }, messId, userId: { not: userId }, deletedAt: null },
          select: { id: true },
        });
        const eligibleIds = messages.map((message) => message.id);
        if (eligibleIds.length) {
          await prisma.chatMessageRead.createMany({
            data: eligibleIds.map((messageId) => ({ messageId, userId })),
            skipDuplicates: true,
          });
        }

        const receipts = eligibleIds.length
          ? await prisma.chatMessageRead.findMany({
            where: { messageId: { in: eligibleIds }, userId },
            include: { user: { select: { id: true, name: true } } },
          })
          : [];
        const unreadCount = await getUnreadChatCount(messId, userId);
        const readEvent = { messId, readerUserId: userId, receipts, unreadCount };
        if (receipts.length) io.to(roomName(messId)).emit('chat:read', readEvent);
        acknowledge?.({ ok: true, receipts, unreadCount });
      } catch (error) {
        if (error instanceof Error && 'issues' in error) {
          reject(acknowledge, 'VALIDATION_ERROR', 'Invalid chat read receipt request');
          return;
        }
        logger.error({ err: error, socketId: socket.id }, 'Could not save chat read receipts');
        reject(acknowledge, 'INTERNAL_SERVER_ERROR', 'Could not save read receipts');
      }
    });

    socket.on('chat:send', async (input: unknown, acknowledge?: Acknowledge) => {
      try {
        const messageInput = socketChatMessageSchema.parse(input);
        const userId = socket.data.userId as string;
        const { messId } = messageInput;
        if (!socket.rooms.has(roomName(messId)) || socket.data.chatMessId !== messId) {
          reject(acknowledge, 'TENANT_ACCESS_DENIED', 'Join this mess chat before sending a message');
          return;
        }
        if (!(await isAuthorizedMessUser(messId, userId))) {
          await socket.leave(roomName(messId));
          delete socket.data.chatMessId;
          reject(acknowledge, 'TENANT_ACCESS_DENIED', 'You no longer have access to this mess chat');
          return;
        }

        const result = await createMessage(messId, userId, messageInput.content, messageInput.clientMessageId);
        stopTypingForSocket(socket, messId, userId);
        if (result.created) emitChatMessage(messId, result.message);
        acknowledge?.({ ok: true, message: result.message });
      } catch (error) {
        if (error instanceof Error && 'issues' in error) {
          reject(acknowledge, 'VALIDATION_ERROR', 'Message must contain 1 to 2000 characters');
          return;
        }
        if (error instanceof Error && error.message.startsWith('This message id')) {
          reject(acknowledge, 'CONFLICT', error.message);
          return;
        }
        logger.error({ err: error, socketId: socket.id }, 'Could not send chat message');
        reject(acknowledge, 'INTERNAL_SERVER_ERROR', 'Could not send message');
      }
    });

    socket.on('chat:delete', async (input: unknown, acknowledge?: Acknowledge) => {
      try {
        const parsed = socketChatDeleteSchema.safeParse(input);
        if (!parsed.success) {
          reject(acknowledge, 'VALIDATION_ERROR', 'Invalid chat message');
          return;
        }
        const { messId, messageId } = parsed.data;
        const userId = socket.data.userId as string;
        if (!socket.rooms.has(roomName(messId)) || socket.data.chatMessId !== messId ||
            !(await isAuthorizedMessUser(messId, userId))) {
          reject(acknowledge, 'TENANT_ACCESS_DENIED', 'You do not have access to this mess chat');
          return;
        }

        const message = await prisma.chatMessage.findFirst({
          where: { id: messageId, messId, deletedAt: null },
          select: { id: true, userId: true },
        });
        if (!message) {
          reject(acknowledge, 'NOT_FOUND', 'Chat message not found');
          return;
        }
        if (message.userId !== userId) {
          reject(acknowledge, 'FORBIDDEN', 'You can only delete your own messages');
          return;
        }

        const deletedAt = new Date();
        await prisma.chatMessage.update({ where: { id: messageId }, data: { deletedAt } });
        emitChatMessageDeleted(messId, messageId, deletedAt);
        acknowledge?.({ ok: true });
      } catch (error) {
        logger.error({ err: error, socketId: socket.id }, 'Could not delete chat message');
        reject(acknowledge, 'INTERNAL_SERVER_ERROR', 'Could not delete message');
      }
    });

    socket.on('disconnect', () => clearSocketTyping(socket));
  });

  return io;
}
