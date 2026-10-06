import { z } from 'zod';

export const chatListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const chatMessageSchema = z.object({
  content: z.string().trim().min(1).max(2000).refine((value) => value.replace(/\s+/g, ' ').trim().length > 0, {
    message: 'Message content cannot be empty',
  }),
});

export const socketChatMessageSchema = chatMessageSchema.extend({
  messId: z.string().min(1).max(100),
  clientMessageId: z.string().min(1).max(100),
});

export const socketChatRoomSchema = z.object({
  messId: z.string().min(1).max(100),
});

export const socketChatTypingSchema = socketChatRoomSchema;

export const socketChatDeleteSchema = z.object({
  messId: z.string().min(1).max(100),
  messageId: z.string().min(1).max(100),
});

export const socketChatReadSchema = z.object({
  messId: z.string().min(1).max(100),
  messageIds: z.array(z.string().min(1).max(100)).min(1).max(100),
});

export const chatMessageParamsSchema = z.object({
  messageId: z.string().min(1).max(100),
});

export type ChatListQuery = z.infer<typeof chatListQuerySchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
