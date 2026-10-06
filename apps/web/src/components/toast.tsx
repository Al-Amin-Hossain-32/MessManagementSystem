'use client';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import clsx from 'clsx';

type Tone = 'ok' | 'err';
const Ctx = createContext<(msg: string, tone?: Tone) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; tone: Tone }[]>([]);
  const push = useCallback((msg: string, tone: Tone = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, msg, tone }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), tone === 'err' ? 6000 : 3500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} role="status" className={clsx('max-w-md rounded-ctl px-4 py-2.5 text-sm shadow-lg',
            i.tone === 'ok' ? 'bg-brand text-brand-ink' : 'bg-morich text-white')}>{i.msg}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
