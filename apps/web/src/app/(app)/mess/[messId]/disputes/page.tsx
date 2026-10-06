'use client';
import { useState } from 'react';
import { useT } from '@/i18n';
import * as E from '@/lib/endpoints';
import { useAct, useQ } from '@/lib/hooks';
import { useMess } from '@/lib/use-mess';
import { Async, Button, Dt, Field, PageHeader, Select, StatusBadge, Tabs } from '@/components/ui';
import { DataTable } from '@/components/table';
import { ConfirmDialog, FormDialog } from '@/components/dialogs';
import type { Dispute } from '@/lib/types';

const TARGETS = ['MEAL_RECORD', 'PAYMENT', 'EXPENSE_ALLOCATION', 'STATEMENT'];
type Tab = 'mine' | 'all';

export default function DisputesPage() {
  const { messId, access } = useMess();
  const { t } = useT();
  const tabs = [...(access.isBoarder ? [{ id: 'mine' as Tab, label: t('disp.mine') }] : []), ...(access.isStaff ? [{ id: 'all' as Tab, label: t('disp.all') }] : [])];
  const [tab, setTab] = useState<Tab>(tabs[0]?.id ?? 'mine');
  const [status, setStatus] = useState('');
  const [raise, setRaise] = useState(false);
  const [dlg, setDlg] = useState<{ kind: 'resolve' | 'dismiss'; id: string } | null>(null);
  const mine = useQ(['disp', messId, 'mine'], () => E.disputes.mine(messId), access.isBoarder);
  const all = useQ(['disp', messId, 'all', status], () => E.disputes.list(messId, { status }), access.isStaff);
  const create = useAct((p: Record<string, unknown>) => E.disputes.raise(messId, p), { ok: 'disp.raised' });
  const review = useAct((id: string) => E.disputes.review(messId, id), { ok: 'disp.reviewing' });
  const resolve = useAct((a: { id: string; text: string }) => E.disputes.resolve(messId, a.id, a.text), { ok: 'disp.resolved' });
  const dismiss = useAct((a: { id: string; text: string }) => E.disputes.dismiss(messId, a.id, a.text), { ok: 'disp.dismissed' });

  const cols = (who: boolean) => [
    { key: 'd', header: t('common.date'), cell: (r: Dispute) => <Dt v={r.createdAt} />, primary: true },
    ...(who ? [{ key: 'w', header: t('common.name'), cell: (r: Dispute) => r.raisedBy?.user?.name ?? '—' }] : []),
    { key: 't', header: t('disp.target'), cell: (r: Dispute) => t(`target.${r.targetType}`) },
    { key: 'x', header: t('common.description'), cell: (r: Dispute) => <span className="line-clamp-2">{r.description}</span> },
    { key: 'r', header: t('disp.resolution'), cell: (r: Dispute) => r.resolution || '—' },
    { key: 's', header: t('common.status'), cell: (r: Dispute) => <StatusBadge value={r.status} /> },
  ];
  return (
    <>
      <PageHeader title={t('nav.disputes')} desc={t('disp.desc')} actions={access.isBoarder && <Button onClick={() => setRaise(true)}>{t('disp.raise')}</Button>} />
      {tabs.length > 1 && <Tabs tabs={tabs} value={tab} onChange={setTab} />}
      {tab === 'mine' && access.isBoarder && <Async q={mine}>{(d) => <DataTable rows={d.disputes} rowKey={(r) => r.id} empty={t('disp.none')} cols={cols(false)} />}</Async>}
      {tab === 'all' && access.isStaff && (
        <div className="space-y-4">
          <Field label={t('common.status')}><Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto"><option value="">{t('common.all')}</option>
            {['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED', 'ESCALATED'].map((s) => <option key={s} value={s}>{t(`st.${s}`)}</option>)}</Select></Field>
          <Async q={all}>{(d) => (
            <DataTable rows={d.disputes} rowKey={(r) => r.id} empty={t('disp.none')} cols={cols(true)}
              actions={(r) => (<>
                {r.status === 'OPEN' && <Button size="sm" variant="ghost" onClick={() => review.mutate(r.id)}>{t('disp.startReview')}</Button>}
                {access.isAdmin && (r.status === 'OPEN' || r.status === 'UNDER_REVIEW') && (<>
                  <Button size="sm" onClick={() => setDlg({ kind: 'resolve', id: r.id })}>{t('disp.resolve')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setDlg({ kind: 'dismiss', id: r.id })}>{t('disp.dismiss')}</Button></>)}</>)} />)}</Async>
        </div>
      )}
      <FormDialog open={raise} onClose={() => setRaise(false)} title={t('disp.raise')} submitLabel={t('common.submit')} desc={t('disp.raiseHint')}
        fields={[{ name: 'targetType', label: t('disp.target'), type: 'select', required: true, options: TARGETS.map((x) => ({ value: x, label: t(`target.${x}`) })) },
          { name: 'targetId', label: t('disp.targetId'), required: true, hint: t('disp.targetIdHint') },
          { name: 'description', label: t('disp.describe'), type: 'textarea', required: true }]}
        onSubmit={(p) => create.mutateAsync(p)} />
      <ConfirmDialog open={!!dlg} onClose={() => setDlg(null)} title={dlg?.kind === 'resolve' ? t('disp.resolve') : t('disp.dismiss')}
        reasonLabel={dlg?.kind === 'resolve' ? t('disp.resolution') : t('common.reason')} danger={dlg?.kind === 'dismiss'}
        onConfirm={(text) => (dlg!.kind === 'resolve' ? resolve : dismiss).mutateAsync({ id: dlg!.id, text })} />
    </>
  );
}
