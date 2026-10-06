'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { CheckCircle2, Circle } from 'lucide-react';
import { useT } from '@/i18n';
import * as E from '@/lib/endpoints';
import { useQ } from '@/lib/hooks';
import { fmtNumber, todayStr } from '@/lib/format';
import { useCurrentPeriod, useMess } from '@/lib/use-mess';
import { Async, Card, Chip, Dt, Empty, ErrorBox, Money, PageHeader, Skeleton, Stat, StatusBadge } from '@/components/ui';

const Tile = ({ href, ...p }: { href: string; label: string; value: ReactNode; tone?: 'warn' | 'bad' | 'good' }) => (
  <Link href={href} className="group block rounded-2xl focus-visible:outline-offset-4">
    <Stat {...p} interactive />
  </Link>
);

function MetricSkeleton() {
  return <span className="block h-8 w-16 animate-pulse rounded-lg bg-line/60" aria-hidden />;
}

function QueryTile<T>({ href, label, value, tone, query }: {
  href: string; label: string; value: ReactNode; tone?: 'warn' | 'bad' | 'good'; query: UseQueryResult<T>;
}) {
  if (query.isError) return <ErrorBox error={query.error} onRetry={() => { void query.refetch(); }} />;
  return <Tile href={href} label={label} value={query.isLoading ? <MetricSkeleton /> : value} tone={tone} />;
}

export default function Dashboard() {
  const { messId, access } = useMess();
  const { t } = useT();
  const period = useCurrentPeriod(messId);
  const p = period.data;
  return (
    <>
      <PageHeader title={access.messName}
        desc={p ? `${t('dash.period')}: ${p.periodLabel}` : period.isLoading || period.isError ? undefined : t('dash.noPeriod')}
        actions={p && <StatusBadge value={p.status} />} />
      {period.isError && <div className="mb-6"><ErrorBox error={period.error} onRetry={() => { void period.refetch(); }} /></div>}
      {access.isAdmin && <SetupChecklist messId={messId} />}
      {access.isDirector && !access.isStaff && !access.isBoarder && <DirectorDash messId={messId} periodId={p?.id} />}
      {access.isBoarder && <BoarderDash messId={messId} periodId={p?.id} />}
      {access.isStaff && <StaffDash messId={messId} isAdmin={access.isAdmin} periodId={p?.id} />}
      {!access.isStaff && !access.isBoarder && !access.isDirector && <Card>{t('dash.pendingRole')}</Card>}
    </>
  );
}

function DirectorDash({ messId, periodId }: { messId: string; periodId?: string }) {
  const { t, lang } = useT();
  const periodExpenses = useQ(['director-expenses', messId, periodId], () => E.expenses.list(messId, { accountingPeriodId: periodId }), !!periodId);
  const periodPayments = useQ(['director-payments', messId, periodId], () => E.payments.list(messId, { accountingPeriodId: periodId }), !!periodId);
  const statements = useQ(['director-statements', messId, periodId], () => E.accounting.statements(messId, periodId!), !!periodId);
  return (
    <div className="space-y-5">
      <FinanceSummary messId={messId} />
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { href: `/mess/${messId}/expenses`, label: t('nav.expenses'), value: periodExpenses.data?.expenses.length },
          { href: `/mess/${messId}/payments`, label: t('nav.payments'), value: periodPayments.data?.payments.length },
          { href: `/mess/${messId}/statements`, label: t('nav.statements'), value: statements.data?.statements.length },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="rounded-2xl focus-visible:outline-offset-4">
            <Stat label={item.label} value={item.value === undefined ? <MetricSkeleton /> : fmtNumber(item.value, lang)} interactive />
          </Link>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-bold">{t('nav.expenses')}</h2><Link className="text-sm font-semibold text-brand" href={`/mess/${messId}/expenses`}>{t('common.viewAll')}</Link></div>
          {periodExpenses.isLoading ? <Skeleton rows={3} /> : periodExpenses.isError ? <ErrorBox error={periodExpenses.error} onRetry={() => { void periodExpenses.refetch(); }} /> :
            periodExpenses.data?.expenses.length ? <ul className="divide-y divide-line/70">{periodExpenses.data.expenses.slice(0, 5).map((expense) => (
              <li key={expense.id} className="flex min-w-0 items-center justify-between gap-3 py-2.5 text-sm"><span className="min-w-0 truncate">{expense.description}</span><Money v={expense.amount} className="shrink-0 font-semibold" /></li>
            ))}</ul> : <Empty title={t('common.none')} />}
        </Card>
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-bold">{t('nav.payments')}</h2><Link className="text-sm font-semibold text-brand" href={`/mess/${messId}/payments`}>{t('common.viewAll')}</Link></div>
          {periodPayments.isLoading ? <Skeleton rows={3} /> : periodPayments.isError ? <ErrorBox error={periodPayments.error} onRetry={() => { void periodPayments.refetch(); }} /> :
            periodPayments.data?.payments.length ? <ul className="divide-y divide-line/70">{periodPayments.data.payments.slice(0, 5).map((payment) => (
              <li key={payment.id} className="flex min-w-0 items-center justify-between gap-3 py-2.5 text-sm"><span className="text-muted"><Dt v={payment.initiatedAt} /></span><Money v={payment.amount} className="shrink-0 font-semibold" /></li>
            ))}</ul> : <Empty title={t('common.none')} />}
        </Card>
      </div>
    </div>
  );
}

