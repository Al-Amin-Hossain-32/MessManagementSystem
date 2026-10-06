'use client';
import { useT } from '@/i18n';

export function LangToggle() {
  const { lang, setLang } = useT();
  return (
    <div role="group" aria-label="Language" className="inline-flex overflow-hidden rounded-ctl border border-line text-sm">
      {(['bn', 'en'] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
          className={`px-2.5 py-1 font-medium ${lang === l ? 'bg-brand text-brand-ink' : 'bg-surface text-muted hover:bg-brand-soft'}`}>
          {l === 'bn' ? 'বাং' : 'EN'}
        </button>
      ))}
    </div>
  );
}
