'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { ZodTypeAny } from 'zod';
import { useT } from '@/i18n';
import { Button, Field, Input, Select, Textarea } from './ui';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { ApiError } from '@/lib/api-client';
import { toAsciiDigits } from '@/lib/format';

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title}
        className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:rounded-card ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="close" className="rounded-ctl p-1 text-muted hover:bg-brand-soft"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export interface FieldDef {
  name: string; label: string; type?: 'text' | 'email' | 'tel' | 'password' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox' | 'multi';
  options?: { value: string; label: string }[]; required?: boolean; hint?: string; placeholder?: string; step?: string; min?: string;
}
type Values = Record<string, string | boolean | string[]>;

/** Config-driven form in a dialog. Validation: optional zod schema (mirrors the backend) + backend field errors. */
export function FormDialog({ open, onClose, title, desc, fields, initial, submitLabel, onSubmit, schema, danger, wide }: {
  open: boolean; onClose: () => void; title: string; desc?: string; fields: FieldDef[]; initial?: Values; submitLabel?: string;
  onSubmit: (payload: Record<string, any>) => Promise<unknown>; schema?: ZodTypeAny; danger?: boolean; wide?: boolean;
}) {
  const { t } = useT();
  const [v, setV] = useState<Values>({});
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState('');

  useEffect(() => {
    if (open) { setFormErr(''); setV({ ...Object.fromEntries(fields.map((f) => [f.name, f.type === 'checkbox' ? false : f.type === 'multi' ? [] : ''])), ...initial }); setErrs({}); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, any> = {};
    const local: Record<string, string> = {};
    for (const f of fields) {
      let val = v[f.name];
      if (f.type === 'checkbox') { payload[f.name] = !!val; continue; }
      if (f.type === 'multi') {
        const arr = (val as string[]) ?? [];
        if (arr.length) payload[f.name] = arr; else if (f.required) local[f.name] = t('common.required');
        continue;
      }
      let s = String(val ?? '').trim();
      if (f.type === 'number' || f.type === 'date' || f.type === 'tel') s = toAsciiDigits(s);
      if (!s) { if (f.required) local[f.name] = t('common.required'); continue; }
      if (f.type === 'number') { const n = Number(s); if (Number.isNaN(n)) { local[f.name] = t('common.invalidNumber'); continue; } payload[f.name] = n; }
      else payload[f.name] = s;
    }
    if (!Object.keys(local).length && schema) {
      const r = schema.safeParse(payload);
      if (!r.success) for (const i of r.error.issues) local[String(i.path[0] ?? '_')] ??= i.message;
    }
    setErrs(local); setFormErr('');
    if (Object.keys(local).length) return;
    setBusy(true);
    try { await onSubmit(payload); onClose(); }
    // ApiErrors are already toasted by useAct; anything else (local checks) is shown inline.
    catch (err) { setErrs(fieldErrors(err)); setFormErr(err instanceof ApiError ? '' : errorMessage(err, t)); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} wide={wide}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {desc && <p className="text-sm text-muted">{desc}</p>}
        {fields.map((f) => {
          const id = `f-${f.name}`;
          const common = { id, name: f.name, 'aria-invalid': !!errs[f.name] || undefined };
          return (
            <Field key={f.name} label={f.label + (f.required ? ' *' : '')} error={errs[f.name]} hint={f.hint} htmlFor={id}>
              {f.type === 'select' ? (
                <Select {...common} value={String(v[f.name] ?? '')} onChange={(e) => setV({ ...v, [f.name]: e.target.value })}>
                  {!f.required && <option value="">—</option>}
                  {f.required && !v[f.name] && <option value="">{t('common.choose')}</option>}
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              ) : f.type === 'textarea' ? (
                <Textarea {...common} value={String(v[f.name] ?? '')} placeholder={f.placeholder} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />
              ) : f.type === 'multi' ? (
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-ctl border border-line p-2">
                  {f.options?.map((o) => {
                    const cur = (v[f.name] as string[]) ?? [];
                    return (
                      <label key={o.value} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" checked={cur.includes(o.value)}
                          onChange={(e) => setV({ ...v, [f.name]: e.target.checked ? [...cur, o.value] : cur.filter((x) => x !== o.value) })} />{o.label}
                      </label>
                    );
                  })}
                </div>
              ) : f.type === 'checkbox' ? (
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" checked={!!v[f.name]} onChange={(e) => setV({ ...v, [f.name]: e.target.checked })} />{f.hint ?? f.label}</label>
              ) : (
                <Input {...common} type={f.type === 'number' ? 'text' : f.type ?? 'text'} inputMode={f.type === 'number' ? 'decimal' : undefined}
                  autoComplete={f.type === 'password' ? 'current-password' : undefined}
                  placeholder={f.placeholder} value={String(v[f.name] ?? '')} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />
              )}
            </Field>
          );
        })}
        {formErr && <p role="alert" className="rounded-ctl bg-morich-soft px-3 py-2 text-sm text-morich">{formErr}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant={danger ? 'danger' : 'primary'} busy={busy}>{submitLabel ?? t('common.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}

/** Confirmation with an optional reason (most destructive backend routes require one). */
export function ConfirmDialog({ open, onClose, title, desc, reasonLabel, reasonRequired = true, confirmLabel, danger, onConfirm }: {
  open: boolean; onClose: () => void; title: string; desc?: string; reasonLabel?: string; reasonRequired?: boolean;
  confirmLabel?: string; danger?: boolean; onConfirm: (reason: string) => Promise<unknown>;
}) {
  const { t } = useT();
  return (
    <FormDialog open={open} onClose={onClose} title={title} desc={desc} danger={danger} submitLabel={confirmLabel ?? t('common.confirm')}
      fields={reasonLabel ? [{ name: 'reason', label: reasonLabel, type: 'textarea', required: reasonRequired }] : []}
      onSubmit={(p) => onConfirm(p.reason ?? '')} />
  );
}
