import type { Lang } from '@/i18n';

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
export const toBnDigits = (s: string) => s.replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
/** Bangla digits typed by the user → ASCII, so the backend always receives valid numbers/dates. */
export const toAsciiDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));

const loc = (lang: Lang) => (lang === 'bn' ? 'bn-BD' : 'en-BD');
const TZ = 'Asia/Dhaka';

export const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export function fmtNumber(v: unknown, lang: Lang, max = 2) {
  return new Intl.NumberFormat(loc(lang), { maximumFractionDigits: max }).format(num(v));
}
export function fmtMoney(v: unknown, lang: Lang) {
  return '৳' + new Intl.NumberFormat(loc(lang), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num(v));
}
export function fmtDate(v: string | Date | null | undefined, lang: Lang, withTime = false) {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(loc(lang), {
    timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(d);
}
/** Today's calendar date in Asia/Dhaka as YYYY-MM-DD (what the meal endpoints expect). */
export const todayStr = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
/** date input (YYYY-MM-DD) → ISO datetime the manager endpoints require. */
// Backend `z.string().datetime()` accepts only UTC ('Z'), so convert the Dhaka wall-clock day bounds.
export const dayStartIso = (d: string) => new Date(`${d}T00:00:00.000+06:00`).toISOString();
export const dayEndIso = (d: string) => new Date(`${d}T23:59:59.999+06:00`).toISOString();
export const shortId = (id?: string) => (id ? id.slice(-6) : '—');
