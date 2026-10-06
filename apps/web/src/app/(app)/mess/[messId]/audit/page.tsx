'use client';
import { useState } from 'react';
import { AuditAction } from '@messmess/types';
import { useT } from '@/i18n';
import * as E from '@/lib/endpoints';
import { useQ } from '@/lib/hooks';
import { useMess } from '@/lib/use-mess';
import { Button, Card, Dt, Empty, ErrorBox, Field, Input, PageHeader, Select, Skeleton } from '@/components/ui';
import type { AuditEntry } from '@/lib/types';

export default function AuditPage() {
  const { messId, access } = useMess();
  const { t } = useT();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const query = useQ(['audit', messId, page, action, from, to], () => E.audit.list(messId, {
    page, limit: 25, ...(action ? { action } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}),
  }), access.isAdmin);
  if (!access.isAdmin) return <Empty title={t('err.FORBIDDEN')} />;
  return (
    <>
      <PageHeader title={t('nav.audit')} desc={t('audit.desc')} />
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t('audit.actionFilter')}><Select value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }}>
            <option value="">{t('common.all')}</option>
            {Object.values(AuditAction).map((value) => <option key={value} value={value}>{actionLabel(t, value)}</option>)}
          </Select></Field>
          <Field label={t('audit.from')}><Input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></Field>
          <Field label={t('audit.to')}><Input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></Field>
        </div>
      </Card>
      {query.isLoading ? <Skeleton rows={5} /> : query.isError ? <ErrorBox error={query.error} onRetry={() => { void query.refetch(); }} /> :
        query.data?.logs.length ? <>
          <ol className="space-y-2">{query.data.logs.map((log) => <AuditCard key={log.id} log={log} />)}</ol>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-sm text-muted">{t('audit.page', { page: query.data.page, total: query.data.total })}</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>{t('common.previous')}</Button>
              <Button variant="ghost" size="sm" disabled={!query.data.hasMore} onClick={() => setPage((current) => current + 1)}>{t('common.next')}</Button>
            </div>
          </div>
        </> : <Card><Empty title={t('audit.empty')} /></Card>}
    </>
  );
}

function AuditCard({ log }: { log: AuditEntry }) {
  const { t } = useT();
  const newState = log.newState === undefined || log.newState === null ? undefined : JSON.stringify(log.newState, null, 2) ?? '';
  return (
    <li><Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0"><p className="break-words font-semibold">{actionLabel(t, log.action)}</p>
          <p className="mt-1 text-sm text-muted">{log.actor.name}{log.targetType ? ` · ${log.targetType}` : ''}{log.targetId ? ` · ${log.targetId}` : ''}</p>
          {log.notes && <p className="mt-2 text-sm">{log.notes}</p>}
          {newState && <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-paper/70 p-2 text-xs text-muted">{newState}</pre>}</div>
        <Dt v={log.createdAt} time />
      </div>
    </Card></li>
  );
}

function actionLabel(t: (key: string) => string, action: string) {
  const key = `audit.action.${action}`;
  const translated = t(key);
  return translated === key ? action.replaceAll('_', ' ').toLowerCase() : translated;
}
