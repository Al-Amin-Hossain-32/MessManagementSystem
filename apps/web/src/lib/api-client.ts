/**
 * Single HTTP entry point. Access token lives in memory only; the refresh token
 * is an HttpOnly cookie handled by the browser + backend (/auth/refresh).
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, string[]>,
  ) { super(message); }
}

let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;
let onAuthLost: (() => void) | null = null;

export const setAccessToken = (t: string | null) => { accessToken = t; };
export const getAccessToken = () => accessToken;
export const setAuthLostHandler = (fn: (() => void) | null) => { onAuthLost = fn; };

async function raw(method: string, path: string, opts: { body?: unknown; query?: Record<string, unknown>; auth?: boolean }) {
  const qs = opts.query
    ? '?' + new URLSearchParams(Object.entries(opts.query).filter(([, v]) => v !== undefined && v !== '' && v !== null).map(([k, v]) => [k, String(v)])).toString()
    : '';
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(`${API_BASE}${path}${qs === '?' ? '' : qs}`, {
    method, headers, credentials: 'include',
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

/** Single-flight refresh: many parallel 401s trigger exactly one /auth/refresh. */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = raw('POST', '/auth/refresh', { auth: false })
      .then(async (r) => {
        if (!r.ok) return null;
        const j = await r.json();
        accessToken = j.data.tokens.accessToken as string;
        return accessToken;
      })
      .catch(() => null)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function request<T = unknown>(
  method: string, path: string, opts: { body?: unknown; query?: Record<string, unknown>; auth?: boolean } = {},
): Promise<T> {
  let res = await raw(method, path, opts);
  if (res.status === 401 && opts.auth !== false && !path.startsWith('/auth/')) {
    const t = await refreshAccessToken();
    if (t) res = await raw(method, path, opts);
    else { accessToken = null; onAuthLost?.(); }
  }
  if (res.status === 204) return undefined as T;
  let json: any = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok || json?.success === false) {
    const e = json?.error;
    throw new ApiError(res.status, e?.code ?? 'UNKNOWN', e?.message ?? res.statusText, e?.details);
  }
  return json?.data as T;
}

export const api = {
  get: <T>(p: string, query?: Record<string, unknown>) => request<T>('GET', p, { query }),
  post: <T>(p: string, body?: unknown) => request<T>('POST', p, { body }),
  put: <T>(p: string, body?: unknown) => request<T>('PUT', p, { body }),
  patch: <T>(p: string, body?: unknown) => request<T>('PATCH', p, { body }),
  delete: <T>(p: string, body?: unknown) => request<T>('DELETE', p, { body }),
};
