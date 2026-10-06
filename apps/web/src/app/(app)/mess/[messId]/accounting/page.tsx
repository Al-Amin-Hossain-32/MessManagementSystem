'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useT } from '@/i18n';
import * as E from '@/lib/endpoints';
import { useAct, useQ } from '@/lib/hooks';
import { useMess } from '@/lib/use-mess';
import { Async, Button, Card, Chip, Dt, Empty, Field, Money, PageHeader, Select, Skeleton, Stat, StatusBadge } from '@/components/ui';
import { DataTable } from '@/components/table';
import { FormDialog } from '@/components/dialogs';

export default function AccountingPage() {
  const { messId, access } = useMess();
  const { t } = useT();
  const [pid, setPid] = useState('');
  const [closeOpen, setCloseOpen] = useState(false);
  const [adjOpen, setAdjOpen] = useState(false);
  const periods = useQ(['periods', messId], () => E.accounting.periods(messId));
  const list = periods.data?.periods ?? [];
  const p = list.find((x) => x.id === pid) ?? list[0];
  const adj = useQ(['adj', messId, p?.id], () => E.accounting.adjustments(messId, p!.id), !!p);
  const start = useAct(() => E.accounting.initiateClose(messId, p!.id), { ok: 'acc.closeStarted' });
  const close = useAct((force: boolean) => E.accounting.close(messId, p!.id, force), { ok: 'acc.closed' });
  const adjust = useAct((b: Record<string, unknown>) => E.accounting.adjust(messId, p!.id, b), { ok: 'acc.adjusted' });

  if (periods.isLoading) return <Skeleton />;
  return (
    <>
      <PageHeader title={t('nav.accounting')} desc={t('acc.desc')} />
      {!p ? <Empty title={t('dash.noPeriod')} hint={t('acc.noPeriodHint')} /> : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Field label={t('acc.period')}>
              <Select value={p.id} onChange={(e) => setPid(e.target.value)} className="w-auto">{list.map((x) => <option key={x.id} value={x.id}>{x.periodLabel} — {t(`st.${x.status}`)}</option>)}</Select>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Link href={`/mess/${messId}/statements`} className="inline-flex min-h-10 items-center rounded-ctl border border-line bg-surface px-4 hover:bg-brand-soft">{t('nav.statements')}</Link>
              {access.isAdmin && p.status === 'ACTIVE' && <Button busy={start.isPending} onClick={() => start.mutate()}>{t('acc.startClose')}</Button>}
              {access.isAdmin && (p.status === 'PREPARING' || p.status === 'UNDER_REVIEW') && <Button onClick={() => setCloseOpen(true)}>{t('acc.close')}</Button>}
              {access.isAdmin && p.status === 'CLOSED' && <Button variant="ghost" onClick={() => setAdjOpen(true)}>{t('acc.addAdjustment')}</Button>}
            </div>
          </div>
          <Card>
            <div className="mb-3 flex flex-wrap items-center gap-2"><StatusBadge value={p.status} /><span className="text-sm text-muted"><Dt v={p.startDate} /> – <Dt v={p.endDate} /></span>
              {p.hasUnresolvedDisputes && <Chip>{t('acc.unresolvedDisputes')}</Chip>}{p.hasAccountingException && <Chip>{t('acc.exception')}</Chip>}</div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Stat label={t('acc.mealRate')} value={p.finalMealRate ? <Money v={p.finalMealRate} /> : '—'} />
              <Stat label={t('acc.mealExpenses')} value={p.eligibleMealExpenseTotal ? <Money v={p.eligibleMealExpenseTotal} /> : '—'} />
              <Stat label={t('acc.weightedMeals')} value={p.totalFinalizedWeightedMeals ? <span className="num">{Number(p.totalFinalizedWeightedMeals)}</span> : '—'} />
            </div>
            {p.accountingExceptionReason && <p className="mt-3 text-sm text-morich">{p.accountingExceptionReason}</p>}
          </Card>
          <div>
            <h2 className="mb-3 text-lg font-bold">{t('acc.adjustments')}</h2>
            <Async q={adj}>{(d) => (
              <DataTable rows={d.adjustments} rowKey={(r) => r.id} empty={t('acc.noAdjustments')}
                cols={[{ key: 'd', header: t('common.date'), cell: (r) => <Dt v={r.appliedAt} />, primary: true }, { key: 't', header: t('disp.target'), cell: (r) => t(`target.${r.targetType}`) },
                  { key: 'r', header: t('common.reason'), cell: (r) => r.reason }, { key: 'a', header: t('common.amount'), cell: (r) => (r.adjustedAmount ? <Money v={r.adjustedAmount} /> : '—') }]} />)}</Async>
          </div>
        </div>
      )}
      {access.isAdmin && <>
        <FormDialog open={closeOpen} onClose={() => setCloseOpen(false)} title={t('acc.close')} desc={t('acc.closeWarn')} danger submitLabel={t('acc.close')}
          fields={[{ name: 'forceOverride', label: t('acc.force'), type: 'checkbox', hint: t('acc.forceHint') }]} onSubmit={(p2) => close.mutateAsync(!!p2.forceOverride)} />
        <FormDialog open={adjOpen} onClose={() => setAdjOpen(false)} title={t('acc.addAdjustment')} desc={t('acc.adjustHint')}
        fields={[{ name: 'targetType', label: t('disp.target'), type: 'select', required: true, options: ['BOARDER_STATEMENT', 'EXPENSE', 'PAYMENT'].map((x) => ({ value: x, label: t(`target.${x}`) })) },
          { name: 'targetId', label: t('disp.targetId'), required: true }, { name: 'reason', label: t('common.reason'), type: 'textarea', required: true },
          { name: 'adjustedAmount', label: t('acc.adjustedAmount'), type: 'number' }, { name: 'notes', label: t('common.notes'), type: 'textarea' }]}
          onSubmit={(b) => adjust.mutateAsync(b)} />
      </>}
    </>
  );
}
