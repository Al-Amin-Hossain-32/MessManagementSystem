'use client';
import { useState } from 'react';
import { z } from 'zod';
import { useT } from '@/i18n';
import * as E from '@/lib/endpoints';
import { useAct, useQ } from '@/lib/hooks';
import { useMess } from '@/lib/use-mess';
import { Button, Card, Dt, Empty, ErrorBox, PageHeader, Skeleton, StatusBadge } from '@/components/ui';
import { ConfirmDialog, FormDialog } from '@/components/dialogs';
import type { DirectorRelationship } from '@/lib/types';

export default function DirectorsPage() {
  const { messId, access } = useMess();
  const { t } = useT();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [suspend, setSuspend] = useState<DirectorRelationship | null>(null);
  const [revoke, setRevoke] = useState<DirectorRelationship | null>(null);
  const directors = useQ(['directors', messId], async () => (await E.directors.list(messId)).directors, access.isOwner);
  const invite = useAct((email: string) => E.directors.invite(messId, email), { ok: 'director.invited' });
  const suspendDirector = useAct((a: { id: string; reason: string }) => E.directors.suspend(messId, a.id, a.reason), { ok: 'common.saved' });
  const reactivate = useAct((id: string) => E.directors.reactivate(messId, id), { ok: 'common.saved' });
  const revokeDirector = useAct((id: string) => E.directors.revoke(messId, id), { ok: 'director.revoked' });
  if (!access.isOwner) return <Empty title={t('err.FORBIDDEN')} />;
  return (
    <>
      <PageHeader title={t('nav.directors')} desc={t('director.desc')} actions={<Button onClick={() => setInviteOpen(true)}>{t('director.invite')}</Button>} />
      {directors.isLoading ? <Skeleton rows={4} /> : directors.isError ? <ErrorBox error={directors.error} onRetry={() => { void directors.refetch(); }} /> :
        directors.data?.length ? <div className="space-y-3">{directors.data.map((row) => (
          <Card key={row.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><p className="font-semibold">{row.director.name}</p><p className="break-all text-sm text-muted">{row.director.email}</p>
                <p className="mt-1 text-xs text-muted">{t('director.invitedAt')}: <Dt v={row.invitedAt} /></p>
                {row.suspensionReason && <p className="mt-1 text-sm text-muted">{row.suspensionReason}</p>}</div>
              <div className="flex flex-wrap items-center gap-2"><StatusBadge value={row.status} />
                {row.status === 'ACTIVE' && <Button size="sm" variant="ghost" onClick={() => setSuspend(row)}>{t('director.suspend')}</Button>}
                {row.status === 'SUSPENDED' && <Button size="sm" variant="ghost" onClick={() => reactivate.mutate(row.id)}>{t('director.reactivate')}</Button>}
                {['ACTIVE', 'PENDING', 'SUSPENDED'].includes(row.status) && <Button size="sm" variant="danger" onClick={() => setRevoke(row)}>{t('director.revoke')}</Button>}
              </div>
            </div>
          </Card>))}</div> : <Card><Empty title={t('director.empty')} hint={t('director.emptyHint')} /></Card>}
      <FormDialog open={inviteOpen} onClose={() => setInviteOpen(false)} title={t('director.invite')} submitLabel={t('common.submit')}
        desc={t('director.inviteHint')} schema={z.object({ email: z.string().email(t('val.email')) })}
        fields={[{ name: 'email', label: t('auth.email'), type: 'email', required: true }]} onSubmit={(body) => invite.mutateAsync(body.email)} />
      <ConfirmDialog open={!!suspend} onClose={() => setSuspend(null)} title={t('director.suspend')} reasonLabel={t('common.reason')}
        onConfirm={(reason) => suspendDirector.mutateAsync({ id: suspend!.id, reason })} />
      <ConfirmDialog open={!!revoke} onClose={() => setRevoke(null)} title={t('director.revoke')} danger reasonRequired={false}
        onConfirm={() => revokeDirector.mutateAsync(revoke!.id)} />
    </>
  );
}
