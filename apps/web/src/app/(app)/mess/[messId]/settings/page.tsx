'use client';
import { useState } from 'react';
import { z } from 'zod';
import { useT } from '@/i18n';
import * as E from '@/lib/endpoints';
import { useAct, useQ } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { useMess } from '@/lib/use-mess';
import { Async, Button, Card, Chip, PageHeader, StatusBadge } from '@/components/ui';
import { FormDialog } from '@/components/dialogs';
import type { MealType } from '@messmess/types';

const TYPES: MealType[] = ['BREAKFAST' as MealType, 'LUNCH' as MealType, 'DINNER' as MealType, 'CUSTOM' as MealType];
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export default function SettingsPage() {
  const { messId, access } = useMess();
  const { t } = useT();
  const { reload } = useSession();
  const [editMess, setEditMess] = useState(false);
  const [coAdmin, setCoAdmin] = useState(false);
  const [editMeals, setEditMeals] = useState(false);
  const mess = useQ(['mess', messId], () => E.messes.get(messId));
  const cfg = useQ(['mealcfg', messId], () => E.mealConfig.get(messId));
  const upd = useAct(async (p: any) => { await E.messes.update(messId, p); await reload(); }, { ok: 'common.saved' });
  const invite = useAct((email: string) => E.messes.inviteCoAdmin(messId, email), { ok: 'set.coAdminInvited' });
  const saveMeals = useAct((mealTypes: any[]) => E.mealConfig.put(messId, mealTypes as any), { ok: 'common.saved' });
  const existing = cfg.data?.config?.mealTypes ?? [];
  const initial: Record<string, string | boolean> = {};
  for (const ty of TYPES) {
    const c = existing.find((x) => x.type === ty);
    initial[`${ty}_on`] = !!c; initial[`${ty}_label`] = c?.label ?? t(`meal.${ty}`); initial[`${ty}_weight`] = c ? String(Number(c.weight)) : '1'; initial[`${ty}_deadline`] = c?.optOutDeadline ?? '07:00';
  }
  return (
    <>
      <PageHeader title={t('nav.settings')} />
      <div className="space-y-5">
        <Async q={mess}>{({ mess: m }) => (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-head text-xl font-bold">{m.name}</h2><p className="text-sm text-muted">{m.address || t('set.noAddress')}</p>
                {m.description && <p className="mt-1 text-sm">{m.description}</p>}
                <div className="mt-2 flex flex-wrap gap-2"><StatusBadge value={m.status} />{m.subscription && <Chip>{m.subscription.plan} · {t(`st.${m.subscription.status}`)}</Chip>}
                  <Chip>{t('set.slug')}: {m.slug}</Chip></div></div>
              <Button variant="ghost" size="sm" onClick={() => setEditMess(true)}>{t('common.edit')}</Button>
            </div>
            <FormDialog open={editMess} onClose={() => setEditMess(false)} title={t('common.edit')} initial={{ name: m.name, address: m.address ?? '', description: m.description ?? '' }}
              schema={z.object({ name: z.string().min(3).max(100), address: z.string().max(500).optional(), description: z.string().max(1000).optional() })}
              fields={[{ name: 'name', label: t('mess.name'), required: true }, { name: 'address', label: t('mess.address') }, { name: 'description', label: t('mess.description'), type: 'textarea' }]} onSubmit={(p) => upd.mutateAsync(p)} />
          </Card>)}</Async>

        <Card>
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">{t('set.mealConfig')}</h2><Button variant="ghost" size="sm" onClick={() => setEditMeals(true)}>{t('common.edit')}</Button></div>
          {existing.length ? (
            <ul className="divide-y divide-line text-sm">{existing.map((m) => (
              <li key={m.type} className="flex flex-wrap justify-between gap-2 py-2"><span className="font-medium">{m.label} {!m.isActive && <Chip>{t('common.inactive')}</Chip>}</span>
                <span className="num text-muted">{t('meals.weight')}: {Number(m.weight)} · {t('set.deadline')}: {m.optOutDeadline}</span></li>))}</ul>
          ) : <p className="text-sm text-muted">{t('set.noMealConfig')}</p>}
        </Card>

        {access.isOwner && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">{t('set.coAdmins')}</h2><p className="text-sm text-muted">{t('set.coAdminsHint')}</p></div>
              <Button variant="ghost" size="sm" onClick={() => setCoAdmin(true)}>{t('set.inviteCoAdmin')}</Button></div>
          </Card>)}
      </div>
      <FormDialog open={coAdmin} onClose={() => setCoAdmin(false)} title={t('set.inviteCoAdmin')} submitLabel={t('mem.sendInvite')} schema={z.object({ email: z.string().email(t('val.email')) })}
        fields={[{ name: 'email', label: t('auth.email'), type: 'email', required: true }]} onSubmit={(p) => invite.mutateAsync(p.email)} />
      <FormDialog open={editMeals} onClose={() => setEditMeals(false)} title={t('set.mealConfig')} wide initial={initial} desc={t('set.mealConfigHint')}
        fields={TYPES.flatMap((ty) => [
          { name: `${ty}_on`, label: t(`meal.${ty}`), type: 'checkbox' as const, hint: t('set.enableMeal', { meal: t(`meal.${ty}`) }) },
          { name: `${ty}_label`, label: `${t(`meal.${ty}`)} · ${t('set.label')}` },
          { name: `${ty}_weight`, label: `${t(`meal.${ty}`)} · ${t('meals.weight')}`, type: 'number' as const },
          { name: `${ty}_deadline`, label: `${t(`meal.${ty}`)} · ${t('set.deadline')} (HH:MM)`, placeholder: '07:00' }])}
        onSubmit={async (p) => {
          const types = TYPES.filter((ty) => p[`${ty}_on`]).map((ty) => ({ type: ty, label: p[`${ty}_label`] || t(`meal.${ty}`), weight: p[`${ty}_weight`] ?? 1, isActive: true, optOutDeadline: String(p[`${ty}_deadline`] ?? '') }));
          if (!types.length) throw new Error(t('set.needOneMeal'));
          if (types.some((x) => !TIME.test(x.optOutDeadline) || !(x.weight > 0 && x.weight <= 10))) throw new Error(t('set.mealInvalid'));
          await saveMeals.mutateAsync(types);
        }} />
    </>
  );
}
