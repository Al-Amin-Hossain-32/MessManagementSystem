export { z } from 'zod';

// ─── Pagination ───────────────────────────────────────────────────────────────

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function parsePagination(query: { page?: string; limit?: string }): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(query.limit ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));
  return { page, limit, skip: (page - 1) * limit };
}

export function buildPaginationMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
}

// ─── Date Utilities ───────────────────────────────────────────────────────────

export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

export function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

export function formatPeriodLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Default Mess operating timezone. The schema does not (yet) store a
 * per-Mess timezone — this is a known V1 simplification tracked for when
 * multi-timezone Mess support is needed. All Messes are assumed to operate
 * in this timezone for meal opt-out deadline purposes.
 */
export const DEFAULT_MESS_TIMEZONE = 'Asia/Dhaka';

/**
 * Returns the current wall-clock time as "HH:MM" in the given IANA timezone,
 * using the native Intl API (avoids pulling in a date library like luxon/dayjs
 * for a single comparison).
 */
export function currentTimeInZone(timezone: string, at: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(at); // "HH:MM"
}

/**
 * Checks whether the current time (in the given timezone) is at or past a
 * "HH:MM" deadline for the given calendar date. Used for meal opt-out
 * deadline enforcement (SRS §13: optOutDeadline is a same-day cutoff time).
 */
export function isPastDeadline(
  targetDate: Date,
  deadlineHHMM: string,
  timezone: string = DEFAULT_MESS_TIMEZONE,
  now: Date = new Date(),
): boolean {
  const [depHour, depMinute] = deadlineHHMM.split(':').map(Number);
  if (Number.isNaN(depHour) || Number.isNaN(depMinute)) {
    throw new Error(`Invalid deadline format: "${deadlineHHMM}", expected "HH:MM"`);
  }

  // Is "now" on a calendar day after targetDate (in the given timezone)? If so,
  // the deadline has unambiguously passed regardless of the HH:MM comparison.
  const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }); // YYYY-MM-DD
  const targetDateStr = dateFormatter.format(targetDate);
  const nowDateStr = dateFormatter.format(now);
  if (nowDateStr > targetDateStr) return true;
  if (nowDateStr < targetDateStr) return false;

  // Same calendar day — compare HH:MM.
  const nowHHMM = currentTimeInZone(timezone, now);
  const [nowHour, nowMinute] = nowHHMM.split(':').map(Number);
  return nowHour > depHour || (nowHour === depHour && nowMinute >= depMinute);
}

// ─── String Utilities ─────────────────────────────────────────────────────────

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// ─── Decimal / Financial Helpers ──────────────────────────────────────────────

/**
 * Round to 2 decimal places for financial calculations.
 * Avoids floating-point drift.
 */
export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Safe division — returns 0 if divisor is 0 to prevent NaN/Infinity.
 */
export function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}
