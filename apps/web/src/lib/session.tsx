'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { refreshAccessToken, setAccessToken, setAuthLostHandler } from './api-client';
import * as E from './endpoints';
import type { UserContext } from './types';

type Status = 'loading' | 'authed' | 'anon';
interface Session {
  status: Status; ctx: UserContext | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}
const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [ctx, setCtx] = useState<UserContext | null>(null);
  const qc = useQueryClient();
  const router = useRouter();

  const reload = useCallback(async () => { setCtx(await E.auth.context()); }, []);

  const drop = useCallback(() => {
    setAccessToken(null); setCtx(null); setStatus('anon'); qc.clear();
  }, [qc]);

  useEffect(() => {
    setAuthLostHandler(() => { drop(); router.replace('/login'); });
    (async () => {
      const t = await refreshAccessToken(); // uses the HttpOnly refresh cookie
      if (!t) return setStatus('anon');
      try { await reload(); setStatus('authed'); } catch { setStatus('anon'); }
    })();
    return () => setAuthLostHandler(null);
  }, [drop, reload, router]);

  const login = useCallback(async (email: string, password: string) => {
    await E.auth.login({ email, password });
    await reload();
    setStatus('authed');
  }, [reload]);

  const logout = useCallback(async () => {
    try { await E.auth.logout(); } catch { /* already logged out */ }
    drop(); router.replace('/login');
  }, [drop, router]);

  const value = useMemo(() => ({ status, ctx, login, logout, reload }), [status, ctx, login, logout, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSession must be used inside <SessionProvider>');
  return c;
}
