# Production readiness runbook

This repository is not cleared for real financial or personal data until every
launch gate below has been completed and signed off. A successful build alone
does not establish operational, legal, or financial correctness.

## Free staging deployment (Vercel + Render + Neon)

`render.yaml` defines only a free Render API web service. It deliberately does
not create or attach any database, does not contain secrets, and has
`autoDeploy: false`. The configured database must be a newly provisioned,
staging-only Neon project; never enter a production connection string.
Render's free service can sleep and has ephemeral storage, so this setup is
strictly for staging/demo, not real financial or user data.

1. Create a **new Neon project named for staging**, separate from any
   production project. This app uses Prisma 5 and a long-running Node API:
   use Neon's direct (non-pooled) PostgreSQL connection string with
   `sslmode=require` for both the staging migration and Render's single API
   instance. Copy it from Neon Console's **Connect** dialog. On Free, Neon
   currently lists 1 GB storage per project, 100 CU-hours/project and
   scale-to-zero after 5 minutes; this makes it suitable for synthetic staging
   data only. If you later
   switch the runtime to a pooled `-pooler` URL, verify it against Prisma 5's
   PgBouncer compatibility requirements first; do not assume the newer Prisma
   7 Neon adapter instructions apply to this repository. Do not use a
   production project's URI or paste connection secrets into Git, chat, or
   terminal history.
2. Before creating the Render service, run
   `npm run db:migrate:deploy --workspace=@messmess/api` from a trusted
   environment with `DATABASE_URL` temporarily set to the new, empty
   **staging-only** database. Keep the URL out of command-line arguments,
   checked-in files, and logs. Do not run `migrate resolve` on the empty DB.
   Never load or reuse `apps/api/.env` for this operation.
3. In Render, create a Blueprint from the `staging` branch using `render.yaml`.
   Select Free and enter the same staging-only `DATABASE_URL` plus the
   requested secret/origin values. Auto-deploy is disabled; review the
   Blueprint before manually creating/deploying the service. The readiness
   endpoint remains unhealthy unless the expected schema migration is present.
4. Generate two independent JWT secrets locally (`node -e
"console.log(require('crypto').randomBytes(48).toString('hex'))"`) and enter
   them directly in Render's secret fields; do not share them in chat. Set
   `API_URL` to the resulting Render HTTPS service URL. Leave
   `PLATFORM_ADMIN_BOOTSTRAP_EMAILS` unset/empty until intentionally
   bootstrapping the staging admin.
5. Import the repository as a separate Vercel project. Set Root Directory to
   `apps/web`, framework to Next.js, and enable building with files outside
   the root directory because the app depends on workspace packages. Set
   `API_ORIGIN` and `NEXT_PUBLIC_SOCKET_URL` to the Render staging API origin
   in **Preview** environment only; do not change Vercel Production variables.
   Deploy a dedicated staging branch/preview, not the production branch.
6. Copy the resulting Vercel preview origin (scheme + hostname only) into
   Render's `WEB_URL` and `CORS_ORIGINS`; save, then deploy/restart the API.
   In Render, set `COOKIE_SECURE=true` and confirm `NODE_ENV=production`.
   Keep these origins specific; do not add `*` or localhost.
7. Verify `/api/v1/health` and `/api/v1/ready`, then test login/refresh/logout,
   tenant access, synthetic payments/expenses, accounting totals, and chat
   Socket.IO. Use only fake users and synthetic money. Do not import real
   personal or financial records.

Vercel/Render dashboard access and the Neon staging connection string are
required to finish resource creation. Do not send secrets through this
repository or chat. The staging database migration is an explicit operator
step so the production database cannot be selected accidentally.

## Repository checks

CI runs from a clean install and checks Prisma Client generation, API/web
type-checking, API unit tests, and production builds on Node.js 24. Run locally
with:

```sh
npm ci
npm run db:generate --workspace=@messmess/api
npm run type-check --workspace=@messmess/api
npm run type-check --workspace=@messmess/web
npm test --workspace=@messmess/api
npm run build --workspace=@messmess/api
API_ORIGIN=https://api.example.com \
NEXT_PUBLIC_SOCKET_URL=https://api.example.com \
npm run build --workspace=@messmess/web
```

On PowerShell, set the build variables first:

```powershell
$env:API_ORIGIN = 'https://api.example.com'
$env:NEXT_PUBLIC_SOCKET_URL = 'https://api.example.com'
npm run build --workspace=@messmess/web
```

Never commit `.env` files or put credentials in CI logs. Production API startup
rejects insecure cookies, localhost URLs/origins, placeholder JWT secrets, or
identical access and refresh secrets. Production web builds reject localhost
API and Socket.IO origins.

## Database deployment

