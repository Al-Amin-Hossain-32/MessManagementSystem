'use client';
import { useState } from 'react';
import { z } from 'zod';
import { useT } from '@/i18n';
import * as E from '@/lib/endpoints';
import { useAct, useQ } from '@/lib/hooks';
import { todayStr } from '@/lib/format';
import { useBoarders, useCurrentPeriod, useMess } from '@/lib/use-mess';
import { Async, Button, Chip, Dt, Money, Field, PageHeader, Select, StatusBadge, Tabs } from '@/components/ui';
import { DataTable } from '@/components/table';
import { ConfirmDialog, FormDialog, Modal } from '@/components/dialogs';
import type { Expense, ExpenseCategory } from '@/lib/types';

const METHODS = ['EQUAL_SPLIT', 'MEAL_PROPORTIONAL', 'DIRECT_CHARGE'];
const SCOPES = ['ALL', 'RESIDENT_ONLY', 'MEAL_ONLY', 'SELECTED_MEMBERS'];
type Tab = 'list' | 'categories' | 'summary';

export default function ExpensesPage() {
  const { messId, access } = useMess();
  const { t } = useT();
  const [tab, setTab] = useState<Tab>('list');
  const tabs = [{ id: 'list' as Tab, label: t('nav.expenses') }, ...(access.isStaff ? [{ id: 'categories' as Tab, label: t('exp.categories') }, { id: 'summary' as Tab, label: t('exp.summary') }] : [])];
  return (
    <>
      <PageHeader title={t('nav.expenses')} desc={t('exp.desc')} />
      {tabs.length > 1 && <Tabs tabs={tabs} value={tab} onChange={setTab} />}
      {tab === 'list' && <List messId={messId} isAdmin={access.isAdmin} isStaff={access.isStaff} />}
      {tab === 'categories' && access.isStaff && <Categories messId={messId} isAdmin={access.isAdmin} />}
      {tab === 'summary' && access.isStaff && <Summary messId={messId} isAdmin={access.isAdmin} />}
    </>
  );
}

