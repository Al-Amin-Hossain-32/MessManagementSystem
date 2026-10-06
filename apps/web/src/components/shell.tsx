'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import clsx from 'clsx';
import { Building2, ChevronDown, Home as HomeIcon, LayoutGrid, LogOut, Menu, ShieldCheck, Store } from 'lucide-react';
import { useT } from '@/i18n';
import { useSession } from '@/lib/session';
import { MESS_FEATURES } from '@/lib/features';
import type { MessAccess } from '@/lib/access';
import { LangToggle } from './lang-toggle';
import { Modal } from './dialogs';
import { Chip } from './ui';
import { NotificationBell } from './notification-bell';
import * as E from '@/lib/endpoints';
import { useQ } from '@/lib/hooks';

export function TopBar() {
  const { t } = useT();
  const { ctx, logout } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const messes = new Map<string, string>();
  ctx?.messMemberships.forEach((m) => messes.set(m.messId, m.messName));
  ctx?.boarderOf.forEach((m) => messes.set(m.messId, m.messName));
  ctx?.activeManagerAssignments.forEach((m) => messes.set(m.messId, m.messName));
  ctx?.activeDirectorships.forEach((m) => messes.set(m.messId, m.messName));
  const current = pathname.startsWith('/mess/') ? `/mess/${pathname.split('/')[2]}` : pathname.startsWith('/shops') ? '/shops' : pathname.startsWith('/shop/') ? `/shop/${pathname.split('/')[2]}` : pathname.startsWith('/platform') ? '/platform' : '/dashboard';
  const initials = ctx?.name.trim().charAt(0) || '?';

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-surface/95 shadow-[0_2px_16px_rgb(29_43_38/0.035)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[90rem] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="group flex shrink-0 items-center gap-2.5 rounded-ctl pr-1">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-ink shadow-sm transition-transform group-hover:scale-105">
            <Building2 className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span className="hidden font-head text-lg font-bold tracking-tight text-ink sm:inline">{t('brand.short')}</span>
        </Link>
        <span className="hidden h-8 w-px bg-line sm:block" aria-hidden />
        <label className="relative flex min-w-0 flex-1 items-center sm:flex-none">
          <span className="sr-only">{t('nav.workspace')}</span>
          <LayoutGrid className="pointer-events-none absolute left-3 h-4 w-4 text-brand" aria-hidden />
          <select aria-label={t('nav.workspace')} value={current} onChange={(e) => router.push(e.target.value)}
            className="min-h-10 w-full min-w-0 appearance-none rounded-xl border border-line/80 bg-paper/70 py-2 pl-9 pr-9 text-sm font-medium text-ink transition-colors hover:border-brand/40 focus:border-brand focus:bg-surface sm:w-auto sm:min-w-44 sm:max-w-[22rem]">
          <option value="/dashboard">{t('nav.home')}</option>
          <option value="/shops">{t('shop.browse')}</option>
          {messes.size > 0 && <optgroup label={t('nav.messes')}>{Array.from(messes, ([id, name]) => <option key={id} value={`/mess/${id}`}>{name}</option>)}</optgroup>}
          {(ctx?.shopsManaged.length ?? 0) > 0 && <optgroup label={t('nav.shops')}>{ctx!.shopsManaged.map((s) => <option key={s.shopId} value={`/shop/${s.shopId}`}>{s.shopName}</option>)}</optgroup>}
          {ctx?.isPlatformAdmin && <option value="/platform">{t('nav.platform')}</option>}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-muted" aria-hidden />
        </label>
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <LangToggle />
          <NotificationBell />
          <span className="hidden h-8 w-px bg-line sm:block" aria-hidden />
          <div className="hidden min-w-0 items-center gap-2 sm:flex">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft font-head font-bold text-brand" aria-hidden>{initials}</span>
            <span className="max-w-32 truncate text-sm font-medium text-ink">{ctx?.name}</span>
          </div>
          <button onClick={logout} aria-label={t('auth.logout')} title={t('auth.logout')} className="grid h-9 w-9 place-items-center rounded-xl text-muted transition-colors hover:bg-morich-soft hover:text-morich focus-visible:outline-offset-2"><LogOut className="h-[18px] w-[18px]" /></button>
        </div>
      </div>
    </header>
  );
}

const GROUPS = ['main', 'money', 'people', 'more'] as const;

