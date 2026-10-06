'use client';
import { useState, type ChangeEventHandler, type InputHTMLAttributes, type ReactNode } from 'react';
import { Building2, Eye, EyeOff, Receipt, ShieldCheck, Utensils, Wallet } from 'lucide-react';
import { useT } from '@/i18n';
import { Field, Input } from './ui';

export function AuthBrandMark({ className = '' }: { className?: string }) {
  const { t } = useT();
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-brand-ink shadow-sm ring-1 ring-brand/10">
        <Building2 className="h-5 w-5" aria-hidden />
      </span>
      <span className="font-head text-lg font-bold tracking-tight text-ink">{t('brand.name')}</span>
    </div>
  );
}

export function AuthBrandPanel() {
  const { t } = useT();
  const features = [
    { icon: Utensils, title: t('nav.meals'), detail: t('auth.featureMeals') },
    { icon: Receipt, title: t('nav.expenses'), detail: t('auth.featureExpenses') },
    { icon: Wallet, title: t('nav.accounting'), detail: t('auth.featureAccounting') },
  ];

  return (
    <aside className="auth-brand-panel relative hidden min-h-[36rem] flex-col overflow-hidden rounded-2xl border border-brand/10 bg-brand p-8 text-brand-ink shadow-[0_12px_36px_rgb(14_90_72/0.13)] lg:flex lg:min-h-[42rem] lg:p-11">
      <div className="auth-orb auth-orb-one" aria-hidden />
      <div className="auth-orb auth-orb-two" aria-hidden />
      <AuthBrandMark className="relative z-10 [&>span]:bg-white/10 [&>span]:text-white [&>span]:ring-1 [&>span]:ring-white/15 [&>span]:shadow-none [&>span+span]:text-white" />

      <div className="relative z-10 my-auto max-w-lg py-12">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs font-medium text-white/80">
          <ShieldCheck className="h-4 w-4 text-emerald-200" aria-hidden />
          {t('auth.visualEyebrow')}
        </div>
        <h1 className="max-w-md font-head text-4xl font-bold leading-[1.2] tracking-tight lg:text-5xl">{t('auth.visualTitle')}</h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-white/70 lg:text-lg">{t('brand.tagline')}</p>

        <div className="mt-10 rounded-2xl border border-white/15 bg-white/[0.06] p-3">
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0b342c]/65 px-4 py-3">
            <div>
              <p className="text-xs text-white/55">{t('auth.previewLabel')}</p>
              <p className="mt-0.5 font-head font-semibold text-white">{t('auth.previewTitle')}</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-300/10 text-emerald-100">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {features.map(({ icon: Icon, title, detail }) => (
              <div key={title} className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
                <Icon className="mb-3 h-4 w-4 text-emerald-200" aria-hidden />
                <p className="text-xs font-semibold text-white/90">{title}</p>
                <p className="mt-0.5 text-[0.68rem] leading-snug text-white/50">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="relative z-10 text-xs text-white/45">{t('auth.visualFooter')}</p>
    </aside>
  );
}

interface AuthInputProps extends Pick<InputHTMLAttributes<HTMLInputElement>, 'autoComplete' | 'inputMode' | 'placeholder' | 'type'> {
  id: string;
  label: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  error?: string;
  hint?: string;
}

export function AuthInput({ id, label, value, onChange, error, hint, ...inputProps }: AuthInputProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={id} errorId={errorId} hintId={hintId}>
      <Input
        {...inputProps}
        id={id}
        value={value}
        onChange={onChange}
        aria-invalid={!!error || undefined}
        aria-describedby={errorId ?? hintId}
        className={`min-h-12 rounded-xl border-line/90 px-3.5 transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted/50 focus:bg-white focus:ring-4 focus:ring-brand/10 ${error ? 'border-morich/60 focus:border-morich focus:ring-morich/10' : 'hover:border-brand/35'}`}
      />
    </Field>
  );
}

interface AuthPasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  error?: string;
  hint?: string;
  autoComplete: string;
}

export function AuthPasswordField({ id, label, value, onChange, error, hint, autoComplete }: AuthPasswordFieldProps) {
  const { t } = useT();
  const [visible, setVisible] = useState(false);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <Field label={label} error={error} hint={hint} htmlFor={id} errorId={errorId} hintId={hintId}>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          aria-invalid={!!error || undefined}
          aria-describedby={errorId ?? hintId}
          className={`min-h-12 rounded-xl border-line/90 px-3.5 pr-14 transition-[border-color,box-shadow,background-color] duration-200 focus:bg-white focus:ring-4 focus:ring-brand/10 ${error ? 'border-morich/60 focus:border-morich focus:ring-morich/10' : 'hover:border-brand/35'}`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={t(visible ? 'auth.hidePassword' : 'auth.showPassword')}
          aria-pressed={visible}
          className="absolute inset-y-0 right-1 flex min-h-11 min-w-11 items-center justify-center self-center rounded-lg text-muted transition-colors hover:bg-brand-soft hover:text-brand focus-visible:outline-offset-[-2px]"
        >
          {visible ? <EyeOff className="h-[18px] w-[18px]" aria-hidden /> : <Eye className="h-[18px] w-[18px]" aria-hidden />}
        </button>
      </div>
    </Field>
  );
}

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <section className="auth-card-enter w-full rounded-2xl border border-line/80 bg-surface p-5 shadow-[0_10px_34px_rgb(29_43_38/0.07)] sm:p-8">
      {children}
    </section>
  );
}
