'use client';
import { useState } from 'react';
import { useT } from '@/i18n';
import * as E from '@/lib/endpoints';
import { useAct, useQ } from '@/lib/hooks';
import { todayStr } from '@/lib/format';
import { useMess } from '@/lib/use-mess';
import { Async, Button, Card, Dt, Field, Input, PageHeader, StatusBadge, Tabs } from '@/components/ui';
import { DataTable } from '@/components/table';
import { ConfirmDialog, FormDialog } from '@/components/dialogs';
import type { MealRecord } from '@/lib/types';

type Tab = 'mine' | 'board' | 'corrections';

export default function MealsPage() {
  const { messId, access } = useMess();
  const { t } = useT();
  const tabs = [
    ...(access.isBoarder ? [{ id: 'mine' as Tab, label: t('meals.mine') }] : []),
    ...(access.isStaff ? [{ id: 'board' as Tab, label: t('meals.board') }, { id: 'corrections' as Tab, label: t('meals.corrections') }] : []),
  ];
  const [tab, setTab] = useState<Tab>(tabs[0]?.id ?? 'mine');
  return (
    <>
      <PageHeader title={t('nav.meals')} desc={t('meals.desc')} />
      {tabs.length > 1 && <Tabs tabs={tabs} value={tab} onChange={setTab} />}
      {tab === 'mine' && access.isBoarder && <MyMeals messId={messId} />}
      {tab === 'board' && access.isStaff && <Board messId={messId} />}
      {tab === 'corrections' && access.isStaff && <Corrections messId={messId} />}
    </>
  );
}

function DatePick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useT();
  return <Field label={t('common.date')}><Input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="w-auto" /></Field>;
}

function MyMeals({ messId }: { messId: string }) {
  const { t } = useT();
  const [date, setDate] = useState(todayStr());
  const [corr, setCorr] = useState<MealRecord | null>(null);
  const q = useQ(['meals', messId, 'mine', date], () => E.meals.mine(messId, date));
  const hist = useQ(['meals', messId, 'hist'], () => E.meals.history(messId));
  const out = useAct((m: MealRecord) => E.meals.optOut(messId, { date, mealType: m.mealType }), { ok: 'meals.optedOut' });
  const inn = useAct((m: MealRecord) => E.meals.optIn(messId, { date, mealType: m.mealType }), { ok: 'meals.optedIn' });
  const req = useAct((p: Record<string, unknown>) => E.meals.requestCorrection(messId, corr!.id, p as any), { ok: 'meals.correctionSent' });
  return (
    <div className="space-y-6">
      <Card>
        <DatePick value={date} onChange={setDate} />
        <p className="mb-3 mt-2 text-xs text-muted">{t('meals.deadlineNote')}</p>
        <Async q={q} rows={2}>{(d) => d.meals.length === 0 ? <p className="text-sm text-muted">{t('meals.none')}</p> : (
          <ul className="space-y-2">
            {d.meals.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-ctl border border-line p-3">
                <div className="flex items-center gap-3"><span className="font-medium">{t(`meal.${m.mealType}`)}</span><StatusBadge value={m.status} /></div>
                <div className="flex gap-2">
                  {m.status === 'DEFAULT_ON' && <Button size="sm" variant="ghost" busy={out.isPending} onClick={() => out.mutate(m)}>{t('meals.optOut')}</Button>}
                  {m.status === 'OPTED_OUT' && <Button size="sm" variant="ghost" busy={inn.isPending} onClick={() => inn.mutate(m)}>{t('meals.optIn')}</Button>}
                  {m.status === 'LOCKED' && <Button size="sm" variant="quiet" onClick={() => setCorr(m)}>{t('meals.requestCorrection')}</Button>}
                </div>
              </li>))}
          </ul>)}</Async>
      </Card>
      <div>
        <h2 className="mb-3 text-lg font-bold">{t('meals.history')}</h2>
        <Async q={hist}>{(d) => (
          <DataTable rows={d.meals} rowKey={(r) => r.id} empty={t('meals.none')}
            cols={[{ key: 'd', header: t('common.date'), cell: (r) => <Dt v={r.date} />, primary: true },
              { key: 't', header: t('meals.type'), cell: (r) => t(`meal.${r.mealType}`) },
              { key: 'w', header: t('meals.weight'), cell: (r) => <span className="num">{Number(r.weight)}</span> },
              { key: 's', header: t('common.status'), cell: (r) => <StatusBadge value={r.status} /> }]} />)}</Async>
      </div>
      <FormDialog open={!!corr} onClose={() => setCorr(null)} title={t('meals.requestCorrection')} submitLabel={t('common.submit')}
        fields={[{ name: 'requestedStatus', label: t('meals.requestedStatus'), type: 'select', options: [{ value: 'DEFAULT_ON', label: t('st.DEFAULT_ON') }, { value: 'OPTED_OUT', label: t('st.OPTED_OUT') }] },
          { name: 'requestedWeight', label: t('meals.weight'), type: 'number', hint: t('meals.weightHint') },
          { name: 'reason', label: t('common.reason'), type: 'textarea', required: true }]}
        onSubmit={async (p) => {
          if (!p.requestedStatus && p.requestedWeight === undefined) throw new Error(t('meals.needOne'));
          await req.mutateAsync(p);
        }} />
    </div>
  );
}

