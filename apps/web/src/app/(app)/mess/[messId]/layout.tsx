'use client';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMessAccess } from '@/lib/access';
import { useT } from '@/i18n';
import { MessNav } from '@/components/shell';
import { Empty } from '@/components/ui';
import { useSession } from '@/lib/session';
import { acquireChatSocket, emitChatSocketEvent } from '@/lib/chat-socket';
import * as E from '@/lib/endpoints';

function MessChatRealtime({ messId }: { messId: string }) {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const { ctx } = useSession();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!ctx?.userId) return;
    const { socket, release } = acquireChatSocket();
    const isChatOpen = () => pathnameRef.current === `/mess/${messId}/chat`;
    const refreshUnread = () => {
      void E.chat.unreadCount(messId).then(
        ({ count }) => queryClient.setQueryData(['chat-unread', messId], count),
        () => queryClient.invalidateQueries({ queryKey: ['chat-unread', messId] }),
      );
    };
    const join = () => {
      void emitChatSocketEvent(socket, 'chat:join', { messId }).then(
        refreshUnread,
        () => queryClient.invalidateQueries({ queryKey: ['chat-unread', messId] }),
      );
    };
    const onMessage = (message: { messId: string; userId: string }) => {
      if (message.messId !== messId || message.userId === ctx.userId || isChatOpen()) return;
      queryClient.setQueryData<number | undefined>(['chat-unread', messId], (count) => count === undefined ? undefined : count + 1);
      if (queryClient.getQueryData(['chat-unread', messId]) === undefined) {
        void queryClient.invalidateQueries({ queryKey: ['chat-unread', messId] });
      }
    };
    const onRead = (event: { messId: string; readerUserId: string; unreadCount?: number }) => {
      if (event.messId === messId && event.readerUserId === ctx.userId && event.unreadCount !== undefined) {
        queryClient.setQueryData(['chat-unread', messId], event.unreadCount);
      }
    };
    const onDeleted = (event: { messId: string }) => {
      if (event.messId === messId) void queryClient.invalidateQueries({ queryKey: ['chat-unread', messId] });
    };

    socket.on('connect', join);
    socket.on('chat:message', onMessage);
    socket.on('chat:read', onRead);
    socket.on('chat:message_deleted', onDeleted);
    socket.connect();
    if (socket.connected) join();

    return () => {
      socket.off('connect', join);
      socket.off('chat:message', onMessage);
      socket.off('chat:read', onRead);
      socket.off('chat:message_deleted', onDeleted);
      release();
    };
  }, [ctx?.userId, messId, queryClient]);

  return null;
}

export default function MessLayout({ children }: { children: React.ReactNode }) {
  const { messId } = useParams<{ messId: string }>();
  const access = useMessAccess(messId);
  const { t } = useT();
  if (!access.known) {
    return <Empty title={t('err.TENANT_ACCESS_DENIED')} hint={t('mess.noAccessHint')} action={<Link href="/dashboard" className="text-brand underline">{t('nav.home')}</Link>} />;
  }
  return (
    <div className="flex gap-6 xl:gap-8">
      {!(access.isDirector && !access.isAdmin && !access.isManager && !access.isBoarder) && <MessChatRealtime messId={messId} />}
      <MessNav messId={messId} access={access} />
      <main className="min-w-0 flex-1 pb-24 lg:pb-8">{children}</main>
    </div>
  );
}
