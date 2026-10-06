'use client';
import { useState } from 'react';
import { useT } from '@/i18n';
import * as E from '@/lib/endpoints';
import { useAct, useQ } from '@/lib/hooks';
import { useMess } from '@/lib/use-mess';
import { Async, Button, Chip, Empty, Field, Money, PageHeader, Select, StatusBadge, Tabs } from '@/components/ui';
import { DataTable } from '@/components/table';
import { FormDialog } from '@/components/dialogs';

type Tab = 'mine' | 'all' | 'history';

export default function StatementsPage() {
  const { messId, access } = useMess();
  const { t } = useT();
  const tabs = [...(access.isBoarder ? [{ id: 'mine' as Tab, label: t('stmt.mine') }, { id: 'history' as Tab, label: t('stmt.history') }] : []), ...((access.isAdmin || access.isDirector) ? [{ id: 'all' as Tab, label: t('stmt.all') }] : [])];
  const [tab, setTab] = useState<Tab>(tabs[0]?.id ?? 'mine');
  const [pid, setPid] = useState('');
  const periods = useQ(['periods', messId], () => E.accounting.periods(messId));
  const list = periods.data?.periods ?? [];
  const periodId = pid || list[0]?.id || '';
  return (
    <>
      <PageHeader title={t('nav.statements')} desc={t('stmt.desc')} />
      {tabs.length > 1 && <Tabs tabs={tabs} value={tab} onChange={setTab} />}
      {tab !== 'history' && (
        <Field label={t('acc.period')}>
          <Select value={periodId} onChange={(e) => setPid(e.target.value)} className="mb-4 w-auto">
            {list.map((p) => <option key={p.id} value={p.id}>{p.periodLabel} — {t(`st.${p.status}`)}</option>)}
          </Select>
        </Field>
      )}
      {tab === 'mine' && (periodId ? <Mine messId={messId} periodId={periodId} /> : <Empty title={t('dash.noPeriod')} />)}
      {tab === 'all' && periodId && <AllStatements messId={messId} periodId={periodId} />}
      {tab === 'history' && <History messId={messId} />}
    </>
  );
}

function Rows({ s }: { s: import('@/lib/types').Statement }) {
  const { t } = useT();
  const rows: [string, unknown][] = [['stmt.openingBalance', s.openingBalance], ['stmt.mealCost', s.mealCost], ['stmt.guestMealCharge', s.guestMealCharge], ['stmt.expenseAllocation', s.totalExpenseAllocation], ['stmt.directCharges', s.directCharges], ['stmt.totalDue', s.totalDue], ['stmt.confirmedPayments', s.confirmedPayments]];
  return (
    <div className="khata rounded-card border border-line py-2">
      {rows.map(([k, v]) => <div key={k} className="khata-row"><span className="text-muted">{t(k)}</span><Money v={v} /></div>)}
      <div className="khata-row"><span className="font-head font-bold">{t('stmt.closingBalance')}</span><Money v={s.closingBalance} className="font-head text-xl font-bold" /></div>
    </div>
  );
}

function Mine({ messId, periodId }: { messId: string; periodId: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const q = useQ(['stmt', messId, periodId], () => E.accounting.myStatementIfGenerated(messId, periodId));
  const raise = useAct((p: Record<string, unknown>) => E.disputes.raise(messId, p), { ok: 'disp.raised' });
  return (
    <Async q={q}>{(d) => d ? (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">{d.statement.isAdjusted && <Chip>{t('st.ADJUSTED')}</Chip>}
          <span className="text-sm text-muted">{d.statement.accountingPeriod?.periodLabel}</span></div>
        <Rows s={d.statement} />
        <Button variant="ghost" onClick={() => setOpen(true)}>{t('stmt.raiseDispute')}</Button>
        <FormDialog open={open} onClose={() => setOpen(false)} title={t('stmt.raiseDispute')} submitLabel={t('common.submit')}
          fields={[{ name: 'description', label: t('disp.describe'), type: 'textarea', required: true }]}
          onSubmit={(p) => raise.mutateAsync({ accountingPeriodId: periodId, targetType: 'STATEMENT', targetId: d.statement.id, description: p.description })} />
      </div>
    ) : <Empty title={t('dash.noStatement')} hint={t('dash.statementNotReadyHint')} />}</Async>
  );
}

function AllStatements({ messId, periodId }: { messId: string; periodId: string }) {
  const { t } = useT();
  const q = useQ(['stmts', messId, periodId], () => E.accounting.statements(messId, periodId));
  return (
    <Async q={q}>{(d) => (
      <DataTable rows={d.statements} rowKey={(r) => r.id} empty={t('stmt.none')} emptyHint={t('stmt.noneHint')}
        cols={[{ key: 'n', header: t('common.name'), cell: (r) => r.boarderMembership?.user?.name ?? '—', primary: true },
          { key: 'd', header: t('stmt.totalDue'), cell: (r) => <Money v={r.totalDue} /> },
          { key: 'p', header: t('stmt.confirmedPayments'), cell: (r) => <Money v={r.confirmedPayments} /> },
          { key: 'c', header: t('stmt.closingBalance'), cell: (r) => <Money v={r.closingBalance} className="font-medium" /> }]} />)}</Async>
  );
}

function History({ messId }: { messId: string }) {
  const { t } = useT();
  const q = useQ(['stmt-hist', messId], () => E.accounting.history(messId));
  return (
    <Async q={q}>{(d) => (
      <DataTable rows={d.statements} rowKey={(r) => r.id} empty={t('stmt.none')}
        cols={[{ key: 'p', header: t('acc.period'), cell: (r) => r.accountingPeriod?.periodLabel ?? '—', primary: true },
          { key: 'd', header: t('stmt.totalDue'), cell: (r) => <Money v={r.totalDue} /> },
          { key: 'c', header: t('stmt.closingBalance'), cell: (r) => <Money v={r.closingBalance} className="font-medium" /> },
          { key: 's', header: t('common.status'), cell: (r) => <StatusBadge value={r.accountingPeriod?.status} /> }]} />)}</Async>
  );
}
