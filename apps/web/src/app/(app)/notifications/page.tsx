'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCheck } from 'lucide-react';
import { useT } from '@/i18n';
import * as E from '@/lib/endpoints';
import type { Notification, NotificationFilter } from '@/lib/types';
import { useAct, useQ } from '@/lib/hooks';
import { Button, Card, Empty, ErrorBox, PageHeader, Skeleton } from '@/components/ui';
import { notificationHref, notificationParams } from '@/components/notification-bell';

const FILTERS: NotificationFilter[] = ['all', 'unread', 'read'];

export default function NotificationsPage() {
  const { t } = useT();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t('notifications.title')} desc={t('notifications.desc')} />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={t('notifications.title')}>
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={`min-h-10 shrink-0 rounded-xl px-4 text-sm font-semibold transition-colors ${filter === value ? 'bg-brand text-brand-ink' : 'border border-line bg-surface text-muted hover:bg-paper hover:text-ink'}`}
          >
            {t(`notifications.${value}`)}
          </button>
        ))}
      </div>
      <Card className="p-2 sm:p-3">
        <NotificationList key={filter} filter={filter} />
      </Card>
    </div>
  );
}

function NotificationList({ filter }: { filter: NotificationFilter }) {
  const { t, lang } = useT();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Notification[]>([]);
  const q = useQ(['notifications', 'list', filter, page], () => E.notifications.list(filter, page, 20));
  const markRead = useAct((id: string) => E.notifications.markRead(id), {
    onDone: () => {
      setItems([]);
      setPage(1);
    },
  });
  const markAll = useAct(() => E.notifications.markAllRead(), {
    onDone: () => {
      setItems([]);
      setPage(1);
    },
  });

  useEffect(() => {
    const response = q.data;
    if (!response) return;
    setItems((previous) => {
      if (page === 1) return response.notifications;
      const existing = new Set(previous.map((notification) => notification.id));
      return [...previous, ...response.notifications.filter((notification) => !existing.has(notification.id))];
    });
  }, [q.data, page]);

  const openNotification = (notification: Notification) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    router.push(notificationHref(notification));
  };
  const formatDate = (value: string) => new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-US', {
    timeZone: 'Asia/Dhaka',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

  if (q.isLoading && items.length === 0) return <Skeleton rows={5} />;
  if (q.isError && items.length === 0) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  if (items.length === 0) return <Empty title={t('notifications.empty')} hint={t('notifications.emptyHint')} />;

  return (
    <div>
      <div className="divide-y divide-line/60">
        {items.map((notification) => {
          const params = notificationParams(notification);
          return (
            <button
              key={notification.id}
              type="button"
              onClick={() => openNotification(notification)}
              className={`flex w-full items-start gap-3 rounded-xl px-3 py-4 text-left transition-colors hover:bg-paper focus-visible:outline-2 focus-visible:outline-brand sm:px-4 ${notification.isRead ? '' : 'bg-brand-soft/25'}`}
            >
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notification.isRead ? 'bg-line' : 'bg-brand'}`} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-semibold leading-snug text-ink">{t(notification.title, params)}</span>
                  <time dateTime={notification.createdAt} className="text-xs text-muted">{formatDate(notification.createdAt)}</time>
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-muted">{t(notification.body, params)}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col-reverse items-stretch justify-between gap-2 border-t border-line/60 px-2 py-3 sm:flex-row sm:items-center">
        <Button
          variant="quiet"
          size="sm"
          disabled={markAll.isPending || items.every((notification) => notification.isRead)}
          onClick={() => markAll.mutate()}
          className="min-h-10"
        >
          <CheckCheck className="h-4 w-4" aria-hidden />
          {t('notifications.markAllRead')}
        </Button>
        {q.data?.hasMore && (
          <Button variant="ghost" size="sm" disabled={q.isFetching} onClick={() => setPage((current) => current + 1)}>
            {t('notifications.loadMore')}
          </Button>
        )}
      </div>
      {q.isError && items.length > 0 && <div className="mt-3"><ErrorBox error={q.error} onRetry={() => q.refetch()} /></div>}
    </div>
  );
}
