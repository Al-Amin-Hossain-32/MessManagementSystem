'use client';
import clsx from 'clsx';
import { Loader2, Inbox, AlertTriangle } from 'lucide-react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { useT } from '@/i18n';
import { fmtDate, fmtMoney } from '@/lib/format';
import { errorMessage } from '@/lib/errors';

/* ── Buttons ─────────────────────────────────────────────────────────────── */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'quiet'; size?: 'sm' | 'md'; busy?: boolean };
export function Button({ variant = 'primary', size = 'md', busy, className, children, disabled, ...p }: BtnProps) {
  return (
    <button {...p} disabled={disabled || busy}
      className={clsx('inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-[background-color,color,border-color,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'min-h-8 px-3 text-sm' : 'min-h-10 px-4',
        variant === 'primary' && 'bg-brand text-brand-ink hover:bg-brand/90',
        variant === 'danger' && 'bg-morich text-white hover:bg-morich/90',
        variant === 'ghost' && 'border border-line bg-surface text-ink hover:bg-brand-soft',
        variant === 'quiet' && 'text-brand hover:bg-brand-soft', 'active:scale-[0.98] disabled:active:scale-100', className)}>
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/* ── Surfaces ────────────────────────────────────────────────────────────── */
export const Card = ({ className, children }: { className?: string; children: ReactNode }) => (
  <section className={clsx('rounded-2xl border border-line/80 bg-surface p-4 shadow-[0_3px_16px_rgb(29_43_38/0.035)] md:p-5', className)}>{children}</section>
);

export function PageHeader({ title, desc, actions }: { title: string; desc?: string; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line/70 pb-4 sm:mb-6 sm:gap-4 sm:pb-5 lg:mb-7">
      <div className="min-w-0">
        <h1 className="text-[1.6rem] font-bold leading-tight tracking-tight text-ink sm:text-3xl">{title}</h1>
        {desc && <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted sm:mt-1.5">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Stat({ label, value, hint, tone, interactive = false }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'warn' | 'bad' | 'good'; interactive?: boolean }) {
  return (
    <div className={clsx('h-full min-h-[6.75rem] rounded-2xl border border-line/80 bg-surface p-4 shadow-[0_3px_16px_rgb(29_43_38/0.035)] sm:min-h-[7rem] sm:p-5',
      interactive && 'transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-brand/25 hover:shadow-[0_10px_24px_rgb(29_43_38/0.07)]')}>
      <div className="text-sm font-medium leading-snug text-muted">{label}</div>
      <div className={clsx('num mt-2 font-head text-[1.65rem] font-bold leading-tight tracking-tight sm:text-3xl', tone === 'warn' && 'text-holud', tone === 'bad' && 'text-morich', tone === 'good' && 'text-brand')}>{value}</div>
      {hint && <div className="mt-1.5 text-xs leading-relaxed text-muted">{hint}</div>}
    </div>
  );
}

export function Tabs<V extends string>({ tabs, value, onChange }: { tabs: { id: V; label: string }[]; value: V; onChange: (v: V) => void }) {
  return (
    <div role="tablist" className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-line/80 bg-surface p-1 shadow-sm">
      {tabs.map((tb) => (
        <button key={tb.id} role="tab" aria-selected={value === tb.id} onClick={() => onChange(tb.id)}
          className={clsx('whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            value === tb.id ? 'bg-brand text-brand-ink shadow-sm' : 'text-muted hover:bg-brand-soft hover:text-brand')}>{tb.label}</button>
      ))}
    </div>
  );
}

/* ── Status badge (one shared label set: st.<VALUE>) ─────────────────────── */
const GOOD = ['ACTIVE', 'CONFIRMED', 'ACCEPTED', 'RESOLVED', 'DELIVERED', 'CLOSED', 'APPROVED', 'IN_STOCK', 'PROCESSED', 'FINALIZED', 'COMPLETED', 'DEFAULT_ON', 'RESIDENT', 'RECORDED'];
const BAD = ['REJECTED', 'DISPUTED', 'ESCALATED', 'REVERSED', 'REMOVED', 'SUSPENDED', 'CANCELLED', 'FAILED', 'OUT_OF_STOCK', 'TERMINATED_EARLY', 'DISMISSED', 'REFUNDED', 'REVOKED', 'DECLINED', 'EXPIRED', 'OPTED_OUT'];
const WARN = ['PENDING', 'PENDING_CONFIRMATION', 'PENDING_APPROVAL', 'PENDING_ACCEPTANCE', 'PENDING_SETUP', 'DRAFT', 'DRAFT_FROM_SHOP', 'SUBMITTED', 'UNDER_REVIEW', 'PREPARING', 'LEAVE_REQUESTED', 'INVITED', 'PLACED', 'PROCESSING', 'PARTIALLY_DELIVERED', 'TRIAL', 'OPEN', 'LOCKED', 'PAST_DUE', 'GRACE_PERIOD', 'ADJUSTED', 'CORRECTED'];
export function StatusBadge({ value }: { value?: string | null }) {
  const { t } = useT();
  if (!value) return null;
  const tone = GOOD.includes(value) ? 'good' : BAD.includes(value) ? 'bad' : WARN.includes(value) ? 'warn' : 'neutral';
  const label = t(`st.${value}`);
  return (
    <span className={clsx('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
      tone === 'good' && 'bg-brand-soft text-brand', tone === 'bad' && 'bg-morich-soft text-morich',
      tone === 'warn' && 'bg-holud-soft text-[#7a5600]', tone === 'neutral' && 'bg-line/60 text-muted')}>
      {label === `st.${value}` ? value : label}
    </span>
  );
}

export const Chip = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">{children}</span>
);

/* ── Money / dates in the active language ────────────────────────────────── */
export function Money({ v, className }: { v: unknown; className?: string }) {
  const { lang } = useT();
  return <span className={clsx('num', className)}>{fmtMoney(v, lang)}</span>;
}
export function Dt({ v, time }: { v?: string | Date | null; time?: boolean }) {
  const { lang } = useT();
  return <span className="num">{fmtDate(v, lang, time)}</span>;
}

/* ── States ──────────────────────────────────────────────────────────────── */
export const Spinner = () => <Loader2 className="h-5 w-5 animate-spin text-brand" aria-label="loading" />;

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton-shimmer h-11 rounded-xl" />)}
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-paper/40 px-4 py-8 text-center sm:py-10">
      <span className="mb-1 grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand">
        <Inbox className="h-5 w-5" aria-hidden />
      </span>
      <p className="font-semibold">{title}</p>
      {hint && <p className="max-w-sm text-sm leading-relaxed text-muted">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useT();
  return (
    <div role="alert" className="flex flex-col items-stretch gap-3 rounded-2xl border border-morich/25 bg-morich-soft/70 p-4 text-sm sm:flex-row sm:items-start">
      <AlertTriangle className="hidden h-5 w-5 shrink-0 text-morich sm:mt-0.5 sm:block" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-morich">{t('common.loadFailed')}</p>
        <p className="mt-0.5 text-ink/80">{errorMessage(error, t)}</p>
      </div>
      {onRetry && <Button size="sm" variant="ghost" className="min-h-10 self-start sm:self-auto" onClick={onRetry}>{t('common.retry')}</Button>}
    </div>
  );
}

/** Renders loading / error / data for a react-query result. */
export function Async<T>({ q, children, rows }: { q: UseQueryResult<T>; children: (d: T) => ReactNode; rows?: number }) {
  if (q.isLoading) return <Skeleton rows={rows} />;
  if (q.isError) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  if (q.data === undefined) return null;
  return <>{children(q.data)}</>;
}

/* ── Form controls ───────────────────────────────────────────────────────── */
const ctl = 'w-full rounded-xl border border-line bg-surface px-3 min-h-10 text-ink placeholder:text-muted/70 transition-[border-color,box-shadow] duration-150 focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-paper disabled:text-muted';
export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={clsx(ctl, className)} />;
export const Select = ({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={clsx(ctl, className)}>{children}</select>;
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} rows={p.rows ?? 3} className={clsx(ctl, 'py-2', className)} />;

export function Field({ label, error, hint, children, htmlFor, errorId, hintId }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor?: string; errorId?: string; hintId?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium">{label}</label>
      {children}
      {hint && !error && <p id={hintId} className="text-xs text-muted">{hint}</p>}
      {error && <p id={errorId} role="alert" className="auth-error text-xs text-morich">{error}</p>}
    </div>
  );
}
