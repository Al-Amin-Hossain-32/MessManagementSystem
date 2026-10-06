'use client';
import { useState } from 'react';
import { z } from 'zod';
import { useT } from '@/i18n';
import * as E from '@/lib/endpoints';
import { useAct, useQ } from '@/lib/hooks';
import { useBoarders, useMess } from '@/lib/use-mess';
import { Async, Button, Dt, Field, Money, PageHeader, Select, StatusBadge, Tabs } from '@/components/ui';
import { DataTable } from '@/components/table';
import { ConfirmDialog, FormDialog } from '@/components/dialogs';
import type { Payment } from '@/lib/types';

const DIGITAL = ['BKASH', 'NAGAD', 'BANK_TRANSFER', 'OTHER'];
type Tab = 'mine' | 'all';
type Dlg = { kind: 'dispute' | 'reject' | 'resolveReject' | 'reverse'; id: string } | null;

export default function PaymentsPage() {
  const { messId, access } = useMess();
  const { t } = useT();
  const tabs = [...(access.isBoarder ? [{ id: 'mine' as Tab, label: t('pay.mine') }] : []), ...((access.isStaff || access.isDirector) ? [{ id: 'all' as Tab, label: t('pay.all') }] : [])];
  const [tab, setTab] = useState<Tab>(tabs[0]?.id ?? 'mine');
  const [status, setStatus] = useState('');
  const [digital, setDigital] = useState(false);
  const [cash, setCash] = useState(false);
  const [dlg, setDlg] = useState<Dlg>(null);

  const mine = useQ(['pay', messId, 'mine'], () => E.payments.mine(messId), access.isBoarder);
  const all = useQ(['pay', messId, 'all', status], () => E.payments.list(messId, { status }), access.isStaff || access.isDirector);
  const boarders = useBoarders(messId, access.isStaff);
  const submitDigital = useAct((p: Record<string, unknown>) => E.payments.digital(messId, p), { ok: 'pay.submitted' });
  const recordCash = useAct((p: Record<string, unknown>) => E.payments.cash(messId, p), { ok: 'pay.recorded' });
  const confirmCash = useAct((id: string) => E.payments.confirmCash(messId, id), { ok: 'pay.confirmed' });
  const verify = useAct((a: { id: string; decision: string; reason?: string }) => E.payments.verifyDigital(messId, a.id, { decision: a.decision, reason: a.reason }), { ok: 'common.done' });
  const resolve = useAct((a: { id: string; decision: string; reason?: string }) => E.payments.resolve(messId, a.id, { decision: a.decision, reason: a.reason }), { ok: 'common.done' });
  const dispute = useAct((a: { id: string; reason: string }) => E.payments.disputeCash(messId, a.id, a.reason), { ok: 'pay.disputed' });
  const reverse = useAct((a: { id: string; reason: string }) => E.payments.reverse(messId, a.id, a.reason), { ok: 'common.done' });

  const cols = (showWho: boolean) => [
    { key: 'd', header: t('common.date'), cell: (r: Payment) => <Dt v={r.initiatedAt} time />, primary: true },
    ...(showWho ? [{ key: 'w', header: t('common.name'), cell: (r: Payment) => r.boarderMembership?.user?.name ?? '—' }] : []),
    { key: 'm', header: t('pay.method'), cell: (r: Payment) => t(`method.${r.method}`) },
    { key: 'a', header: t('common.amount'), cell: (r: Payment) => <Money v={r.amount} className="font-medium" /> },
    { key: 'r', header: t('pay.ref'), cell: (r: Payment) => r.transactionRef || '—' },
    { key: 's', header: t('common.status'), cell: (r: Payment) => <StatusBadge value={r.status} /> },
  ];

  return (
    <>
      <PageHeader title={t('nav.payments')} desc={t('pay.desc')}
        actions={<>
          {access.isBoarder && <Button onClick={() => setDigital(true)}>{t('pay.submitDigital')}</Button>}
          {access.isStaff && <Button variant={access.isBoarder ? 'ghost' : 'primary'} onClick={() => setCash(true)}>{t('pay.recordCash')}</Button>}
        </>} />
      {tabs.length > 1 && <Tabs tabs={tabs} value={tab} onChange={setTab} />}

      {tab === 'mine' && access.isBoarder && (
        <Async q={mine}>{(d) => (
          <DataTable rows={d.payments} rowKey={(r) => r.id} empty={t('pay.none')} cols={cols(false)}
            actions={(r) => {
              if (r.status !== 'PENDING_CONFIRMATION') return null;
              const selfRecorded = r.initiatedBy === access.userId;
              if (!selfRecorded && r.channel !== 'CASH_CHANNEL') return null;
              return (<>
                {selfRecorded
                  ? access.isAdmin
                    ? <>
                      <Button size="sm" onClick={() => resolve.mutate({ id: r.id, decision: 'CONFIRMED' })}>{t('pay.adminConfirm')}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setDlg({ kind: 'resolveReject', id: r.id })}>{t('pay.adminReject')}</Button>
                    </>
                    : <span className="self-center text-xs text-muted">{t('pay.awaitingAdmin')}</span>
                  : <Button size="sm" onClick={() => confirmCash.mutate(r.id)}>{t('pay.confirmReceived')}</Button>}
                {r.channel === 'CASH_CHANNEL' && <Button size="sm" variant="ghost" onClick={() => setDlg({ kind: 'dispute', id: r.id })}>{t('pay.disputeAmount')}</Button>}
              </>);
            }} />)}</Async>
      )}

      {tab === 'all' && (access.isStaff || access.isDirector) && (
        <div className="space-y-4">
          <Field label={t('common.status')}>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
              <option value="">{t('common.all')}</option>
              {['PENDING_CONFIRMATION', 'CONFIRMED', 'DISPUTED', 'REJECTED', 'REVERSED'].map((s) => <option key={s} value={s}>{t(`st.${s}`)}</option>)}
            </Select>
          </Field>
          <Async q={all}>{(d) => (
            <DataTable rows={d.payments} rowKey={(r) => r.id} empty={t('pay.none')} cols={cols(true)}
              actions={(r) => {
                const selfPayment = r.initiatedBy === r.boarderMembership?.user?.id;
                return (<>
                    {r.status === 'PENDING_CONFIRMATION' && r.channel === 'DIGITAL_CHANNEL' && !selfPayment && access.isStaff && (<>
                      <Button size="sm" onClick={() => verify.mutate({ id: r.id, decision: 'CONFIRMED' })}>{t('common.confirm')}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setDlg({ kind: 'reject', id: r.id })}>{t('common.reject')}</Button></>)}
                    {r.status === 'PENDING_CONFIRMATION' && selfPayment && access.isAdmin && (<>
                      <Button size="sm" onClick={() => resolve.mutate({ id: r.id, decision: 'CONFIRMED' })}>{t('pay.adminConfirm')}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setDlg({ kind: 'resolveReject', id: r.id })}>{t('pay.adminReject')}</Button></>)}
                    {r.status === 'DISPUTED' && access.isAdmin && (<>
                      <Button size="sm" onClick={() => resolve.mutate({ id: r.id, decision: 'CONFIRMED' })}>{t('pay.resolveConfirm')}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setDlg({ kind: 'resolveReject', id: r.id })}>{t('pay.resolveReject')}</Button></>)}
                    {r.status === 'CONFIRMED' && access.isAdmin && <Button size="sm" variant="ghost" onClick={() => setDlg({ kind: 'reverse', id: r.id })}>{t('exp.reverse')}</Button>}
                  </>);
              }} />)}</Async>
        </div>
      )}

      <FormDialog open={digital} onClose={() => setDigital(false)} title={t('pay.submitDigital')} submitLabel={t('common.submit')} desc={t('pay.digitalDesc')}
        schema={z.object({ amount: z.number().positive(), transactionRef: z.string().min(3).max(100), proofRef: z.string().url(t('val.url')).optional() })}
        fields={[{ name: 'method', label: t('pay.method'), type: 'select', required: true, options: DIGITAL.map((m) => ({ value: m, label: t(`method.${m}`) })) },
          { name: 'amount', label: t('common.amount'), type: 'number', required: true },
          { name: 'transactionRef', label: t('pay.txnId'), required: true },
          { name: 'proofRef', label: t('pay.proof'), hint: t('pay.proofHint') },
          { name: 'notes', label: t('common.notes'), type: 'textarea' }]}
        onSubmit={(p) => submitDigital.mutateAsync(p)} />
      <FormDialog open={cash} onClose={() => setCash(false)} title={t('pay.recordCash')} submitLabel={t('common.record')} desc={t('pay.cashDesc')}
        schema={z.object({ amount: z.number().positive() })}
        fields={[{ name: 'boarderMembershipId', label: t('pay.from'), type: 'select', required: true, options: (boarders.data ?? []).map((b) => ({ value: b.id, label: b.user.name })) },
          { name: 'amount', label: t('common.amount'), type: 'number', required: true },
          { name: 'notes', label: t('common.notes'), type: 'textarea' }]}
        onSubmit={(p) => recordCash.mutateAsync(p)} />
      <ConfirmDialog open={!!dlg} onClose={() => setDlg(null)} danger={dlg?.kind !== 'dispute'}
        title={dlg?.kind === 'dispute' ? t('pay.disputeAmount') : dlg?.kind === 'reverse' ? t('exp.reverse') : dlg?.kind === 'resolveReject' ? t('pay.adminReject') : t('common.reject')} reasonLabel={t('common.reason')}
        onConfirm={(reason) => {
          const a = { id: dlg!.id, reason };
          if (dlg!.kind === 'dispute') return dispute.mutateAsync(a);
          if (dlg!.kind === 'reject') return verify.mutateAsync({ ...a, decision: 'REJECTED' });
          if (dlg!.kind === 'resolveReject') return resolve.mutateAsync({ ...a, decision: 'REJECTED' });
          return reverse.mutateAsync(a);
        }} />
    </>
  );
}
