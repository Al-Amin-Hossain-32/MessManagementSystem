'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';
import { LangToggle } from '@/components/lang-toggle';
import { Spinner } from '@/components/ui';
import { useT } from '@/i18n';
import { AuthBrandMark, AuthBrandPanel } from '@/components/auth-ui';

// Auth-only motion. Pure CSS: no new dependency, transform/opacity only, respects reduced motion.
const AUTH_MOTION_CSS = `
@keyframes auth-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes auth-fade{from{opacity:0}to{opacity:1}}
.auth-rise{animation:auth-rise .5s cubic-bezier(.22,1,.36,1) both;animation-delay:calc(var(--i,0) * 70ms)}
.auth-fade{animation:auth-fade .3s ease both}
@media (prefers-reduced-motion:reduce){.auth-rise,.auth-fade{animation:none}}
`;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const { t } = useT();

  // Single source of truth for "already signed in -> dashboard". Pages must not redirect themselves.
  useEffect(() => { if (status === 'authed') router.replace('/dashboard'); }, [status, router]);

  const pending = status === 'loading' || status === 'authed';

  return (
    <main className="auth-background relative min-h-dvh overflow-x-hidden">
      <style dangerouslySetInnerHTML={{ __html: AUTH_MOTION_CSS }} />
      <div className="auth-orb auth-orb-mobile" aria-hidden />
      <div className="relative mx-auto grid min-h-dvh w-full max-w-[90rem] grid-cols-1 px-4 py-4 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:gap-14 lg:px-12 lg:py-10 xl:px-16">
        <header className="relative z-20 flex items-center justify-between gap-3 lg:absolute lg:right-12 lg:top-8 xl:right-16">
          <AuthBrandMark className="lg:hidden" />
          <LangToggle />
        </header>
        <AuthBrandPanel />
        <section className="relative z-10 flex w-full flex-1 items-start justify-center pt-6 sm:pt-9 lg:min-h-dvh lg:items-center lg:pt-12">
          <div className="w-full max-w-[28rem]">
            {pending ? (
              <div className="auth-fade flex min-h-[55dvh] items-center justify-center" role="status" aria-label={t('common.loading')}>
                <Spinner />
              </div>
            ) : (
              <div className="auth-fade">{children}</div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}