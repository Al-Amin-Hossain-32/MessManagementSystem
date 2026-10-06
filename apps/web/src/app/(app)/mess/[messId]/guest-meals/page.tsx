'use client';
import { useState } from 'react';
import { z } from 'zod';
import { useT } from '@/i18n';
import * as E from '@/lib/endpoints';
import { useAct, useQ } from '@/lib/hooks';
import { todayStr } from '@/lib/format';
import { useBoarders, useMess } from '@/lib/use-mess';
import { Async, Button, Card, Dt, Money, PageHeader, StatusBadge } from '@/components/ui';
import { DataTable } from '@/components/table';
import { ConfirmDialog, FormDialog } from '@/components/dialogs';

const MEALS = ['BREAKFAST', 'LUNCH', 'DINNER', 'CUSTOM'];
const POLICIES = ['CHARGE_TO_HOST', 'SHARED_POOL', 'CUSTOM_CONFIGURED'];

export default function GuestMealsPage() {
  const { messId, access } = useMess();
  const { t } = useT();
  const [rec, setRec] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [disp, setDisp] = useState<string | null>(null);
  const list = useQ(['guest', messId], () => E.guestMeals.list(messId));
  const cfg = useQ(['guestcfg', messId], () => E.guestMeals.config(messId));
  const boarders = useBoarders(messId, access.isStaff);
  const record = useAct((p: Record<string, unknown>) => E.guestMeals.record(messId, p), { ok: 'guest.recorded' });
  const saveCfg = useAct((p: any) => E.guestMeals.putConfig(messId, p), { ok: 'common.saved' });
  const dispute = useAct((a: { id: string; reason: string }) => E.guestMeals.dispute(messId, a.id, a.reason), { ok: 'guest.disputed' });
  const c = cfg.data?.config;

  return (
    <>
      <PageHeader title={t('nav.guestMeals')} desc={t('guest.desc')}
        actions={access.isStaff && <Button onClick={() => setRec(true)}>{t('guest.record')}</Button>} />
      <Card className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">{t('guest.policy')}</h2>
            {c ? <p className="text-sm text-muted">{t(`policy.${c.chargingPolicy}`)} · ×{Number(c.rateMultiplier)}{c.requiresGuestInfo ? ` · ${t('guest.infoRequired')}` : ''}</p> : <p className="text-sm text-muted">{t('guest.noConfig')}</p>}
          </div>
          {access.isAdmin && <Button variant="ghost" size="sm" onClick={() => setCfgOpen(true)}>{t('common.edit')}</Button>}
        </div>
      </Card>
      <Async q={list}>{(d) => (
        <DataTable rows={d.guestMeals} rowKey={(r) => r.id} empty={t('guest.none')}
          cols={[{ key: 'd', header: t('common.date'), cell: (r) => <Dt v={r.date} />, primary: true },
            { key: 'm', header: t('meals.type'), cell: (r) => t(`meal.${r.mealType}`) },
            { key: 'g', header: t('guest.guest'), cell: (r) => r.guestName || '—' },
            { key: 'q', header: t('common.qty'), cell: (r) => <span className="num">{r.quantity}</span> },
            { key: 'c', header: t('guest.charge'), cell: (r) => <Money v={r.totalCharge} /> },
            { key: 's', header: t('common.status'), cell: (r) => <StatusBadge value={r.status} /> }]}
          actions={(r) => r.hostBoarderMembershipId === access.boarderMembershipId && r.status === 'RECORDED'
            ? <Button size="sm" variant="ghost" onClick={() => setDisp(r.id)}>{t('guest.dispute')}</Button> : null} />)}</Async>

      <FormDialog open={rec} onClose={() => setRec(false)} title={t('guest.record')} submitLabel={t('common.record')}
        schema={z.object({ quantity: z.number().int().positive().max(50).optional(), appliedRate: z.number().nonnegative() })}
        fields={[
          { name: 'hostBoarderMembershipId', label: t('guest.host'), type: 'select', required: true, options: (boarders.data ?? []).map((b) => ({ value: b.id, label: b.user.name })) },
          { name: 'date', label: t('common.date'), type: 'date', required: true },
          { name: 'mealType', label: t('meals.type'), type: 'select', required: true, options: MEALS.map((m) => ({ value: m, label: t(`meal.${m}`) })) },
          { name: 'quantity', label: t('common.qty'), type: 'number', hint: t('guest.qtyHint') },
          { name: 'guestName', label: t('guest.guestName') },
          { name: 'appliedRate', label: t('guest.rate'), type: 'number', required: true, hint: t('guest.rateHint') }]}
        initial={{ date: todayStr(), quantity: '1' }} onSubmit={(p) => record.mutateAsync(p)} />
      <FormDialog open={cfgOpen} onClose={() => setCfgOpen(false)} title={t('guest.policy')}
        fields={[{ name: 'chargingPolicy', label: t('guest.policy'), type: 'select', required: true, options: POLICIES.map((p) => ({ value: p, label: t(`policy.${p}`) })) },
          { name: 'rateMultiplier', label: t('guest.multiplier'), type: 'number', required: true, hint: t('guest.multiplierHint') },
          { name: 'requiresGuestInfo', label: t('guest.infoRequired'), type: 'checkbox', hint: t('guest.infoRequired') }]}
        schema={z.object({ rateMultiplier: z.number().positive().max(10) })}
        initial={{ chargingPolicy: c?.chargingPolicy ?? '', rateMultiplier: String(Number(c?.rateMultiplier ?? 1)), requiresGuestInfo: !!c?.requiresGuestInfo }}
        onSubmit={(p) => saveCfg.mutateAsync(p)} />
      <ConfirmDialog open={!!disp} onClose={() => setDisp(null)} title={t('guest.dispute')} reasonLabel={t('common.reason')}
        onConfirm={(reason) => dispute.mutateAsync({ id: disp!, reason })} />
    </>
  );
}
