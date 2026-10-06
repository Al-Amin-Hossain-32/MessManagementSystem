'use client';
import { useState } from 'react';
import { z } from 'zod';
import { useT } from '@/i18n';
import * as E from '@/lib/endpoints';
import { useAct, useQ } from '@/lib/hooks';
import { dayEndIso, dayStartIso } from '@/lib/format';
import { useBoarders, useMess } from '@/lib/use-mess';
import { Async, Button, Card, Dt, PageHeader, StatusBadge } from '@/components/ui';
import { DataTable } from '@/components/table';
import { ConfirmDialog, FormDialog } from '@/components/dialogs';

export default function ManagersPage() {
  const { messId, access } = useMess();
  const { t } = useT();
  const [assign, setAssign] = useState(false);
  const [term, setTerm] = useState<string | null>(null);
  const cur = useQ(['mgr', messId, 'current'], () => E.managers.current(messId));
  const list = useQ(['mgr', messId, 'list'], () => E.managers.list(messId), access.isStaff);
  const invitations = useQ(['invitations'], E.auth.invitations);
  const boarders = useBoarders(messId, access.isAdmin);
  const create = useAct((p: any) => E.managers.assign(messId, { userId: p.userId, periodLabel: p.periodLabel, startDate: dayStartIso(p.startDate), endDate: dayEndIso(p.endDate) }), { ok: 'mgr.assigned' });
  const accept = useAct((id: string) => E.managers.accept(messId, id), { ok: 'home.accepted', reloadCtx: true });
  const complete = useAct((id: string) => E.managers.complete(messId, id), { ok: 'mgr.completed', reloadCtx: true });
  const terminate = useAct((a: { id: string; reason: string }) => E.managers.terminate(messId, a.id, a.reason), { ok: 'common.done', reloadCtx: true });
  const c = cur.data?.assignment;
  return (
    <>
      <PageHeader title={t('nav.managers')} desc={t('mgr.desc')} actions={access.isAdmin && <Button onClick={() => setAssign(true)}>{t('mgr.assign')}</Button>} />
      <Async q={invitations}>{(d) => {
        const pending = d.managerAssignments.filter((a) => a.messId === messId);
        return pending.length > 0 && (
          <Card className="mb-5 border-holud/40 bg-holud-soft/40">
            <h2 className="mb-3 font-bold">{t('home.invitations')}</h2>
            <ul className="space-y-2">
              {pending.map((a) => (
                <li key={a.assignmentId} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{t('home.managerInvite', { mess: a.messName, period: a.periodLabel })} (<Dt v={a.startDate} /> – <Dt v={a.endDate} />)</span>
                  <Button size="sm" onClick={() => accept.mutate(a.assignmentId)}>{t('common.accept')}</Button>
                </li>
              ))}
            </ul>
          </Card>
        );
      }}</Async>
      <Card className="mb-5">
        <h2 className="mb-1 font-bold">{t('mgr.current')}</h2>
        {cur.isLoading ? '…' : c ? <p><span className="font-medium">{c.user?.name}</span> · {c.periodLabel} · <Dt v={c.startDate} /> – <Dt v={c.endDate} />{c.user?.phone && <span className="text-muted"> · {c.user.phone}</span>}</p> : <p className="text-sm text-muted">{t('mgr.noCurrent')}</p>}
      </Card>
      {access.isStaff && (
        <Async q={list}>{(d) => (
          <DataTable rows={d.assignments} rowKey={(r) => r.id} empty={t('mgr.none')}
            cols={[{ key: 'n', header: t('common.name'), cell: (r) => r.user?.name ?? '—', primary: true },
              { key: 'p', header: t('mgr.period'), cell: (r) => r.periodLabel },
              { key: 'd', header: t('common.date'), cell: (r) => <><Dt v={r.startDate} /> – <Dt v={r.endDate} /></> },
              { key: 's', header: t('common.status'), cell: (r) => <StatusBadge value={r.status} /> }]}
            actions={(r) => (<>
              {r.status === 'PENDING_ACCEPTANCE' && r.userId === access.userId && <Button size="sm" onClick={() => accept.mutate(r.id)}>{t('common.accept')}</Button>}
              {r.status === 'ACTIVE' && r.userId === access.userId && <Button size="sm" variant="ghost" onClick={() => complete.mutate(r.id)}>{t('mgr.complete')}</Button>}
              {access.isAdmin && (r.status === 'ACTIVE' || r.status === 'PENDING_ACCEPTANCE') && <Button size="sm" variant="ghost" onClick={() => setTerm(r.id)}>{t('mgr.terminate')}</Button>}</>)} />)}</Async>
      )}
      <FormDialog open={assign} onClose={() => setAssign(false)} title={t('mgr.assign')} submitLabel={t('mgr.assign')} desc={t('mgr.assignHint')}
        schema={z.object({ periodLabel: z.string().min(3).max(50) }).refine(() => true)}
        fields={[{ name: 'userId', label: t('mgr.pickBoarder'), type: 'select', required: true, options: (boarders.data ?? []).map((b) => ({ value: b.userId, label: b.user.name })) },
          { name: 'periodLabel', label: t('mgr.period'), required: true, placeholder: t('mgr.periodPlaceholder') },
          { name: 'startDate', label: t('mgr.start'), type: 'date', required: true }, { name: 'endDate', label: t('mgr.end'), type: 'date', required: true }]}
        onSubmit={async (p) => {
          if (p.endDate <= p.startDate) throw new Error(t('mgr.dateOrder'));
          await create.mutateAsync(p);
        }} />
      <ConfirmDialog open={!!term} onClose={() => setTerm(null)} danger title={t('mgr.terminate')} reasonLabel={t('common.reason')} onConfirm={(reason) => terminate.mutateAsync({ id: term!, reason })} />
    </>
  );
}
