'use client';

import { io, type Socket } from 'socket.io-client';
import { getAccessToken, refreshAccessToken } from './api-client';

const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

let sharedSocket: Socket | null = null;
let consumers = 0;

function createSocket() {
  return io(socketUrl, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    auth: (callback) => {
      const token = getAccessToken();
      if (token) {
        callback({ token });
        return;
      }
      void refreshAccessToken().then((refreshedToken) => callback({ token: refreshedToken ?? '' }));
    },
  });
}

export function acquireChatSocket(): { socket: Socket; release: () => void } {
  sharedSocket ??= createSocket();
  const socket = sharedSocket;
  consumers += 1;
  let released = false;

  return {
    socket,
    release: () => {
      if (released) return;
      released = true;
      consumers -= 1;
      if (consumers === 0 && sharedSocket === socket) {
        socket.disconnect();
        sharedSocket = null;
      }
    },
  };
}

export interface ChatSocketAck<T = undefined> {
  ok: boolean;
  message?: T | string;
  code?: string;
  error?: string;
  receipts?: { messageId: string; userId: string; seenAt: string; user: { id: string; name: string } }[];
  unreadCount?: number;
}

export function emitChatSocketEvent<T>(
  socket: Socket,
  event: 'chat:join' | 'chat:send' | 'chat:delete' | 'chat:read' | 'chat:typing_start' | 'chat:typing_stop',
  payload: Record<string, unknown>,
): Promise<ChatSocketAck<T>> {
  return new Promise((resolve, reject) => {
    if (!socket.connected) {
      reject(new Error('Chat is not connected. Your message is still here; try again when reconnected.'));
      return;
    }
    socket.timeout(10_000).emit(event, payload, (timeoutError: Error | null, response: ChatSocketAck<T>) => {
      if (timeoutError) {
        reject(new Error('Chat server did not respond. Try sending again.'));
      } else if (!response?.ok) {
        reject(new Error(response?.error ?? (typeof response?.message === 'string' ? response.message : undefined) ?? response?.code ?? 'Chat request was rejected.'));
      } else {
        resolve(response);
      }
    });
  });
}
