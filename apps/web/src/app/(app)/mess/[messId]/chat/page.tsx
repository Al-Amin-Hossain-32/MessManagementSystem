'use client';

import clsx from 'clsx';
import { ArrowUp, RotateCcw, Trash2, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useT } from '@/i18n';
import { Button, Card, Empty, ErrorBox, PageHeader, Skeleton } from '@/components/ui';
import { ConfirmDialog } from '@/components/dialogs';
import * as E from '@/lib/endpoints';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/toast';
import { useQ } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { useMess } from '@/lib/use-mess';
import { acquireChatSocket, emitChatSocketEvent } from '@/lib/chat-socket';
import { refreshAccessToken } from '@/lib/api-client';
import type { ChatMember, ChatMessage } from '@/lib/types';

function chatDayLabel(value: string, lang: string) {
  return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-US', {
    timeZone: 'Asia/Dhaka',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function chatTime(value: string, lang: string) {
  return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-US', {
    timeZone: 'Asia/Dhaka',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]) {
  const messages = new Map(existing.map((message) => [message.id, message]));
  for (const message of incoming) messages.set(message.id, message);
  return [...messages.values()].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

type ConnectionStatus = 'connected' | 'reconnecting' | 'offline';
type TypingUser = { messId: string; userId: string; name: string };

export default function ChatPage() {
  const { messId } = useMess();
  const { ctx } = useSession();
  const { t, lang } = useT();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState('');
  const [items, setItems] = useState<ChatMessage[]>([]);
  const [connection, setConnection] = useState<ConnectionStatus>('reconnecting');
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<ReturnType<typeof acquireChatSocket>['socket'] | null>(null);
  const pendingMessageRef = useRef<{ content: string; clientMessageId: string } | null>(null);
  const localTypingRef = useRef(false);
  const localTypingAtRef = useRef(0);
  const localTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingUserTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const q = useQ(['chat', messId, 'messages', page], () => E.chat.list(messId, page, 20));
  const members = useQ(['chat', messId, 'members'], () => E.chat.members(messId));
  const stopTyping = useCallback(() => {
    if (localTypingTimerRef.current) clearTimeout(localTypingTimerRef.current);
    localTypingTimerRef.current = null;
    if (!localTypingRef.current) return;
    localTypingRef.current = false;
    localTypingAtRef.current = 0;
    const socket = socketRef.current;
    if (socket?.connected) socket.emit('chat:typing_stop', { messId });
  }, [messId]);
  const updateDraft = useCallback((value: string) => {
    setDraft(value);
    const socket = socketRef.current;
    if (!value.trim()) {
      stopTyping();
      return;
    }
    if (!socket?.connected) return;
    if (!localTypingRef.current) {
      localTypingRef.current = true;
      localTypingAtRef.current = Date.now();
      socket.emit('chat:typing_start', { messId });
    } else if (Date.now() - localTypingAtRef.current >= 2_500) {
      localTypingAtRef.current = Date.now();
      socket.emit('chat:typing_start', { messId });
    }
    if (localTypingTimerRef.current) clearTimeout(localTypingTimerRef.current);
    localTypingTimerRef.current = setTimeout(stopTyping, 1_200);
  }, [messId, stopTyping]);
  const onIncomingMessage = useCallback((message: ChatMessage) => {
    if (message.messId !== messId) return;
    setItems((previous) => mergeMessages(previous, [message]));
  }, [messId]);
  const applyReceipts = useCallback((receipts: NonNullable<ChatMessage['readReceipts']>) => {
    if (!receipts.length) return;
    setItems((previous) => previous.map((message) => {
      const additions = receipts.filter((receipt) => receipt.messageId === message.id);
      if (!additions.length) return message;
      const merged = new Map((message.readReceipts ?? []).map((receipt) => [receipt.userId, receipt]));
      additions.forEach((receipt) => merged.set(receipt.userId, receipt));
      return { ...message, readReceipts: [...merged.values()] };
    }));
  }, []);
  const send = useMutation({
    mutationFn: async (input: { content: string; clientMessageId: string }) => {
      const socket = socketRef.current;
      if (!socket) throw new Error('Chat connection is not ready. Your message is still here; try again shortly.');
      const response = await emitChatSocketEvent<ChatMessage>(socket, 'chat:send', { messId, ...input });
      if (!response.message || typeof response.message === 'string') throw new Error('Chat server returned no saved message.');
      return response.message;
    },
    onSuccess: (message, input) => {
      stopTyping();
      onIncomingMessage(message);
      if (pendingMessageRef.current?.clientMessageId === input.clientMessageId) {
        pendingMessageRef.current = null;
        setDraft('');
      }
      setPage(1);
      toast(t('chat.sent'));
    },
    onError: (error) => toast(errorMessage(error, t), 'err'),
  });
  const remove = useMutation({
    mutationFn: (messageId: string) => E.chat.delete(messId, messageId),
    onSuccess: (result, messageId) => {
      setItems((previous) => previous.map((message) => message.id === messageId
        ? { ...message, content: '', deletedAt: result.message.deletedAt ?? new Date().toISOString() }
        : message));
      toast(t('chat.deleted'));
    },
    onError: (error) => toast(errorMessage(error, t), 'err'),
  });

  useEffect(() => {
    setItems([]);
    setPage(1);
    setDraft('');
    pendingMessageRef.current = null;
    setTypingUsers([]);
    for (const timer of typingUserTimersRef.current.values()) clearTimeout(timer);
    typingUserTimersRef.current.clear();
    localTypingRef.current = false;
    localTypingAtRef.current = 0;
    if (localTypingTimerRef.current) clearTimeout(localTypingTimerRef.current);
    localTypingTimerRef.current = null;
    setConnection('reconnecting');
  }, [messId]);

  useEffect(() => {
    let active = true;
    let refreshingAuth = false;
    let connectedOnce = false;
    const { socket, release } = acquireChatSocket();
    socketRef.current = socket;
    setConnection('reconnecting');

    const onConnect = async () => {
      const isReconnect = connectedOnce;
      connectedOnce = true;
      setConnection('reconnecting');
      try {
        await emitChatSocketEvent(socket, 'chat:join', { messId });
        if (!active) return;
        setConnection('connected');
        if (isReconnect) {
          const latest = await E.chat.list(messId, 1, 20);
          if (active) setItems((previous) => mergeMessages(previous, latest.messages));
        }
      } catch {
        if (active) setConnection('offline');
      }
    };
    const onConnectError = (error: Error) => {
      if (error.message === 'UNAUTHORIZED' && !refreshingAuth) {
        refreshingAuth = true;
        setConnection('reconnecting');
        void refreshAccessToken()
          .then((token) => {
            if (active && token) socket.connect();
            else if (active) setConnection('offline');
          })
          .finally(() => { refreshingAuth = false; });
      } else if (!socket.active) {
        setConnection('offline');
      } else {
        setConnection('reconnecting');
      }
    };
    const onMessageDeleted = (event: { messId: string; messageId: string; deletedAt?: string }) => {
      if (event.messId === messId) {
        setItems((previous) => previous.map((message) => message.id === event.messageId
          ? { ...message, content: '', deletedAt: event.deletedAt ?? new Date().toISOString() }
          : message));
      }
    };
    const onReadReceipt = (event: { messId: string; receipts?: NonNullable<ChatMessage['readReceipts']> }) => {
      if (event.messId === messId && event.receipts) applyReceipts(event.receipts);
    };
    const clearTypingUsers = () => {
      for (const timer of typingUserTimersRef.current.values()) clearTimeout(timer);
      typingUserTimersRef.current.clear();
      setTypingUsers([]);
    };
    const onTypingStart = (event: TypingUser) => {
      if (event.messId !== messId || event.userId === ctx?.userId) return;
      const existingTimer = typingUserTimersRef.current.get(event.userId);
      if (existingTimer) clearTimeout(existingTimer);
      setTypingUsers((previous) => [
        ...previous.filter((user) => user.userId !== event.userId),
        event,
      ]);
      typingUserTimersRef.current.set(event.userId, setTimeout(() => {
        typingUserTimersRef.current.delete(event.userId);
        setTypingUsers((previous) => previous.filter((user) => user.userId !== event.userId));
      }, 6_000));
    };
    const onTypingStop = (event: TypingUser) => {
      if (event.messId !== messId) return;
      const timer = typingUserTimersRef.current.get(event.userId);
      if (timer) clearTimeout(timer);
      typingUserTimersRef.current.delete(event.userId);
      setTypingUsers((previous) => previous.filter((user) => user.userId !== event.userId));
    };
    const onReconnectAttempt = () => setConnection('reconnecting');
    const onReconnectFailed = () => setConnection('offline');
    const onDisconnect = () => {
      setConnection('reconnecting');
      localTypingRef.current = false;
      localTypingAtRef.current = 0;
      if (localTypingTimerRef.current) clearTimeout(localTypingTimerRef.current);
      localTypingTimerRef.current = null;
      clearTypingUsers();
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('chat:message', onIncomingMessage);
    socket.on('chat:message_deleted', onMessageDeleted);
    socket.on('chat:read', onReadReceipt);
    socket.on('chat:typing_start', onTypingStart);
    socket.on('chat:typing_stop', onTypingStop);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.io.on('reconnect_failed', onReconnectFailed);
    socket.connect();
    if (socket.connected) void onConnect();

    return () => {
      active = false;
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('chat:message', onIncomingMessage);
      socket.off('chat:message_deleted', onMessageDeleted);
      socket.off('chat:read', onReadReceipt);
      socket.off('chat:typing_start', onTypingStart);
      socket.off('chat:typing_stop', onTypingStop);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.io.off('reconnect_failed', onReconnectFailed);
      if (localTypingRef.current && socket.connected) socket.emit('chat:typing_stop', { messId });
      localTypingRef.current = false;
      localTypingAtRef.current = 0;
      if (localTypingTimerRef.current) clearTimeout(localTypingTimerRef.current);
      localTypingTimerRef.current = null;
      clearTypingUsers();
      if (socketRef.current === socket) socketRef.current = null;
      release();
    };
  }, [messId, onIncomingMessage, applyReceipts, ctx?.userId]);

  useEffect(() => {
    if (!q.data) return;
    setItems((previous) => mergeMessages(previous, q.data.messages));
  }, [q.data, page]);

  useEffect(() => {
    if (connection !== 'connected' || !ctx?.userId || !socketRef.current) return;
    const unreadIds = items
      .filter((message) => message.userId !== ctx.userId && !message.deletedAt &&
        !(message.readReceipts ?? []).some((receipt) => receipt.userId === ctx.userId))
      .map((message) => message.id);
    if (!unreadIds.length) return;
    void emitChatSocketEvent(socketRef.current, 'chat:read', { messId, messageIds: unreadIds })
      .then((result) => {
        if (result.receipts) applyReceipts(result.receipts);
      })
      .catch((error) => toast(errorMessage(error, t), 'err'));
  }, [items, connection, ctx?.userId, messId, applyReceipts, t, toast]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [items.length, page, send.isPending]);

  const grouped = useMemo(() => {
    return [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).reduce<Record<string, ChatMessage[]>>((acc, message) => {
      const day = new Date(message.createdAt).toISOString().slice(0, 10);
      if (!acc[day]) acc[day] = [];
      acc[day].push(message);
      return acc;
    }, {});
  }, [items]);

  const submit = () => {
    const value = draft.trim();
    if (!value || send.isPending) return;
    stopTyping();
    if (!pendingMessageRef.current || pendingMessageRef.current.content !== value) {
      pendingMessageRef.current = { content: value, clientMessageId: crypto.randomUUID() };
    }
    send.mutate(pendingMessageRef.current);
  };

  if (q.isLoading && items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title={t('chat.title')} desc={t('chat.desc')} />
        <Card><Skeleton rows={6} /></Card>
      </div>
    );
  }

  if (q.isError && items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title={t('chat.title')} desc={t('chat.desc')} />
        <ErrorBox error={q.error} onRetry={() => { void q.refetch(); }} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t('chat.title')} desc={t('chat.desc')} actions={
        <div className="flex items-center gap-2">
          <span role="status" aria-live="polite" className="inline-flex items-center gap-1.5 text-xs text-muted">
            <span className={clsx('h-2 w-2 rounded-full', connection === 'connected' ? 'bg-brand' : connection === 'reconnecting' ? 'animate-pulse bg-holud' : 'bg-muted')} aria-hidden />
            {t(`chat.connection.${connection}`)}
          </span>
          <Button variant="ghost" size="sm" onClick={() => { setPage(1); void q.refetch(); }} disabled={q.isFetching}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            {t('common.retry')}
          </Button>
        </div>
      } />

      <Card className="overflow-hidden p-0">
        <div className="border-b border-line/80 bg-surface px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Users className="h-4 w-4 text-brand" aria-hidden />
            <span>{members.isLoading ? t('chat.membersLoading') : t('chat.members', { count: members.data?.members.length ?? 0 })}</span>
          </div>
          {members.isError ? (
            <button type="button" className="mt-1 text-xs text-danger underline" onClick={() => void members.refetch()}>{t('common.retry')}</button>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5" aria-label={t('chat.membersList')}>
              {(members.data?.members ?? []).map((member: ChatMember) => (
                <span key={member.id} className="rounded-full bg-paper px-2.5 py-1 text-xs text-muted">
                  {member.name}{member.id === ctx?.userId ? ` (${t('chat.you')})` : ''}
                  {member.roles.map((role) => (
                    <span key={role} className="ml-1 text-brand">
                      · {t(role === 'MANAGER' ? 'role.manager' : role === 'BOARDER' ? 'role.boarder' : `st.${role}`)}
                    </span>
                  ))}
                </span>
              ))}
            </div>
          )}
        </div>
        <div ref={scrollRef} className="max-h-[68vh] min-h-[380px] overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
          {items.length === 0 ? (
            <div className="h-full min-h-[300px]">
              <Empty title={t('chat.empty')} hint={t('chat.emptyHint')} />
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([day, messages]) => (
                <div key={day} className="space-y-3">
                  <div className="flex justify-center">
                    <span className="rounded-full border border-line bg-paper px-2.5 py-1 text-[0.68rem] font-medium text-muted">
                      {chatDayLabel(day, lang)}
                    </span>
                  </div>
                  {messages.map((message) => {
                    const isOwn = message.userId === ctx?.userId;
                    return (
                      <div key={message.id} className={clsx('flex', isOwn ? 'justify-end' : 'justify-start')}>
                        <div className={clsx('flex max-w-[85%] items-end gap-2', isOwn ? 'flex-row-reverse' : 'flex-row')}>
                          {!isOwn && (
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft font-head text-[0.7rem] font-bold text-brand">
                              {initials(message.sender?.name ?? 'Unknown')}
                            </div>
                          )}
                          <div className={clsx('rounded-2xl border px-3 py-2 shadow-sm', isOwn ? 'border-brand bg-brand text-brand-ink' : 'border-line bg-paper text-ink')}>
                            {!isOwn && (
                              <div className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted">{message.sender?.name ?? 'Unknown'}</div>
                            )}
                            <p className={clsx('whitespace-pre-wrap break-words text-sm leading-relaxed', message.deletedAt && 'italic opacity-75')}>
                              {message.deletedAt ? t('chat.messageDeleted') : message.content}
                            </p>
                            <div className={clsx('mt-2 flex items-center gap-2 text-[0.62rem]', isOwn ? 'justify-end text-brand-ink/80' : 'justify-start text-muted')}>
                              <time dateTime={message.createdAt}>{chatTime(message.createdAt, lang)}</time>
                              {isOwn && !message.deletedAt && (
                                <button type="button" aria-label={t('chat.delete')} onClick={() => setDeleteMessageId(message.id)} className="min-h-11 min-w-11 rounded-full p-1 hover:bg-brand-ink/10 disabled:opacity-50" disabled={remove.isPending}>
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                </button>
                              )}
                            </div>
                            {isOwn && (message.readReceipts?.length ?? 0) > 0 && (
                              <div className="mt-1 break-words text-right text-[0.62rem] text-brand-ink/75">
                                {t('chat.seenBy', { names: message.readReceipts!.map((receipt) => receipt.user.name).join(', ') })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {q.data?.hasMore && (
            <div className="mt-4 flex justify-center">
              <Button variant="ghost" size="sm" disabled={q.isFetching} onClick={() => setPage((current) => current + 1)}>
                {q.isFetching ? <span className="inline-flex items-center gap-2"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> {t('common.retry')}</span> : t('chat.loadOlder')}
              </Button>
            </div>
          )}
        </div>

        <div className="border-t border-line/80 bg-surface/90 p-3 backdrop-blur sm:p-4">
          {typingUsers.length > 0 && (
            <div className="mb-3 flex min-h-10 items-center" role="status" aria-live="polite">
              <div className="inline-flex max-w-full items-center gap-2.5 rounded-full border border-brand/15 bg-brand-soft/70 py-1.5 pl-1.5 pr-3 shadow-sm">
                <div className="flex shrink-0 -space-x-2" aria-hidden>
                  {typingUsers.slice(0, 3).map((user) => (
                    <span key={user.userId} className="grid h-8 w-8 place-items-center rounded-full border-2 border-surface bg-paper font-head text-[0.62rem] font-bold text-brand shadow-sm">
                      {initials(user.name)}
                    </span>
                  ))}
                </div>
                <span className="min-w-0 truncate text-xs font-medium text-ink">
                  {typingUsers.length === 1
                    ? t('chat.typing.single', { name: typingUsers[0].name })
                    : typingUsers.length === 2
                      ? t('chat.typing.two', { first: typingUsers[0].name, second: typingUsers[1].name })
                      : t('chat.typing.many', {
                        first: typingUsers[0].name,
                        second: typingUsers[1].name,
                        count: typingUsers.length - 2,
                      })}
                </span>
                <span className="chat-typing-wave shrink-0" aria-hidden>
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              rows={1}
              onChange={(event) => updateDraft(event.target.value)}
              onBlur={stopTyping}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder={t('chat.sendPlaceholder')}
              className="max-h-32 min-h-12 flex-1 resize-none rounded-2xl border border-line bg-paper px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <Button type="button" onClick={submit} disabled={!draft.trim() || send.isPending || connection !== 'connected'} busy={send.isPending} className="min-h-12 min-w-12 shrink-0">
              <ArrowUp className="h-4 w-4" aria-hidden />
              {t('chat.send')}
            </Button>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={!!deleteMessageId}
        onClose={() => setDeleteMessageId(null)}
        title={t('chat.confirmDelete')}
        desc={t('chat.confirmDeleteHint')}
        reasonRequired={false}
        confirmLabel={t('chat.confirmDeleteAction')}
        danger
        onConfirm={async () => {
          if (!deleteMessageId) return;
          await remove.mutateAsync(deleteMessageId);
          setDeleteMessageId(null);
        }}
      />

      {q.isError && items.length > 0 && (
        <div className="mt-4">
          <ErrorBox error={q.error} onRetry={() => { void q.refetch(); }} />
        </div>
      )}
    </div>
  );
}
