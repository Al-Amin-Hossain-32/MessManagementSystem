import { ApiError } from './api-client';

/** Backend error.code → i18n key. Unknown codes fall back to the backend's own message. */
const CODE_KEYS: Record<string, string> = {
  UNAUTHORIZED: 'err.UNAUTHORIZED',
  FORBIDDEN: 'err.FORBIDDEN',
  TENANT_ACCESS_DENIED: 'err.TENANT_ACCESS_DENIED',
  SELF_APPROVAL_DENIED: 'err.SELF_APPROVAL_DENIED',
  NOT_FOUND: 'err.NOT_FOUND',
  CONFLICT: 'err.CONFLICT',
  VALIDATION_ERROR: 'err.VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED: 'err.RATE_LIMIT_EXCEEDED',
  SUBSCRIPTION_LIMIT_EXCEEDED: 'err.SUBSCRIPTION_LIMIT_EXCEEDED',
  SUBSCRIPTION_FEATURE_NOT_AVAILABLE: 'err.SUBSCRIPTION_FEATURE_NOT_AVAILABLE',
  ACTIVE_MEMBERSHIP_CONFLICT: 'err.ACTIVE_MEMBERSHIP_CONFLICT',
  IMMUTABLE_RECORD: 'err.IMMUTABLE_RECORD',
  ACCOUNTING_PERIOD_CLOSED: 'err.ACCOUNTING_PERIOD_CLOSED',
  DUPLICATE_TRANSACTION: 'err.DUPLICATE_TRANSACTION',
  INTERNAL_SERVER_ERROR: 'err.INTERNAL_SERVER_ERROR',
};

export function errorMessage(e: unknown, t: (k: string) => string): string {
  if (e instanceof ApiError) {
    const k = CODE_KEYS[e.code];
    const local = k ? t(k) : '';
    // keep the backend message for codes we can't translate precisely (e.g. business-rule text)
    return local && local !== k ? (e.code === 'CONFLICT' || e.code === 'NOT_FOUND' || e.code === 'FORBIDDEN' ? `${local}: ${e.message}` : local) : e.message;
  }
  return e instanceof Error ? e.message : t('err.UNKNOWN');
}

/** Backend zod `details` ({ "field.path": ["msg"] }) → { field: "msg" } for inline field errors. */
export function fieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError) || !e.details) return {};
  return Object.fromEntries(Object.entries(e.details).map(([k, v]) => [k, v[0]]));
}