function List({ messId, isAdmin, isStaff }: { messId: string; isAdmin: boolean; isStaff: boolean }) {
  const { t } = useT();
  const [status, setStatus] = useState('');
  const [create, setCreate] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [reason, setReason] = useState<{ id: string; kind: 'reject' | 'reverse' } | null>(null);
  const q = useQ(['exp', messId, 'list', status], () => E.expenses.list(messId, { status }));
  const cats = useQ(['cats', messId], () => E.categories.list(messId), isStaff);
  const boarders = useBoarders(messId, isStaff);
  const add = useAct((p: Record<string, unknown>) => E.expenses.create(messId, p), { ok: 'exp.created' });
  const confirm = useAct((id: string) => E.expenses.confirm(messId, id), { ok: 'exp.confirmed' });
  const act = useAct((a: { id: string; kind: 'reject' | 'reverse'; reason: string }) => (a.kind === 'reject' ? E.expenses.reject : E.expenses.reverse)(messId, a.id, a.reason), { ok: 'common.done' });
  const det = useQ(['exp', messId, 'detail', detail], () => E.expenses.get(messId, detail!), !!detail);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field label={t('common.status')}>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
            <option value="">{t('common.all')}</option>
            {['DRAFT', 'DRAFT_FROM_SHOP', 'ACTIVE', 'REJECTED', 'REVERSED'].map((s) => <option key={s} value={s}>{t(`st.${s}`)}</option>)}
          </Select>
        </Field>
        {isStaff && <Button onClick={() => setCreate(true)}>{t('exp.add')}</Button>}
      </div>
      <Async q={q}>{(d) => (
        <DataTable rows={d.expenses} rowKey={(r) => r.id} empty={t('exp.none')}
          cols={[{ key: 'd', header: t('common.date'), cell: (r) => <Dt v={r.date} />, primary: true },
            { key: 'x', header: t('common.description'), cell: (r) => r.description },
            { key: 'c', header: t('exp.category'), cell: (r) => r.category?.name ?? '—' },
            { key: 'a', header: t('common.amount'), cell: (r) => <Money v={r.amount} className="font-medium" /> },
            { key: 's', header: t('common.status'), cell: (r) => <StatusBadge value={r.status} /> }]}
          actions={(r: Expense) => (<>
            <Button size="sm" variant="quiet" onClick={() => setDetail(r.id)}>{t('common.details')}</Button>
            {isAdmin && (r.status === 'DRAFT' || r.status === 'DRAFT_FROM_SHOP') && <><Button size="sm" onClick={() => confirm.mutate(r.id)}>{t('common.confirm')}</Button><Button size="sm" variant="ghost" onClick={() => setReason({ id: r.id, kind: 'reject' })}>{t('common.reject')}</Button></>}
            {isAdmin && r.status === 'ACTIVE' && <Button size="sm" variant="ghost" onClick={() => setReason({ id: r.id, kind: 'reverse' })}>{t('exp.reverse')}</Button>}</>)} />)}</Async>

      <FormDialog open={create} onClose={() => setCreate(false)} title={t('exp.add')} submitLabel={t('common.create')}
        schema={z.object({ amount: z.number().positive(), description: z.string().min(2).max(500), receiptRef: z.string().url(t('val.url')).optional() })}
        initial={{ date: todayStr() }}
        fields={[
          { name: 'categoryId', label: t('exp.category'), type: 'select', required: true, options: (cats.data?.categories ?? []).filter((c) => c.isActive).map((c) => ({ value: c.id, label: `${c.name} (${t(`method.${c.distributionMethod}`)})` })) },
          { name: 'amount', label: t('common.amount'), type: 'number', required: true },
          { name: 'description', label: t('common.description'), required: true },
          { name: 'date', label: t('common.date'), type: 'date', required: true },
          { name: 'receiptRef', label: t('exp.receipt'), hint: t('exp.receiptHint') },
          { name: 'directChargeBoarderMembershipId', label: t('exp.directCharge'), type: 'select', hint: t('exp.directChargeHint'), options: (boarders.data ?? []).map((b) => ({ value: b.id, label: b.user.name })) },
          { name: 'asDraft', label: t('exp.asDraft'), type: 'checkbox', hint: t('exp.asDraftHint') }]}
        onSubmit={(p) => add.mutateAsync(p)} />
      <ConfirmDialog open={!!reason} onClose={() => setReason(null)} danger title={reason?.kind === 'reject' ? t('common.reject') : t('exp.reverse')} reasonLabel={t('common.reason')}
        onConfirm={(r) => act.mutateAsync({ ...reason!, reason: r })} />
      <Modal open={!!detail} onClose={() => setDetail(null)} title={t('common.details')} wide>
        <Async q={det}>{(d) => (
          <div className="space-y-3 text-sm">
            <p className="font-medium">{d.expense.description} — <Money v={d.expense.amount} /></p>
            {d.expense.rejectionReason && <p className="text-morich">{d.expense.rejectionReason}</p>}
            <h3 className="font-bold">{t('exp.allocations')}</h3>
            {d.expense.allocations?.length ? (
              <ul className="divide-y divide-line">{d.expense.allocations.map((a) => <li key={a.id} className="flex justify-between py-1.5"><span>{a.boarderMembership?.user?.name}</span><Money v={a.allocatedAmount} /></li>)}</ul>
            ) : <p className="text-muted">{t('exp.noAllocations')}</p>}
          </div>)}</Async>
      </Modal>
    </div>
  );
}