function Board({ messId }: { messId: string }) {
  const { t } = useT();
  const [date, setDate] = useState(todayStr());
  const q = useQ(['meals', messId, 'board', date], () => E.meals.day(messId, date));
  const gen = useAct(() => E.meals.generate(messId, date), { ok: 'meals.generated' });
  const lock = useAct(() => E.meals.lockExpired(messId), { ok: 'meals.locked' });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <DatePick value={date} onChange={setDate} />
        <Button variant="ghost" busy={gen.isPending} onClick={() => gen.mutate()}>{t('meals.generate')}</Button>
        <Button variant="ghost" busy={lock.isPending} onClick={() => lock.mutate()}>{t('meals.lockExpired')}</Button>
      </div>
      <Async q={q}>{(d) => (
        <DataTable rows={d.meals} rowKey={(r) => r.id} empty={t('meals.none')} emptyHint={t('meals.generateHint')}
          cols={[{ key: 'n', header: t('common.name'), cell: (r) => r.boarderMembership?.user.name ?? '—', primary: true },
            { key: 't', header: t('meals.type'), cell: (r) => t(`meal.${r.mealType}`) },
            { key: 'w', header: t('meals.weight'), cell: (r) => <span className="num">{Number(r.weight)}</span> },
            { key: 's', header: t('common.status'), cell: (r) => <StatusBadge value={r.status} /> }]} />)}</Async>
    </div>
  );
}

function Corrections({ messId }: { messId: string }) {
  const { t } = useT();
  const [status, setStatus] = useState('PENDING');
  const [rej, setRej] = useState<string | null>(null);
  const q = useQ(['corr', messId, status], () => E.meals.corrections(messId, status));
  const approve = useAct((id: string) => E.meals.approve(messId, id), { ok: 'meals.approved' });
  const reject = useAct((a: { id: string; notes: string }) => E.meals.reject(messId, a.id, a.notes || undefined), { ok: 'meals.rejected' });
  return (
    <div className="space-y-4">
      <Tabs value={status} onChange={setStatus} tabs={['PENDING', 'APPROVED', 'REJECTED'].map((s) => ({ id: s, label: t(`st.${s}`) }))} />
      <Async q={q}>{(d) => (
        <DataTable rows={d.requests} rowKey={(r) => r.id} empty={t('meals.noCorrections')}
          cols={[{ key: 'd', header: t('common.date'), cell: (r) => <Dt v={r.createdAt} />, primary: true },
            { key: 'c', header: t('meals.requested'), cell: (r) => [r.requestedStatus && t(`st.${r.requestedStatus}`), r.requestedWeight && `× ${Number(r.requestedWeight)}`].filter(Boolean).join(' ') },
            { key: 'r', header: t('common.reason'), cell: (r) => r.reason },
            { key: 's', header: t('common.status'), cell: (r) => <StatusBadge value={r.status} /> }]}
          actions={(r) => r.status === 'PENDING' ? (<>
            <Button size="sm" onClick={() => approve.mutate(r.id)}>{t('common.approve')}</Button>
            <Button size="sm" variant="ghost" onClick={() => setRej(r.id)}>{t('common.reject')}</Button></>) : null} />)}</Async>
      <ConfirmDialog open={!!rej} onClose={() => setRej(null)} title={t('common.reject')} reasonLabel={t('common.notes')} reasonRequired={false}
        onConfirm={(notes) => reject.mutateAsync({ id: rej!, notes })} />
    </div>
  );
}
