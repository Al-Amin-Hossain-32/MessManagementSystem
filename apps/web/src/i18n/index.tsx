'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en } from './en';
import { bn } from './bn';

export type Lang = 'bn' | 'en';
const DICTS: Record<Lang, Record<string, string>> = { en, bn };
const KEY = 'mm.lang';

interface I18n { lang: Lang; setLang: (l: Lang) => void; t: (key: string, params?: Record<string, string | number>) => string }
const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('bn'); // Bangla-first

  useEffect(() => {
    try { const s = localStorage.getItem(KEY); if (s === 'en' || s === 'bn') setLangState(s); } catch { /* ignore */ }
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    let s = DICTS[lang][key] ?? DICTS.en[key] ?? key; // bn → en → key
    if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useT must be used inside <I18nProvider>');
  return c;
}
