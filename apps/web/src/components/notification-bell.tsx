'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { useT } from '@/i18n';
import * as E from '@/lib/endpoints';
import type { Notification } from '@/lib/types';
import { useAct, useQ } from '@/lib/hooks';
import { Empty, ErrorBox, Skeleton } from './ui';

export function notificationHref(notification: Notification): string {
  const data = notification.data;
  if (!data || typeof data !== 'object' || !('href' in data) || typeof data.href !== 'string') {
    return '/dashboard';
  }
  return /^\/(?:dashboard|mess\/[^/?#]+\/(?:members|expenses|payments))(?:[?#].*)?$/.test(data.href)
    ? data.href
    : '/dashboard';
}

export function notificationParams(notification: Notification): Record<string, string | number> {
  const data = notification.data;
  if (!data || typeof data !== 'object' || !('params' in data) || !data.params || typeof data.params !== 'object') {
    return {};
  }
  return Object.fromEntries(
    Object.entries(data.params).filter((entry): entry is [string, string | number] =>
      typeof entry[1] === 'string' || typeof entry[1] === 'number',
    ),
  );
}

function NotificationItem({ notification, onOpen }: { notification: Notification; onOpen?: () => void }) {
  const { t, lang } = useT();
  const href = notificationHref(notification);
  const params = notificationParams(notification);
  const createdAt = new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-US', {
    timeZone: 'Asia/Dhaka',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(notification.createdAt));

  return (
    <Link
      href={href}
      onClick={(event) => {
        if (onOpen) {
          event.preventDefault();
          onOpen();
        }
      }}
      className="group flex gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-paper focus-visible:outline-2 focus-visible:outline-brand"
    >
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
        <Bell className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold leading-snug text-ink">{t(notification.title, params)}</span>
          {!notification.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label={t('notifications.unread')} />}
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-muted">{t(notification.body, params)}</span>
        <time dateTime={notification.createdAt} className="mt-1.5 block text-xs text-muted">{createdAt}</time>
      </span>
    </Link>
  );
}

export function NotificationBell() {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const count = useQ(['notifications', 'unread-count'], E.notifications.unreadCount);
  const list = useQ(['notifications', 'list', 'all', 1, 6], () => E.notifications.list('all', 1, 6), open);
  const markRead = useAct((id: string) => E.notifications.markRead(id));
  const markAll = useAct(() => E.notifications.markAllRead());
  const unreadCount = count.data?.count ?? 0;
  const notifications = list.data?.notifications ?? [];

  const openNotification = (notification: Notification) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    setOpen(false);
    router.push(notificationHref(notification));
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={t('notifications.title')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative grid h-10 w-10 place-items-center rounded-xl text-muted transition-colors hover:bg-brand-soft hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 min-w-[1.1rem] rounded-full bg-morich px-1 text-center text-[0.65rem] font-bold leading-[1.1rem] text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label={t('notifications.title')} className="absolute right-0 top-12 z-50 w-[min(23rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_16px_48px_rgb(29_43_38/0.16)]">
          <div className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3">
            <div className="min-w-0">
              <h2 className="font-head font-bold text-ink">{t('notifications.title')}</h2>
              <p className="text-xs text-muted">{t('notifications.unread')}: {unreadCount}</p>
            </div>
            <button
              type="button"
              disabled={!unreadCount || markAll.isPending}
              onClick={() => markAll.mutate()}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={t('notifications.markAllRead')}
              title={t('notifications.markAllRead')}
            >
              <CheckCheck className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="max-h-[min(65vh,28rem)] overflow-y-auto p-2">
            {list.isError ? <ErrorBox error={list.error} onRetry={() => list.refetch()} /> :
              list.isLoading || !list.data ? <Skeleton rows={3} /> :
                notifications.length === 0 ? <Empty title={t('notifications.empty')} hint={t('notifications.emptyHint')} /> :
                  notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onOpen={() => openNotification(notification)}
                  />
                ))}
          </div>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center justify-center gap-2 border-t border-line/70 px-3 text-sm font-semibold text-brand transition-colors hover:bg-brand-soft"
          >
            {t('notifications.viewAll')}
          </Link>
        </div>
      )}
    </div>
  );
}
