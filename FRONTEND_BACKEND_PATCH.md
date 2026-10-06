# Backend patch accompanying `apps/web`

All edits are tagged `PATCH(frontend)` in the code. Without them, Boarders and Managers get `TENANT_ACCESS_DENIED`
on almost every mess route, because `resolveTenant` only recognised `MessMembership` rows (owner / co-admin).

## Fixes (behaviour that blocked the frontend)
| File | Change |
|---|---|
| `middleware/resolveTenant.ts` | Falls back to an ACTIVE/LEAVE_REQUESTED `BoarderMembership` or a PENDING_ACCEPTANCE/ACTIVE `ManagerAssignment`. Sets `isBoarder` / `isManagerParty`; **admin flags stay false**, so every `requireMessAdmin` / `requirePrimaryOwner` route is still closed to them. New guard `requireAdminOrManagerParty`. |
| `modules/mess/mess.routes.ts` + `mess.service.ts` | `POST /messes/:messId/co-admins/accept` (an invited Co-Admin could never become ACTIVE). |
| `modules/boarder/boarder.routes.ts` | `GET /members`: `requireMessAdmin` → `requireManagerOrAdmin` (Managers need the roster for guest meals and cash payments). |

## New read endpoints (discovery)
| Endpoint | Why |
|---|---|
| `GET /users/me/invitations` | Accept/decline routes need a `messId`; nothing told an invitee which. Returns boarder invites, co-admin invites, pending join requests, manager assignments awaiting acceptance. |
| `GET /messes/by-slug/:slug` | Lets a would-be boarder find a mess to `POST /members/join-requests`. Returns only id/name/slug/address/status; hides ARCHIVED. |
| `GET /notifications` and `GET /notifications/unread-count` | Lists the authenticated user's persisted in-app notifications and unread count. |
| `PATCH /notifications/:notificationId/read` and `PATCH /notifications/read-all` | Marks only the authenticated user's notifications as read. |

## Notifications
The authenticated notification center is available at `/notifications`, with a bell preview in the app header.
Boarder and Co-Admin invitations, manager assignments, join requests, member activations, active expense creation, and payment recording/submission/verification create
persisted, idempotent in-app notifications. Apply `apps/api/prisma/manual-sql/add_notification_module.sql` to existing databases before deploying the API.

## Access tightening (needed once boarders can reach `resolveTenant` routes)
| Route | Before → after |
|---|---|
| `GET /payments` | any member → Manager/Admin (boarders use `/payments/mine`) |
| `GET /payments/:id`, `GET /disputes/:id`, `GET /accounting/statements/:id` | any member → owner of the record, or staff (`assertSelfOrStaff`) |
| `GET /handovers`, `/handovers/:id` | any member → Admin or manager party |
| `GET /shop-orders`, `/shop-orders/:id` | any member → Manager/Admin |
| `GET /expenses/allocations/:periodId/summary` | any member → Manager/Admin |

Left as-is (API design, not changed): `GET /expenses`, `GET /expenses/:id`, `GET /guest-meals` remain visible to all members.

## Still missing in the backend (frontend shows "coming soon" or a workaround)
Billing/plan changes, audit-log read, director routes, granting PLATFORM_ADMIN, a route that moves a Mess from PENDING_SETUP to ACTIVE, user search (Platform screens ask for a raw user ID).

## Verification notes
The notification web type-check, web production build, and Prisma schema validation pass. API type-check/build remain blocked by compile errors in existing code outside the notification module; no diagnostics were reported for the notification routes/service or event integrations. Apply the notification SQL script before deployment, then manually verify notifications with invited users, mess admins/managers, and boarders.