`apps/api/prisma/migrations` contains the initial migration generated from the
current Prisma schema. Review the SQL before using it.

### New database

1. Provision managed PostgreSQL with TLS, automated backups, point-in-time
   recovery if available, and a least-privilege application role.
2. Set the production `DATABASE_URL` only in the deployment secret manager.
3. Back up before schema changes and apply migrations as a one-off release
   step, not independently from every running API instance:

   ```sh
   npm run db:migrate:deploy --workspace=@messmess/api
   ```

4. Deploy the API only after the migration succeeds. Run the smoke checks below.

### Existing database

Do not run the initial migration against an existing database. First take and
verify a restorable backup. Compare the live schema with the checked-in Prisma
schema and inspect the generated SQL. With the API workspace as the current
directory:

```sh
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

Only if the live schema is verified to match the initial migration exactly,
and `npx prisma migrate status` confirms this migration is not already
recorded, baseline it once. `migrate resolve` records history; it does not
apply or reconcile schema changes:

```sh
npx prisma migrate resolve --applied 20261006190000_initial
```

In PowerShell, reference the connection string as
`$env:DATABASE_URL` rather than `$DATABASE_URL`.

If there is drift, do not mark the migration applied and do not guess at SQL.
Reconcile the live schema with a reviewed, forward-only migration first. The
scripts in `apps/api/prisma/manual-sql/` are historical/manual changes; verify
their effects against the current schema and data before deciding whether an
existing installation needs them.

## Hosting and environment

Use persistent Node.js hosting for both applications and a managed PostgreSQL
service. The API must support long-lived WebSocket/Socket.IO connections for
chat. Configure the platform's health probes as:

- Liveness: `GET /api/v1/health`
- Readiness (checks PostgreSQL): `GET /api/v1/ready`

Set these API values in the secret/environment manager:

- `NODE_ENV=production`
- `PORT` to the platform-assigned port
- public HTTPS `API_URL` and `WEB_URL`
- TLS-enabled `DATABASE_URL`
- two independently generated JWT secrets of at least 32 characters
- `COOKIE_SECURE=true`
- `CORS_ORIGINS` to the exact HTTPS frontend origin(s), comma-separated
- `PLATFORM_ADMIN_BOOTSTRAP_EMAILS` only during first-admin bootstrap; clear
  it immediately after the intended account has registered

Build the web app with `API_ORIGIN` and `NEXT_PUBLIC_SOCKET_URL` set to the
public HTTPS API origin. The web app proxies HTTP API calls; Socket.IO connects
directly to the API. Do not use localhost values in production.

Start with one API instance: the current Express rate limiter uses in-memory
state, which is not shared across replicas. Before horizontal scaling, use a
shared rate-limit store and validate proxy/IP configuration. Redis is currently
not required by the implemented API paths; do not provision it solely because
`REDIS_URL` exists in the environment template.

Free tiers may sleep, cap database/storage, remove backups, or restrict
WebSockets. Treat them as staging/demo only unless the provider explicitly
meets the service's backup, recovery, availability, security, and data
processing requirements.

## Mandatory pre-launch gates

- Restore a production-like backup into a separate database and record the
  recovery time and maximum acceptable data loss.
- Test registration/login/refresh/logout, tenant isolation, every role boundary,
  and cross-tenant record identifiers.
- Test payment submission, confirmation/rejection, duplicate retries,
  concurrent updates, expense allocation reconciliation, accounting period
  close/correction, and immutable financial history in an isolated staging DB.
- Reconcile seeded ledger totals against an independently calculated expected
  result. Have a domain/accounting reviewer approve the results.
- Run dependency and secret scanning; review authorization-sensitive diffs and
  production database permissions.
- Configure uptime/error/latency/database alerts, retained logs that exclude
  credentials and personal/financial payloads, an incident contact, and a
  documented rollback/credential-rotation process.
- Publish applicable privacy, retention, and deletion policies and confirm
  legal/data-residency obligations before collecting personal or financial
  records.

## Smoke test and release procedure

1. Deploy the same commit to staging with production-like settings and a
   non-production database.
2. Confirm `/api/v1/health` and `/api/v1/ready` return success; verify the
   browser can log in through the web proxy and establish a Socket.IO session.
3. Exercise one complete financial workflow with synthetic data, verify audit
   records and totals, then restore staging from backup.
4. Back up production, run the migration release step, deploy one API instance
   and the web app, then repeat read-only health and login checks.
5. Monitor errors and database health. Stop writes and follow the recovery plan
   if financial totals, authorization, or persistence behave unexpectedly.

This checklist cannot certify the deployment provider, legal compliance,
database contents, secrets, or backup restoration. Those require operator
verification in the target production environment.
