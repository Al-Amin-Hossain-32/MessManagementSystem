'use client';
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useT } from '@/i18n';
import { useSession } from '@/lib/session';
import * as E from '@/lib/endpoints';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { toAsciiDigits } from '@/lib/format';
import { Button } from '@/components/ui';
import { AuthCard, AuthInput, AuthPasswordField } from '@/components/auth-ui';

type Errors = Record<string, string>;
const step = (i: number) => ({ '--i': i }) as React.CSSProperties; // stagger order for .auth-rise

export default function RegisterPage() {
  const { t } = useT();
  const { login } = useSession();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [errs, setErrs] = useState<Errors>({});
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Mirrors apps/api auth.schema.ts (name 2-100, email, BD phone, password 8-72 + uppercase + digit).
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(2, t('val.nameMin')).max(100),
        email: z.string().email(t('val.email')),
        phone: z.string().regex(/^(\+?880|0)1[3-9]\d{8}$/, t('val.phone')).optional().or(z.literal('')),
        password: z.string().min(8, t('val.password8')).max(72)
          .regex(/[A-Z]/, t('val.passwordUpper')).regex(/[0-9]/, t('val.passwordDigit')),
      }),
    [t],
  );

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setF((v) => ({ ...v, [k]: e.target.value }));
    setErrs((c) => ({ ...c, [k]: '' }));
    setFormErr('');
  };

  // Feedback for a rejected submit (Web Animations API: retriggers cleanly, no remount, no focus loss).
  const shake = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    formRef.current?.animate(
      ['0', '-8px', '8px', '-5px', '5px', '0'].map((x) => ({ transform: `translateX(${x === '0' ? '0px' : x})` })),
      { duration: 400, easing: 'ease-in-out' },
    );
  };

  const fail = (fieldErrs: Errors, message = '') => {
    setErrs(fieldErrs);
    setFormErr(message);
    shake();
    const first = Object.keys(fieldErrs).find((k) => fieldErrs[k]);
    if (first) document.getElementById(first)?.focus();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    // Normalise first, then validate. Password is intentionally not trimmed.
    const v = {
      name: f.name.trim(),
      email: f.email.trim(),
      phone: toAsciiDigits(f.phone.trim()),
      password: f.password,
    };
    const r = schema.safeParse(v);
    if (!r.success) {
      const byField: Errors = {};
      for (const i of r.error.issues) { const k = String(i.path[0]); if (!(k in byField)) byField[k] = i.message; }
      return fail(byField);
    }
    setErrs({}); setFormErr(''); setBusy(true);
    try {
      await E.auth.register({ name: v.name, email: v.email, password: v.password, ...(v.phone ? { phone: v.phone } : {}) });
      await login(v.email, v.password); // (auth) layout then redirects home
    } catch (err) { fail(fieldErrors(err), errorMessage(err, t)); }
    finally { setBusy(false); }
  };

  return (
    <AuthCard>
      <div className="auth-rise mb-6" style={step(0)}>
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />{t('auth.secureWorkspace')}
        </span>
        <h1 className="font-head text-[1.8rem] font-bold leading-tight tracking-tight text-ink sm:text-3xl">{t('auth.registerTitle')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">{t('auth.registerDesc')}</p>
      </div>
      <form ref={formRef} onSubmit={submit} className="auth-form auth-rise space-y-4" style={step(1)} noValidate>
        <AuthInput id="name" label={t('auth.name')} autoComplete="name" placeholder={t('auth.namePlaceholder')} value={f.name} error={errs.name} onChange={set('name')} />
        <AuthInput id="email" type="email" label={t('auth.email')} placeholder={t('auth.emailPlaceholder')} autoComplete="email" inputMode="email" value={f.email} error={errs.email} onChange={set('email')} />
        <AuthInput id="phone" type="tel" label={t('auth.phone')} hint={t('auth.phoneHint')} placeholder="01XXXXXXXXX" autoComplete="tel" inputMode="tel" value={f.phone} error={errs.phone} onChange={set('phone')} />
        <AuthPasswordField id="password" label={t('auth.password')} hint={t('auth.passwordRule')} autoComplete="new-password" value={f.password} error={errs.password} onChange={set('password')} />
        {formErr && <p role="alert" aria-live="polite" className="auth-error auth-rise rounded-xl border border-morich/15 bg-morich-soft/80 px-3.5 py-3 text-sm text-morich">{formErr}</p>}
        <Button type="submit" busy={busy} className="auth-submit min-h-12 w-full text-[0.98rem] transition-transform duration-150 hover:-translate-y-px active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
          {busy ? t('auth.creatingAccount') : <>{t('auth.registerAction')}<ArrowRight className="h-4 w-4" aria-hidden /></>}
        </Button>
      </form>
      <p className="auth-rise mt-6 text-center text-sm text-muted" style={step(2)}>
        {t('auth.haveAccount')}{' '}
        <Link href="/login" className="font-semibold text-brand decoration-brand/40 underline-offset-4 transition-colors hover:text-brand/75 hover:underline">{t('auth.login')}</Link>
      </p>
    </AuthCard>
  );
}