function BoarderDash({ messId, periodId }: { messId: string; periodId?: string }) {
  const { t } = useT();
  const today = todayStr();
  const meals = useQ(['meals', messId, 'mine', today], () => E.meals.mine(messId, today));
  const stmt = useQ(['stmt', messId, periodId], () => E.accounting.myStatementIfGenerated(messId, periodId!), !!periodId);
  const pays = useQ(['pay', messId, 'mine'], () => E.payments.mine(messId));
  const disp = useQ(['disp', messId, 'mine'], () => E.disputes.mine(messId));
  const s = stmt.data?.statement;
  const openDisp = disp.data?.disputes.filter((d) => d.status === 'OPEN' || d.status === 'UNDER_REVIEW').length ?? 0;
  const pending = pays.data?.payments.filter((x) => x.status === 'PENDING_CONFIRMATION').length ?? 0;
  const { lang } = useT();
  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{t('dash.todayMeals')}</h2>
            <Link href={`/mess/${messId}/meals`} className="shrink-0 text-sm font-semibold text-brand underline-offset-4 hover:underline">{t('nav.meals')}</Link>
          </div>
          {meals.isLoading ? <Skeleton rows={1} /> : meals.isError ? (
            <ErrorBox error={meals.error} onRetry={() => { void meals.refetch(); }} />
          ) : meals.data?.meals.length ? (
            <ul className="flex flex-wrap gap-2">
              {meals.data.meals.map((m) => (
                <li key={m.id} className="flex min-h-11 items-center gap-2 rounded-xl border border-line/80 bg-paper/60 px-3 py-2">
                  <span className="font-medium">{t(`meal.${m.mealType}`)}</span><StatusBadge value={m.status} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty title={t('dash.noMealsToday')} />
          )}
        </Card>

        <section aria-labelledby="my-balance-title" className="khata overflow-hidden rounded-2xl border border-line/80 py-2 shadow-[0_4px_18px_rgb(29_43_38/0.035)]">
          <div className="khata-row"><h2 id="my-balance-title" className="font-head font-bold">{t('dash.myBalance')}</h2></div>
          {stmt.isLoading ? <div className="px-4 py-3"><Skeleton rows={3} /></div> : stmt.isError ? (
            <div className="px-4 py-3"><ErrorBox error={stmt.error} onRetry={() => { void stmt.refetch(); }} /></div>
          ) : s ? (<>
            <div className="khata-row"><span className="text-muted">{t('stmt.totalDue')}</span><Money v={s.totalDue} /></div>
            <div className="khata-row"><span className="text-muted">{t('stmt.confirmedPayments')}</span><Money v={s.confirmedPayments} /></div>
            <div className="khata-row"><span className="font-medium">{t('stmt.closingBalance')}</span><Money v={s.closingBalance} className="font-head text-lg font-bold" /></div>
          </>) : <div className="px-4 py-3"><Empty title={t('dash.noStatement')} hint={t('dash.statementNotReadyHint')} /></div>}
        </section>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <QueryTile href={`/mess/${messId}/payments`} label={t('dash.pendingPayments')} value={fmtNumber(pending, lang)} tone={pending ? 'warn' : undefined} query={pays} />
        <QueryTile href={`/mess/${messId}/disputes`} label={t('dash.openDisputes')} value={fmtNumber(openDisp, lang)} tone={openDisp ? 'warn' : undefined} query={disp} />
        <Card className="sm:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-bold">{t('dash.recentPayments')}</h2>
            <Link href={`/mess/${messId}/payments`} className="shrink-0 text-sm font-semibold text-brand underline-offset-4 hover:underline">{t('nav.payments')}</Link>
          </div>
          {pays.isLoading ? <Skeleton rows={2} /> : pays.isError ? (
            <ErrorBox error={pays.error} onRetry={() => { void pays.refetch(); }} />
          ) : pays.data?.payments.length ? (
            <ul className="divide-y divide-line/70">
              {pays.data.payments.slice(0, 3).map((x) => (
                <li key={x.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-2.5 text-sm sm:flex sm:justify-between">
                  <span className="text-muted"><Dt v={x.initiatedAt} /></span>
                  <Money v={x.amount} className="text-right font-semibold" />
                  <span className="col-span-2 sm:col-auto"><StatusBadge value={x.status} /></span>
                </li>
              ))}
            </ul>
          ) : <Empty title={t('dash.noPayments')} />}
        </Card>
      </div>
    </div>
  );
}

function StaffDash({ messId, isAdmin, periodId }: { messId: string; isAdmin: boolean; periodId?: string }) {
  const { t, lang } = useT();
  const drafts = useQ(['exp', messId, 'DRAFT'], () => E.expenses.list(messId, { status: 'DRAFT' }));
  const draftShop = useQ(['exp', messId, 'DRAFT_FROM_SHOP'], () => E.expenses.list(messId, { status: 'DRAFT_FROM_SHOP' }));
  const pays = useQ(['pay', messId, 'PENDING'], () => E.payments.list(messId, { status: 'PENDING_CONFIRMATION' }));
  const disp = useQ(['disp', messId, 'OPEN'], () => E.disputes.list(messId, { status: 'OPEN' }));
  const corr = useQ(['corr', messId, 'PENDING'], () => E.meals.corrections(messId, 'PENDING'));
  const join = useQ(['boarders', messId, 'PENDING_APPROVAL'], async () => (await E.members.list(messId, 'PENDING_APPROVAL')).boarders);
  const failed = useQ(['failed', messId], () => E.shopLink.failed(messId), isAdmin);
  const draftN = (drafts.data?.expenses.length ?? 0) + (draftShop.data?.expenses.length ?? 0);
  return (
    <>
      <FinanceSummary messId={messId} />
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-bold">{t('dash.needsAttention')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {drafts.isError ? <ErrorBox error={drafts.error} onRetry={() => { void drafts.refetch(); }} /> : draftShop.isError ? (
            <ErrorBox error={draftShop.error} onRetry={() => { void draftShop.refetch(); }} />
          ) : (
            <Tile href={`/mess/${messId}/expenses`} label={t('dash.draftExpenses')} value={drafts.isLoading || draftShop.isLoading ? <MetricSkeleton /> : fmtNumber(draftN, lang)} tone={draftN ? 'warn' : undefined} />
          )}
          <QueryTile href={`/mess/${messId}/payments`} label={t('dash.pendingPayments')} value={fmtNumber(pays.data?.payments.length ?? 0, lang)} tone={pays.data?.payments.length ? 'warn' : undefined} query={pays} />
          <QueryTile href={`/mess/${messId}/disputes`} label={t('dash.openDisputes')} value={fmtNumber(disp.data?.disputes.length ?? 0, lang)} tone={disp.data?.disputes.length ? 'bad' : undefined} query={disp} />
          <QueryTile href={`/mess/${messId}/meals`} label={t('dash.pendingCorrections')} value={fmtNumber(corr.data?.requests.length ?? 0, lang)} tone={corr.data?.requests.length ? 'warn' : undefined} query={corr} />
          <QueryTile href={`/mess/${messId}/members`} label={t('dash.joinRequests')} value={fmtNumber(join.data?.length ?? 0, lang)} tone={join.data?.length ? 'warn' : undefined} query={join} />
          {isAdmin && <QueryTile href={`/mess/${messId}/shop-orders`} label={t('dash.failedIntegrations')} value={fmtNumber(failed.data?.records.length ?? 0, lang)} tone={failed.data?.records.length ? 'bad' : undefined} query={failed} />}
        </div>
      </section>
    </>
  );
}

function FinanceSummary({ messId }: { messId: string }) {
  const { t } = useT();
  const finance = useQ(['finance-summary', messId], () => E.payments.fundSummary(messId));

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-lg font-bold">{t('dash.fundsSummary')}</h2>
      <Async q={finance} rows={1}>{(totals) => (
        <div className="grid gap-3 sm:grid-cols-3">
          <Tile href={`/mess/${messId}/payments`} label={t('dash.collected')} value={<Money v={totals.collected} />} tone="good" />
          <Tile href={`/mess/${messId}/expenses`} label={t('dash.spent')} value={<Money v={totals.spent} />} />
          <Stat label={t('dash.available')} value={<Money v={totals.balance} />} tone={Number(totals.balance) < 0 ? 'bad' : 'good'} />
        </div>
      )}</Async>
    </section>
  );
}

