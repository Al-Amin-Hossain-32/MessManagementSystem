# Mess Management — Web (`apps/web`)

Next.js 14 (App Router) + TypeScript + Tailwind + TanStack Query. **Bangla-first UI with English** (toggle in the top bar).

## Run

```bash
# from the monorepo root
npm install
cp apps/web/.env.example apps/web/.env.local      # API_ORIGIN=http://localhost:4000
npm run dev                                        # turbo starts api (4000) + web (3000)
```

The browser only calls `/api/v1/*` on the web origin; `next.config.mjs` proxies it to the API, so the HttpOnly
refresh-token cookie (`path=/api/v1/auth`) works with no CORS/SameSite tuning.

## Architecture

| Layer | Where | Notes |
|---|---|---|
| HTTP | `src/lib/api-client.ts` | access token in memory only, single-flight `/auth/refresh` on 401, `{success,data,error}` envelope → `ApiError` |
| Endpoints | `src/lib/endpoints.ts` | one typed function per real API route. Nothing invented. |
| Session / roles | `src/lib/session.tsx`, `access.ts` | roles come from `GET /users/me/context`; `useMessAccess(messId)` → `isOwner/isAdmin/isManager/isBoarder` (UI hints only — the API is the authority) |
| Feature registry | `src/lib/features.ts` | **the only list of Mess modules.** Sidebar, mobile bar and gating derive from it. `status: 'planned'` → generic "coming soon" page |
| i18n | `src/i18n/{bn,en}.ts` | flat keys; enums share one `st.<VALUE>` label set; backend `error.code` → localized message (`src/lib/errors.ts`) |
| UI kit | `src/components/{ui,table,dialogs}.tsx` | `DataTable` (table ≥md / cards on mobile), config-driven `FormDialog`, `ConfirmDialog` (reason), `StatusBadge`, `Money`, `Async` |
| Pages | `src/app/(app)/mess/[messId]/*` | one folder per module |

### Adding a backend module later
1. Add its calls to `src/lib/endpoints.ts` (+ types in `types.ts`).
2. Add `src/app/(app)/mess/[messId]/<module>/page.tsx`.
3. Add / flip its entry in `src/lib/features.ts` (`status: 'live'`). Add strings to `bn.ts`/`en.ts`.

Nothing else changes. Planned today (no backend routes): notifications, billing, audit log, directors.

## Behaviours worth knowing
- Money arrives as Decimal strings; shown with `Intl` in the active language (`৳১,২৫০.০০`). Bangla digits typed into number/date/phone fields are converted to ASCII before sending.
- Dates/deadlines are displayed in `Asia/Dhaka`; date-times sent to the API are UTC ISO (the API's `datetime()` rejects offsets).
- Lists are unpaginated because the API returns plain arrays.
- Expenses/guest meals are visible to every member (as the API allows); per-boarder totals, all-payments and shop orders are staff-only after the backend patch.
