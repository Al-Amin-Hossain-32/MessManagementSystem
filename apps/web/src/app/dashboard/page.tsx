'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Plus, Search, ShieldCheck, Store } from 'lucide-react';
import { z } from 'zod';
import { useT } from '@/i18n';
import { useSession } from '@/lib/session';
import * as E from '@/lib/endpoints';
import { useAct, useQ } from '@/lib/hooks';
import { fmtNumber } from '@/lib/format';
import { Button, Card, Chip, Empty, ErrorBox, StatusBadge } from '@/components/ui';
import { FormDialog, Modal } from '@/components/dialogs';
import { Dt } from '@/components/ui';
import { useToast } from '@/components/toast';
import { errorMessage } from '@/lib/errors';

export default function HomePage() {
  const { t, lang } = useT();
  const { ctx, reload } = useSession();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const inv = useQ(['invitations'], E.auth.invitations);
  const [found, setFound] = useState<{ id: string; name: string; address?: string | null } | null>(null);

  const acceptBoarder = useAct((id: string) => E.members.acceptInvite(id), { ok: 'home.accepted', reloadCtx: true });
  const declineBoarder = useAct((id: string) => E.members.declineInvite(id), { ok: 'home.declined' });
  const acceptCo = useAct((id: string) => E.messes.acceptCoAdmin(id), { ok: 'home.accepted', reloadCtx: true });
  const acceptMgr = useAct((a: { messId: string; assignmentId: string }) => E.managers.accept(a.messId, a.assignmentId), { ok: 'home.accepted', reloadCtx: true });
  const respondDirector = useAct((a: { messId: string; relationshipId: string; accept: boolean }) =>
    E.directors.respond(a.messId, a.relationshipId, a.accept), { ok: 'home.accepted', reloadCtx: true });
  const join = useAct((id: string) => E.members.requestJoin(id), { ok: 'home.joinSent', onDone: () => { setFound(null); setJoinOpen(false); } });

  // One card per Mess, merging every role the user holds there (owner/admin, manager, boarder).
  const byMess = new Map<string, { name: string; roles: string[]; status?: string }>();
  const add = (id: string, name: string, role: string, status?: string) => {
    const e = byMess.get(id) ?? { name, roles: [], status };
    e.roles.push(role); byMess.set(id, e);
  };
  ctx?.messMemberships.forEach((m) => add(m.messId, m.messName, m.role, m.messStatus));
  ctx?.activeManagerAssignments.forEach((m) => add(m.messId, m.messName, 'MANAGER'));
  ctx?.boarderOf.forEach((m) => add(m.messId, m.messName, 'BOARDER', m.messStatus));
  ctx?.activeDirectorships.forEach((m) => add(m.messId, m.messName, 'DIRECTOR', m.messStatus));

  const hasInv = inv.data && (inv.data.boarderInvites.length + inv.data.coAdminInvites.length + inv.data.managerAssignments.length + inv.data.pendingJoinRequests.length + inv.data.directorInvites.length) > 0;

  const workspaceCount = (ctx?.shopsManaged.length ?? 0) + (ctx?.isPlatformAdmin ? 1 : 0);
  const inviteCount = inv.data ? inv.data.boarderInvites.length + inv.data.coAdminInvites.length + inv.data.managerAssignments.length + inv.data.pendingJoinRequests.length + inv.data.directorInvites.length : 0;
  const roleCount = Array.from(byMess.values()).reduce((sum, mess) => sum + mess.roles.length, 0);
  const metrics = [
    { label: t('home.myMessesMetric'), value: fmtNumber(byMess.size, lang), hint: t('home.activeAccess') },
    {
      label: t('home.pendingInvites'),
      value: inv.isLoading ? <span className="skeleton-shimmer block h-7 w-14 rounded-md" aria-hidden /> : fmtNumber(inviteCount, lang),
      hint: t('home.awaitingResponse'),
    },
    { label: t('home.rolesMetric'), value: fmtNumber(roleCount, lang), hint: t('home.rolesAcrossMesses') },
    { label: t('home.workspacesMetric'), value: fmtNumber(workspaceCount, lang), hint: t('home.otherWorkspacesSummary') },
  ];

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-2xl border border-line/80 bg-surface shadow-[0_4px_22px_rgb(29_43_38/0.035)]">
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between lg:px-7 lg:py-7">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{t('home.workspaceOverview')}</p>
            <h1 className="mt-2 text-[1.8rem] font-bold leading-tight tracking-tight text-ink sm:text-4xl">
              {t('home.title', { name: ctx?.name ?? '' })}
            </h1>
            <p className="mt-2 max-w-prose text-[0.95rem] leading-relaxed text-muted sm:text-base">{t('home.desc')}</p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setJoinOpen(true)}><Search className="h-4 w-4" />{t('home.join')}</Button>
            <Button className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />{t('home.create')}</Button>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-px border-t border-line/80 bg-line/80 sm:grid-cols-2 xl:grid-cols-4" aria-busy={inv.isLoading}>
          {metrics.map((metric, index) => (
            <div key={metric.label} className={`min-w-0 bg-surface px-4 py-4 sm:px-6 ${index >= 2 ? 'border-t border-line/80 xl:border-t-0' : ''} ${index === 1 ? 'border-l border-line/80 xl:border-l-0' : ''} ${index > 1 ? 'xl:border-l xl:border-line/80' : ''}`}>
              <dt className="text-sm font-medium leading-snug text-muted">{metric.label}</dt>
              <dd className="num mt-1.5 font-head text-[1.55rem] font-bold leading-tight tracking-tight text-ink sm:text-2xl">{metric.value}</dd>
              <dd className="mt-1 text-xs leading-relaxed text-muted">{metric.hint}</dd>
            </div>
          ))}
        </dl>
      </section>

      {inv.isError && <ErrorBox error={inv.error} onRetry={() => { void inv.refetch(); }} />}

      {hasInv && (
        <Card className="border-holud/40 bg-holud-soft/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-ink">{t('home.invitations')}</h2>
            <span className="rounded-full bg-holud-soft px-2.5 py-1 text-xs font-semibold text-[#7a5600]">{t('home.inviteCount', { count: fmtNumber(inviteCount, lang) })}</span>
          </div>
          <ul className="mt-4 space-y-3">
            {inv.data!.boarderInvites.map((i) => (
              <li key={i.membershipId} className="flex flex-col items-stretch justify-between gap-3 rounded-2xl border border-holud/20 bg-surface/70 p-3 sm:flex-row sm:items-center">
                <span className="min-w-0">{t('home.boarderInvite', { mess: i.messName })}</span>
                <span className="flex shrink-0 gap-2"><Button size="sm" className="min-h-10 flex-1 sm:min-h-8 sm:flex-none" onClick={() => acceptBoarder.mutate(i.messId)}>{t('common.accept')}</Button><Button size="sm" className="min-h-10 flex-1 sm:min-h-8 sm:flex-none" variant="ghost" onClick={() => declineBoarder.mutate(i.messId)}>{t('common.decline')}</Button></span>
              </li>))}
            {inv.data!.coAdminInvites.map((i) => (
              <li key={i.membershipId} className="flex flex-col items-stretch justify-between gap-3 rounded-2xl border border-holud/20 bg-surface/70 p-3 sm:flex-row sm:items-center">
                <span className="min-w-0">{t('home.coAdminInvite', { mess: i.messName })}</span>
                <Button size="sm" className="min-h-10 shrink-0 sm:min-h-8" onClick={() => acceptCo.mutate(i.messId)}>{t('common.accept')}</Button>
              </li>))}
            {inv.data!.managerAssignments.map((a) => (
              <li key={a.assignmentId} className="flex flex-col items-stretch justify-between gap-3 rounded-2xl border border-holud/20 bg-surface/70 p-3 sm:flex-row sm:items-center">
                <span className="min-w-0">{t('home.managerInvite', { mess: a.messName, period: a.periodLabel })} (<Dt v={a.startDate} /> – <Dt v={a.endDate} />)</span>
                <Button size="sm" className="min-h-10 shrink-0 sm:min-h-8" onClick={() => acceptMgr.mutate({ messId: a.messId, assignmentId: a.assignmentId })}>{t('common.accept')}</Button>
              </li>))}
            {inv.data!.pendingJoinRequests.map((i) => (
              <li key={i.membershipId} className="flex flex-col items-stretch justify-between gap-3 rounded-2xl border border-holud/20 bg-surface/70 p-3 text-muted sm:flex-row sm:items-center">
                <span>{t('home.joinPending', { mess: i.messName })}</span><StatusBadge value="PENDING_APPROVAL" />
              </li>))}
            {inv.data!.directorInvites.map((i) => (
              <li key={i.relationshipId} className="flex flex-col items-stretch justify-between gap-3 rounded-2xl border border-holud/20 bg-surface/70 p-3 sm:flex-row sm:items-center">
                <span className="min-w-0">{t('home.directorInvite', { mess: i.messName })}</span>
                <span className="flex shrink-0 gap-2">
                  <Button size="sm" className="min-h-10 flex-1 sm:min-h-8 sm:flex-none" onClick={() => respondDirector.mutate({ messId: i.messId, relationshipId: i.relationshipId, accept: true })}>{t('common.accept')}</Button>
                  <Button size="sm" variant="ghost" className="min-h-10 flex-1 sm:min-h-8 sm:flex-none" onClick={() => respondDirector.mutate({ messId: i.messId, relationshipId: i.relationshipId, accept: false })}>{t('common.decline')}</Button>
                </span>
              </li>))}
          </ul>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.65fr_0.95fr] xl:gap-7">
        <section className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-ink">{t('home.myMesses')}</h2>
            <span className="text-sm text-muted">{t('home.totalCount', { count: fmtNumber(byMess.size, lang) })}</span>
          </div>

          {byMess.size === 0 ? (
            <Empty title={t('home.noMess')} hint={t('home.noMessHint')} action={<Button className="mt-2" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />{t('home.create')}</Button>} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from(byMess).map(([id, m]) => (
                <Link key={id} href={`/mess/${id}`} className="group overflow-hidden rounded-2xl border border-line/80 bg-surface p-4 shadow-[0_3px_16px_rgb(29_43_38/0.035)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_8px_24px_rgb(14_90_72/0.07)] sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-head text-xl font-bold text-ink">{m.name}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.roles.map((r) => <Chip key={r}>{r === 'MANAGER' ? t('role.manager') : r === 'BOARDER' ? t('role.boarder') : r === 'DIRECTOR' ? t('role.director') : t(`st.${r}`)}</Chip>)}
                      </div>
                    </div>
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand transition-transform group-hover:scale-105">
                      <ChevronRight className="h-5 w-5" aria-hidden />
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-paper p-3">
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-[0.12em] text-muted">{t('home.status')}</p>
                      <StatusBadge value={m.status ?? 'ACTIVE'} />
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-brand">
                      <span>{t('home.openWorkspace')}</span>
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <Card className="border-brand bg-brand text-brand-ink shadow-[0_6px_20px_rgb(14_90_72/0.12)]">
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-brand-ink/70">{t('home.quickAccess')}</p>
            <h3 className="mt-2 font-head text-xl font-bold">{t('home.nextAction')}</h3>
            <div className="mt-4 divide-y divide-white/15">
              <div className="py-3 first:pt-0">
                <p className="text-sm text-brand-ink/80">{t('home.createAnother')}</p>
                <button onClick={() => setCreateOpen(true)} className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-brand transition-colors hover:bg-brand-soft focus-visible:outline-white">
                  <Plus className="h-4 w-4" aria-hidden />
                  {t('home.create')}
                </button>
              </div>
              <div className="py-3 last:pb-0">
                <p className="text-sm text-brand-ink/80">{t('home.findMess')}</p>
                <button onClick={() => setJoinOpen(true)} className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/25 px-3.5 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-white/10 focus-visible:outline-white">
                  <Search className="h-4 w-4" aria-hidden />
                  {t('home.join')}
                </button>
              </div>
            </div>
          </Card>

          {((ctx?.shopsManaged.length ?? 0) > 0 || ctx?.isPlatformAdmin) && (
            <Card>
              <h3 className="text-lg font-bold text-ink">{t('home.otherWorkspaces')}</h3>
              <div className="mt-4 space-y-3">
                {ctx!.shopsManaged.map((s) => (
                  <Link key={s.shopId} href={`/shop/${s.shopId}`} className="flex items-center justify-between gap-3 rounded-2xl border border-line/80 bg-paper p-3 transition-colors hover:border-brand/35 hover:bg-brand-soft/30">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft text-brand"><Store className="h-4 w-4" aria-hidden /></span>
                      <span className="font-medium text-ink">{s.shopName}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
                  </Link>
                ))}
                {ctx?.isPlatformAdmin && (
                  <Link href="/platform" className="flex items-center justify-between gap-3 rounded-2xl border border-line/80 bg-paper p-3 transition-colors hover:border-brand/35 hover:bg-brand-soft/30">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft text-brand"><ShieldCheck className="h-4 w-4" aria-hidden /></span>
                      <span className="font-medium text-ink">{t('nav.platform')}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
                  </Link>
                )}
              </div>
            </Card>
          )}
        </aside>
      </div>

      <FormDialog open={createOpen} onClose={() => setCreateOpen(false)} title={t('home.create')} submitLabel={t('common.create')}
        schema={z.object({ name: z.string().min(3, t('val.nameMin3')).max(100), address: z.string().max(500).optional(), description: z.string().max(1000).optional() })}
        fields={[{ name: 'name', label: t('mess.name'), required: true }, { name: 'address', label: t('mess.address') }, { name: 'description', label: t('mess.description'), type: 'textarea' }]}
        onSubmit={async (p) => {
          try { const r = await E.messes.create(p as any); await reload(); toast(t('home.created')); window.location.assign(`/mess/${r.mess.id}`); }
          catch (e) { toast(errorMessage(e, t), 'err'); throw e; }
        }} />

      <Modal open={joinOpen} onClose={() => { setJoinOpen(false); setFound(null); }} title={t('home.join')}>
        <JoinLookup found={found} onFound={setFound} onJoin={(id) => join.mutate(id)} busy={join.isPending} />
      </Modal>
    </div>
  );
}

function JoinLookup({ found, onFound, onJoin, busy }: { found: { id: string; name: string; address?: string | null } | null; onFound: (m: any) => void; onJoin: (id: string) => void; busy: boolean }) {
  const { t } = useT();
  const toast = useToast();
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const lookup = async (e: React.FormEvent) => {
    e.preventDefault(); if (!slug.trim()) return;
    setLoading(true);
    try { onFound((await E.messes.bySlug(slug.trim().toLowerCase())).mess); }
    catch (err) { onFound(null); toast(errorMessage(err, t), 'err'); }
    finally { setLoading(false); }
  };
  return (
    <div className="space-y-4">
      <form onSubmit={lookup} className="flex gap-2">
        <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={t('home.slugPlaceholder')} className="min-h-10 flex-1 rounded-ctl border border-line px-3" aria-label={t('home.slug')} />
        <Button type="submit" busy={loading}>{t('common.search')}</Button>
      </form>
      <p className="text-xs text-muted">{t('home.slugHint')}</p>
      {found && (
        <div className="rounded-card border border-line p-3">
          <p className="font-head font-bold">{found.name}</p>
          {found.address && <p className="text-sm text-muted">{found.address}</p>}
          <Button className="mt-3 w-full" busy={busy} onClick={() => onJoin(found.id)}>{t('home.sendJoin')}</Button>
        </div>
      )}
    </div>
  );
}