export function MessNav({ messId, access }: { messId: string; access: MessAccess }) {
  const { t } = useT();
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const base = `/mess/${messId}`;
  const items = MESS_FEATURES.filter((f) => f.show(access));
  const chatUnread = useQ(['chat-unread', messId], async () => (await E.chat.unreadCount(messId)).count, items.some((f) => f.id === 'chat'));
  const active = (path: string) => (path === '' ? pathname === base : pathname.startsWith(`${base}/${path}`));

  const Item = ({ f, onClick }: { f: (typeof items)[number]; onClick?: () => void }) => (
    <Link href={`${base}/${f.path}`.replace(/\/$/, '')} onClick={onClick} aria-current={active(f.path) ? 'page' : undefined}
      className={clsx('group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] transition-colors',
        active(f.path) ? 'relative bg-brand-soft font-semibold text-brand before:absolute before:inset-y-2.5 before:left-1.5 before:w-[3px] before:rounded-full before:bg-brand' : 'text-ink hover:bg-paper hover:text-brand')}>
      <f.icon className={clsx('h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-105', active(f.path) && 'text-brand')} aria-hidden />
      <span className="flex-1">{t(f.labelKey)}</span>
      {f.id === 'chat' && (chatUnread.data ?? 0) > 0 && (
        <span aria-label={t('chat.unreadCount', { count: chatUnread.data! })} className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-morich px-1.5 text-[0.68rem] font-bold leading-none text-white">
          {chatUnread.data! > 99 ? '99+' : chatUnread.data}
        </span>
      )}
      {f.status === 'planned' && <span className="rounded-full bg-holud-soft px-2 text-[0.7rem] text-[#7a5600]">{t('common.soon')}</span>}
    </Link>
  );

  const primary = items.filter((f) => f.primary);
  return (
    <>
      <nav aria-label="Mess" className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border border-line/80 bg-surface/80 p-3 shadow-[0_4px_20px_rgb(29_43_38/0.035)]">
          <div className="mb-4 rounded-xl bg-brand-soft/70 px-3 py-3">
            <p className="break-words font-head text-lg font-bold leading-snug text-ink">{access.messName}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {access.isOwner ? <Chip>{t('st.PRIMARY_OWNER')}</Chip> : access.isAdmin && <Chip>{t('st.CO_ADMIN')}</Chip>}
              {access.isManager && <Chip>{t('role.manager')}</Chip>}
              {access.isBoarder && <Chip>{t('role.boarder')}</Chip>}
              {access.isDirector && <Chip>{t('role.director')}</Chip>}
            </div>
          </div>
          {GROUPS.map((g) => {
            const list = items.filter((f) => f.group === g);
            return list.length ? (
              <div key={g} className="mb-4 last:mb-0">
                <p className="mb-1.5 px-3 text-[0.68rem] font-bold uppercase tracking-[0.13em] text-muted">{t(`nav.group.${g}`)}</p>
                <div className="space-y-0.5">{list.map((f) => <Item key={f.id} f={f} />)}</div>
              </div>
            ) : null;
          })}
        </div>
      </nav>

      <nav aria-label="Mess" className="fixed inset-x-0 bottom-0 z-40 grid grid-flow-col auto-cols-fr border-t border-line/80 bg-surface/95 px-1 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.35rem)] shadow-[0_-6px_24px_rgb(29_43_38/0.07)] backdrop-blur-xl lg:hidden">
        {primary.map((f) => (
          <Link key={f.id} href={`${base}/${f.path}`.replace(/\/$/, '')} aria-current={active(f.path) ? 'page' : undefined}
            className={clsx('relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[0.68rem] font-medium transition-colors',
              active(f.path) ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-paper hover:text-ink')}>
            <span className="relative">
              <f.icon className="h-[19px] w-[19px]" aria-hidden />
              {f.id === 'chat' && (chatUnread.data ?? 0) > 0 && (
                <span aria-label={t('chat.unreadCount', { count: chatUnread.data! })} className="absolute -right-3 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-surface bg-morich px-1 text-[0.58rem] font-bold leading-none text-white">
                  {chatUnread.data! > 99 ? '99+' : chatUnread.data}
                </span>
              )}
            </span>
            <span className="max-w-full truncate">{t(f.labelKey)}</span>
          </Link>
        ))}
        <button onClick={() => setMore(true)} aria-expanded={more} aria-haspopup="dialog" className="flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[0.68rem] font-medium text-muted transition-colors hover:bg-paper hover:text-ink"><Menu className="h-[19px] w-[19px]" aria-hidden /><span>{t('common.more')}</span></button>
      </nav>
      <Modal open={more} onClose={() => setMore(false)} title={access.messName}>
        <div className="space-y-4">{GROUPS.map((g) => {
          const list = items.filter((f) => f.group === g);
          return list.length ? <div key={g}><p className="mb-1.5 px-3 text-xs font-bold uppercase tracking-wider text-muted">{t(`nav.group.${g}`)}</p><div className="space-y-0.5">{list.map((f) => <Item key={f.id} f={f} onClick={() => setMore(false)} />)}</div></div> : null;
        })}</div>
      </Modal>
    </>
  );
}

export const WorkspaceIcon = { home: HomeIcon, platform: ShieldCheck, shop: Store };
