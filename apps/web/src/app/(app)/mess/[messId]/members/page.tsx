'use client';
import { useState } from 'react';
import { z } from 'zod';
import { useT } from '@/i18n';
import * as E from '@/lib/endpoints';
import { useAct, useQ } from '@/lib/hooks';
import { useMess } from '@/lib/use-mess';
import { Async, Button, Chip, Dt, PageHeader, StatusBadge, Tabs } from '@/components/ui';
import { DataTable } from '@/components/table';
import { ConfirmDialog, FormDialog } from '@/components/dialogs';
import type { Boarder } from '@/lib/types';

const TABS = ['ACTIVE', 'PENDING_APPROVAL', 'INVITED', 'LEAVE_REQUESTED', 'ENDED'];

export default function MembersPage() {
  const { messId, access } = useMess();
  const { t } = useT();
  const [status, setStatus] = useState('ACTIVE');
  const [invite, setInvite] = useState(false);
  const [dlg, setDlg] = useState<{ kind: 'reject' | 'end'; id: string } | null>(null);
  const [res, setRes] = useState<Boarder | null>(null);
  const q = useQ(['boarders', messId, status], async () => (await E.members.list(messId, status)).boarders);
  const doInvite = useAct((email: string) => E.members.invite(messId, email), { ok: 'mem.invited' });
  const approve = useAct((id: string) => E.members.approve(messId, id), { ok: 'mem.approved' });
  const reject = useAct((a: { id: string; reason: string }) => E.members.reject(messId, a.id, a.reason || undefined), { ok: 'common.done' });
  const end = useAct((a: { id: string; reason: string }) => E.members.end(messId, a.id, a.reason || undefined), { ok: 'common.done' });
  const residency = useAct((a: { id: string; type: string }) => E.members.residency(messId, a.id, { type: a.type }), { ok: 'common.saved' });
  const cur = (b: Boarder) => b.residencies?.[0]?.type;
  return (
    <>
      <PageHeader title={t('nav.members')} desc={t('mem.desc')} actions={access.isAdmin && <Button onClick={() => setInvite(true)}>{t('mem.invite')}</Button>} />
      <Tabs value={status} onChange={setStatus} tabs={TABS.map((s) => ({ id: s, label: t(`st.${s}`) }))} />
      <Async q={q}>{(rows) => (
        <DataTable rows={rows} rowKey={(r) => r.id} empty={t('mem.none')}
          cols={[{ key: 'n', header: t('common.name'), cell: (r) => r.user.name, primary: true },
            { key: 'e', header: t('auth.email'), cell: (r) => r.user.email ?? '—' },
            { key: 'p', header: t('auth.phone'), cell: (r) => r.user.phone ?? '—' },
            { key: 'r', header: t('mem.residency'), cell: (r) => (cur(r) ? <Chip>{t(`st.${cur(r)}`)}</Chip> : '—') },
            { key: 'j', header: t('mem.joined'), cell: (r) => <Dt v={r.joinedAt ?? r.requestedAt ?? r.createdAt} /> },
            { key: 's', header: t('common.status'), cell: (r) => <StatusBadge value={r.status} /> }]}
          actions={access.isAdmin ? (r) => (<>
            {r.status === 'PENDING_APPROVAL' && (<><Button size="sm" onClick={() => approve.mutate(r.id)}>{t('common.approve')}</Button><Button size="sm" variant="ghost" onClick={() => setDlg({ kind: 'reject', id: r.id })}>{t('common.reject')}</Button></>)}
            {(r.status === 'ACTIVE' || r.status === 'LEAVE_REQUESTED') && (<><Button size="sm" variant="ghost" onClick={() => setRes(r)}>{t('mem.changeResidency')}</Button><Button size="sm" variant="ghost" onClick={() => setDlg({ kind: 'end', id: r.id })}>{t('mem.end')}</Button></>)}</>) : undefined} />)}</Async>
      <FormDialog open={invite} onClose={() => setInvite(false)} title={t('mem.invite')} submitLabel={t('mem.sendInvite')} schema={z.object({ email: z.string().email(t('val.email')) })}
        fields={[{ name: 'email', label: t('auth.email'), type: 'email', required: true, hint: t('mem.inviteHint') }]} onSubmit={(p) => doInvite.mutateAsync(p.email)} />
      <FormDialog open={!!res} onClose={() => setRes(null)} title={t('mem.changeResidency')} initial={{ type: cur(res ?? ({} as Boarder)) ?? '' }}
        fields={[{ name: 'type', label: t('mem.residency'), type: 'select', required: true, options: ['RESIDENT', 'MEAL_ONLY'].map((x) => ({ value: x, label: t(`st.${x}`) })), hint: t('mem.residencyHint') }]}
        onSubmit={(p) => residency.mutateAsync({ id: res!.id, type: p.type })} />
      <ConfirmDialog open={!!dlg} onClose={() => setDlg(null)} danger title={dlg?.kind === 'reject' ? t('common.reject') : t('mem.end')} reasonLabel={t('common.reason')} reasonRequired={false}
        onConfirm={(reason) => (dlg!.kind === 'reject' ? reject : end).mutateAsync({ id: dlg!.id, reason })} />
    </>
  );
}