function Categories({ messId, isAdmin }: { messId: string; isAdmin: boolean }) {
  const { t } = useT();
  const [edit, setEdit] = useState<ExpenseCategory | 'new' | null>(null);
  const q = useQ(['cats', messId], () => E.categories.list(messId));
  const boarders = useBoarders(messId, true);
  const save = useAct((p: Record<string, unknown>) => (edit === 'new' ? E.categories.create(messId, p) : E.categories.update(messId, (edit as ExpenseCategory).id, p)), { ok: 'common.saved' });
  const c = edit && edit !== 'new' ? edit : null;
  return (
    <div className="space-y-4">
      {isAdmin && <div className="flex justify-end"><Button onClick={() => setEdit('new')}>{t('exp.addCategory')}</Button></div>}
      <Async q={q}>{(d) => (
        <DataTable rows={d.categories} rowKey={(r) => r.id} empty={t('exp.noCategories')} emptyHint={t('exp.noCategoriesHint')}
          cols={[{ key: 'n', header: t('common.name'), cell: (r) => <span>{r.name} {!r.isActive && <Chip>{t('common.inactive')}</Chip>}</span>, primary: true },
            { key: 'm', header: t('exp.method'), cell: (r) => t(`method.${r.distributionMethod}`) },
            { key: 's', header: t('exp.scope'), cell: (r) => t(`scope.${r.eligibleMemberScope}`) },
            { key: 'r', header: t('exp.mealRate'), cell: (r) => (r.countsTowardMealRate ? t('common.yes') : t('common.no')) }]}
          actions={isAdmin ? (r) => <Button size="sm" variant="ghost" onClick={() => setEdit(r)}>{t('common.edit')}</Button> : undefined} />)}</Async>
      <FormDialog open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? t('exp.addCategory') : t('common.edit')}
        initial={c ? { name: c.name, distributionMethod: c.distributionMethod, eligibleMemberScope: c.eligibleMemberScope, countsTowardMealRate: c.countsTowardMealRate, selectedMemberIds: c.selectedMemberIds ?? [], isActive: c.isActive } : { eligibleMemberScope: 'ALL' }}
        fields={[
          { name: 'name', label: t('common.name'), required: true },
          { name: 'distributionMethod', label: t('exp.method'), type: 'select', required: true, options: METHODS.map((m) => ({ value: m, label: t(`method.${m}`) })) },
          { name: 'eligibleMemberScope', label: t('exp.scope'), type: 'select', required: true, options: SCOPES.map((s) => ({ value: s, label: t(`scope.${s}`) })) },
          { name: 'selectedMemberIds', label: t('exp.selectedMembers'), type: 'multi', hint: t('exp.selectedHint'), options: (boarders.data ?? []).map((b) => ({ value: b.id, label: b.user.name })) },
          { name: 'countsTowardMealRate', label: t('exp.mealRate'), type: 'checkbox', hint: t('exp.mealRateHint') },
          ...(c ? [{ name: 'isActive', label: t('common.active'), type: 'checkbox' as const, hint: t('common.active') }] : [])]}
        onSubmit={async (p) => {
          if (p.eligibleMemberScope === 'SELECTED_MEMBERS' && !p.selectedMemberIds?.length) throw new Error(t('exp.selectedRequired'));
          await save.mutateAsync(p);
        }} />
    </div>
  );
}

function Summary({ messId, isAdmin }: { messId: string; isAdmin: boolean }) {
  const { t } = useT();
  const period = useCurrentPeriod(messId);
  const pid = period.data?.id;
  const q = useQ(['alloc', messId, pid], () => E.expenses.summary(messId, pid!), !!pid);
  const recalc = useAct(() => E.expenses.recalc(messId, pid!), { ok: 'exp.recalculated' });
  if (period.isLoading) return null;
  if (!pid) return <p className="text-sm text-muted">{t('dash.noPeriod')}</p>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted">{period.data!.periodLabel}</p>
        {isAdmin && <Button variant="ghost" busy={recalc.isPending} onClick={() => recalc.mutate()}>{t('exp.recalculate')}</Button>}</div>
      <Async q={q}>{(d) => (
        <DataTable rows={d.summary} rowKey={(r) => r.boarderMembershipId} empty={t('exp.noAllocations')}
          cols={[{ key: 'n', header: t('common.name'), cell: (r) => r.name, primary: true }, { key: 't', header: t('common.total'), cell: (r) => <Money v={r.total} className="font-medium" /> }]} />)}</Async>
    </div>
  );
}