function SetupChecklist({ messId }: { messId: string }) {
  const { t, lang } = useT();
  const cfg = useQ(['mealcfg', messId], () => E.mealConfig.get(messId));
  const cats = useQ(['cats', messId], () => E.categories.list(messId));
  const boarders = useQ(['boarders', messId, 'ACTIVE'], async () => (await E.members.list(messId, 'ACTIVE')).boarders);
  const mgr = useQ(['mgr', messId, 'current'], () => E.managers.current(messId));
  const steps = [
    { done: !!cfg.data?.config, label: t('setup.mealConfig'), href: `/mess/${messId}/settings` },
    { done: (cats.data?.categories.length ?? 0) > 0, label: t('setup.categories'), href: `/mess/${messId}/expenses` },
    { done: (boarders.data?.length ?? 0) > 0, label: t('setup.boarders'), href: `/mess/${messId}/members` },
    { done: !!mgr.data?.assignment, label: t('setup.manager'), href: `/mess/${messId}/managers` },
  ];
  const loading = [cfg, cats, boarders, mgr].some((q) => q.isLoading);
  const failures = [
    { key: 'meal-config', query: cfg },
    { key: 'categories', query: cats },
    { key: 'boarders', query: boarders },
    { key: 'manager', query: mgr },
  ].filter(({ query }) => query.isError);
  if (loading) return <Card className="mb-6 border-brand/20 bg-brand-soft/20"><Skeleton rows={2} /></Card>;
  if (failures.length) return (
    <Card className="mb-6 space-y-3 border-brand/20 bg-brand-soft/20">
      {failures.map(({ key, query }) => <ErrorBox key={key} error={query.error} onRetry={() => { void query.refetch(); }} />)}
    </Card>
  );
  if (steps.every((s) => s.done)) return null;
  return (
    <Card className="mb-6 border-brand/30 bg-brand-soft/40">
      <h2 className="mb-1 text-lg font-bold">{t('setup.title')}</h2>
      <p className="mb-3 text-sm text-muted">{t('setup.desc')}</p>
      <ul className="space-y-1.5">
        {steps.map((s) => (
          <li key={s.href + s.label}><Link href={s.href} className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm transition-colors hover:bg-surface/80 hover:underline focus-visible:outline-offset-1">
            {s.done ? <CheckCircle2 className="h-5 w-5 text-brand" /> : <Circle className="h-5 w-5 text-muted" />}
            <span className={s.done ? 'text-muted line-through' : 'font-medium'}>{s.label}</span></Link></li>
        ))}
      </ul>
      <Chip>{fmtNumber(steps.filter((s) => s.done).length, lang)}/{fmtNumber(steps.length, lang)}</Chip>
    </Card>
  );
}
