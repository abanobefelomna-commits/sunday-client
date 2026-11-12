# Deployment Guide

**Status:** Local frontend instructions only. No deployment, production migration, or payment configuration was performed.

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
