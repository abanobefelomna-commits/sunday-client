# Deployment Guide

**Status:** Local and production deployment instructions. No production migration or secret change is performed by this guide; apply any production change only with explicit owner approval.

## Frontend local workflow

From `G:\God\mom-mary` in PowerShell:

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`. Set the Nest API base URL through the ignored local environment file when a working API is available. Public platform actions will remain unavailable until the Nest endpoints and central platform database are deployed.

Production build and local production preview:

```powershell
npm.cmd run build
npm.cmd start
```

## API local workflow

The NestJS API is in `G:\God\sunday-school-api`. Its documented development command is `npm run start:dev`; build and test commands are `npm run build` and `npm test`. The existing build passed and the existing suite passed one unit test. These results do not validate the multi-tenant API. The API worktree has extensive uncommitted user changes and removed authentication files; preserve that work before changing it.

## Production deployment configuration

The Next.js app hosts the platform API and resolves every tenant request through the central platform database. Production must have:

| Variable | Requirement |
|---|---|
| `DATABASE_URL` | Tenant/operational database connection string (existing church data). |
| `PLATFORM_DATABASE_URL` | Dedicated platform database connection string, for example the same Neon endpoint with database `sunday_platform`. Required. |
| `JWT_SECRET`, `PLATFORM_JWT_SECRET`, `OTP_SECRET` | Strong secrets, at least 32 characters. |
| `TENANT_SECRET_KEY` | Existing 32-byte base64/hex key that decrypts `tenant_connections.encryptedUrl`. Do not regenerate it for an existing deployment. |
| `SMTP_*`, `MAIL_FROM` | Required for password-reset/OTP email delivery. |

Production never falls back to `DATABASE_URL` for platform queries. If `PLATFORM_DATABASE_URL` is missing, invalid, or resolves to the tenant database, tenant routes fail closed with HTTP 503 `PLATFORM_CONFIGURATION_ERROR` and the runtime log records the configuration error. Never enable `ALLOW_SHARED_PLATFORM_DATABASE` in production.

Before deploying, run the read-only checks against the intended platform database:

```powershell
npm.cmd run db:verify:platform -- --deep
npm.cmd run db:check:platform
```

`db:verify:platform` verifies required tables/columns, migration history, church/tenant registry integrity, URL fingerprints, and secrets without writing. `db:check:platform` exits non-zero if platform migrations are pending or required tables are missing. Apply pending platform migrations only when authorized:

```powershell
npm.cmd run db:migrate:platform
```

After deployment, verify a tenant API (for example `/api/analytics/overview`) with a real authenticated session. A healthy response is not sufficient proof if the route only reads cached or empty data; confirm the platform registry resolves the expected church ID.

## Release gates

Before a public or authenticated production release:

1. Complete the canonical Nest platform API and verify both repositories' builds/tests.
2. Reconcile TypeORM and SQL migration histories and verify a restorable backup.
3. Run tenant isolation, auth/refresh, registration, provisioning, join approval, and existing workflow E2E tests.
4. Review all eight locales with native speakers; approve privacy and terms content.
5. Configure Preview dates from one secured official launch setting. Keep checkout and payment collection disabled.
6. Verify secrets in a secret manager; set secure cookies, CORS origins, rate limits, and TLS.
7. Rehearse migration and rollback without modifying production. Obtain explicit approval before any production data movement.
8. Stage and commit only reviewed task-owned files. The two worktrees currently contain unrelated uncommitted changes; do not stage everything or push until those changes are separated and the release gates pass.

## Current verification

The Next frontend production build, focused lint, 45-test full suite, and public-route Playwright smoke checks passed as recorded in `IMPLEMENTATION_PLAN.md`. The full repository lint currently reports 89 errors and 56 warnings in the wider existing tree and generated `.next` output. The Nest baseline build and one existing unit test passed. No API deployment or production operation is authorized by this guide.
