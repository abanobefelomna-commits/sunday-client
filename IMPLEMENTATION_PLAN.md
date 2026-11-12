# Multi-Church Preview Platform — Repository Implementation Plan

**Status:** Discovery completed; staged implementation in progress.  
**Date:** 12 November 2026  
**Working branch:** `feature/multi-church-preview-platform` in `sunday-client` (already checked out).  
**Scope note:** The workspace contains two separate repositories: this Next.js frontend (`sunday-client`) and `G:\God\sunday-school-api` (NestJS + TypeORM). Both had substantial pre-existing uncommitted changes when work began. Preserve those changes; do not reset, clean, stage, or commit them as if they were authored in this task.

## 1. Audit findings

### Repository map

| Area | Current implementation |
|---|---|
| `sunday-client/app` | Next.js App Router; public `/`, authentication, church operations pages, and a growing set of Next route handlers under `/api`. |
| `sunday-client/src/server` | Node/PostgreSQL helpers, auth, current service operations, and pre-existing platform/tenant code. |
| `sunday-client/db` | Existing SQL migrations plus uncommitted `db/platform` and `db/tenant` schemas. |
| `sunday-client/tests` | Node unit/static/integration tests, including authorization and migration checks. |
| `sunday-school-api/src` | Separate NestJS modules with TypeORM entities/services/controllers for users, servants, classes, children, attendance, visitations, news and uploads. The current checkout has extensive uncommitted changes, including deletion of the existing auth controller/service, OTP, refresh-token and DTO files. |

### Existing product and schema

The existing user-facing service includes Arabic RTL servant login/registration and password flows, dashboard, children and child profiles, classes, attendance, servant management, follow-ups, analytics, news, notifications, Friday preparation and profile settings. Existing backend entities include users, servants, classes, children, attendance, visitations and news; historical migration files also define refresh tokens and OTP.

The pre-existing `sunday-client` working tree already contains a substantial multi-tenant implementation in progress: central platform SQL, tenant baseline/RBAC/auth SQL, platform settings/entitlements/provisioning/auth helpers, tenant-resolution helpers, and wrapped Next API routes. This work is uncommitted and not yet a complete platform. It uses direct SQL/Neon in the Next repository, while the documented backend is a separate NestJS + TypeORM repository. The plan's architecture requirement is therefore not currently satisfied by the combined codebase. Do not expand the duplicate Next backend as the canonical implementation without resolving this boundary; NestJS + TypeORM remains the source-of-truth target.

Both repositories are currently on `feature/multi-church-preview-platform`. The API working tree has extensive pre-existing uncommitted changes, including deleted authentication controller/service, OTP, refresh-token and DTO files. Its work must be preserved. The API repository is outside the writable workspace root, so any write there requires explicit execution-environment approval. No API files were changed in this pass.

### Preview and database state

The pre-existing platform SQL models churches, tenant connection references, provisioning jobs, platform admins, settings, plans, subscriptions, features, entitlements, add-ons, invoices, payments, subscription events, lifetime-free grants and platform audit logs. Tenant SQL mirrors current service tables and adds role/permission/settings and tenant auth structures. Existing scripts include platform/tenant migration, schema audit, backup and provisioning support.

No live schema, production database, backup, or migration execution was inspected or run. No database URL, credential, token, or `.env` value was opened. There is no verified source-to-tenant record count or rollback snapshot. Existing production data remains the most significant delivery gate.

## 2. Architecture decision and guardrails

1. Keep the public website and authenticated church workspace in the existing Next.js app, with separate layouts/sections and no marketing shell around service routes.
2. Keep canonical authentication, tenant resolution, provisioning, roles, join approval and operational data access in the NestJS + TypeORM API. The Next.js client should call that API through the existing API base configuration; public pages must not connect to tenant databases.
3. Use a platform PostgreSQL database only for church registry, verification/public-directory fields, central platform admins, provisioning state, preview/subscription configuration and audit data. Children, servants, classes, attendance and care records remain in dedicated tenant databases.
4. Bind a request to the tenant on the server using verified host/session/membership context. A URL slug or church code can identify a destination for a public join request but must never grant tenant access.
5. Preserve current user UUIDs and related UUIDs when seeding the first tenant. Do not run any destructive migration, tenant move, or production provisioning without verified backup, controlled rehearsal, count/checksum comparison, rollback procedure and explicit approval.
6. Keep Preview global and date-driven from protected platform settings. During `PREVIEW`, checkout and payment flags stay false and core entitlements remain active. Do not add a fake launch date or price.
7. Do not publicly grant the lifetime-free exception by church name. It requires a platform-admin verified central grant and an audit record.
8. Use only generated/synthetic data in public demonstrations and public directory fields explicitly opted into publication.

## 3. File-level implementation sequence

### Phase 1 — Discovery and safe baseline (in progress)

- This document: repository map, architecture decision, current state and risk gates.
- `ARCHITECTURE.md`: boundaries between Next.js public/tenant UI, NestJS API, platform database and per-church databases.
- `DATABASE_ARCHITECTURE.md`: central/tenant entities, UUID mapping, connection isolation, data ownership and migration constraints.
- `SECURITY.md`: threat model, tenant resolution, auth/session boundaries, join-code lifecycle, secrets and child-data controls.
- Confirm feature-branch state in both repositories while preserving dirty work. Add no credentials to source or docs.

### Phase 2 — Platform schema and tenant foundations

- NestJS API: platform TypeORM entities/data source, migration runner, tenant registry, encrypted tenant connection references and tenant connection manager.
- `sunday-client/db/platform/*` and `db/tenant/*`: audit existing scripts/SQL and align them with TypeORM migrations; do not maintain two independent migration authorities.
- Add request-scoped tenant context and guard to the API. Replace implicit shared-connection repository access only through a tested tenant-aware repository/data-source design.
- Seed exactly one standard role definition per church with many user-role assignments; separate platform roles from church roles.

### Phase 3 — Safe provisioning and registration

- NestJS API platform module: idempotent registration, uniqueness/duplicate checks, secure admin verification, asynchronous provisioning job, retries, terminal failure state and status polling.
- Provisioning order: pending central record → dedicated database → migrations → role/permission seed → initial admin with preserved/generated UUID as applicable → connection registry → active status. Any failure stays non-active and is retryable.
- Generate an opaque, rotatable church lookup code after successful provisioning; store only a verifier/hash where practical. Code permits a join request only.
- Add public-only church directory queries with opt-in fields and no database ID, internal metadata, private contact information, membership data or code.

### Phase 4 — Authentication, identity, membership and authorization

- Preserve existing Argon2 and refresh-token behavior; restore equivalent Nest endpoints before any auth path is removed.
- Bind access and refresh sessions to tenant, audience and membership. Keep platform-admin sessions isolated from church-admin sessions.
- Add central identity mapping without moving tenant-local user rows during the first release. Existing tenant UUIDs remain stable; document cross-church identity linking as a separate migration.
- Add pending join requests with explicit approve/reject, actor, timestamp and reason. No membership/role/tenant access before approval. Prevent self-approval and role escalation.
- Test direct-ID, slug, code, host-header, cookie and modified-body tenant substitution.

### Phase 5 — Preview and entitlement controls

- Secure platform settings for `PLATFORM_MODE`, official start/end dates, `SUBSCRIPTIONS_ENABLED`, and `PAYMENTS_ENABLED`.
- One platform-wide Preview interval; no per-church signup clock. Enforce no checkout/payment writes in Preview. Seed core feature entitlements so absent subscriptions do not block service operations.
- Plan/add-on/subscription/payment abstractions remain inactive until an explicit future configuration and authorization.
- Verify lifetime-free church grant against reviewed identity/evidence and store who verified it; name equality alone is insufficient.

### Phase 6 — Public site and visitor journeys

- Next app: refactor `/` into public marketing layout/components while keeping `/login`, `/register`, OTP and password routes stable. Add `/churches`, church registration, join, privacy and terms destinations without duplicating existing route URLs.
- Implement the supplied reference composition using semantic responsive components, a replaceable local hero asset, synthetic product preview, reduced motion, accessible navigation, Preview copy from public configuration and valid CTA destinations.
- Make directory and configuration API failures degrade gracefully; never require a tenant DB to render `/`.
- Add locale dictionaries and RTL/LTR direction handling for `ar`, `en`, `fr`, `es`, `de`, `it`, `pt`, and `ru`. Do not mark a locale complete until reviewed.
- Required deliverables: `PUBLIC_WEBSITE_DESIGN_SPEC.md`, `LOCALIZATION_GUIDE.md`, `CHURCH_DISCOVERY_AND_JOIN_FLOW.md`.

### Phase 7 — Role-specific dashboards and administration

- Keep church workspace routes and task navigation separate from public pages.
- Add church-admin member approvals, invitations/codes, class/role settings and audit access.
- Add a separately authenticated platform-admin area for churches, provisioning jobs, Preview settings, plans/features, lifetime-free grants, usage summaries and platform audit logs.
- Use explicit role permissions and empty/loading/error states; no privileged UI is treated as server authorization.

### Phase 8 — First-church migration

- Create encrypted, access-controlled backup and restore rehearsal; inventory every source table, relation, index and foreign key.
- Create a tenant from schema only first, then migrate a controlled copy. Preserve UUIDs and verify counts, referential integrity, auth, uploads and workflows.
- Keep the source database intact. No production switch until an operator approves a written cutover and rollback window.
- Deliver `MIGRATION_GUIDE.md` and `TENANT_PROVISIONING.md` before production migration.

### Phase 9 — Verification, documentation and delivery

- Unit: tenant resolution, authorization, role seeding, provisioning idempotency/failure, Preview boundary, entitlement decisions and code verifier/rotation.
- Integration/security: A/B isolation; membership approval; no code-based access; auth/refresh binding; public directory redaction; secret/error redaction; source-to-tenant UUID/count checks on synthetic fixtures.
- E2E: public landing CTA destinations, church registration/provision status, join request/approval, existing login/recovery, attendance and child workflows, Arabic RTL and English LTR, keyboard/reduced motion, representative desktop/tablet/mobile viewports.
- Run build/lint/tests in each affected repository; record actual commands/results. Add `API_DOCUMENTATION.md`, `ENVIRONMENT_VARIABLES.md`, `DEPLOYMENT_GUIDE.md`, and update README after implementations settle.
- Commit only task-authored files in logical commits; do not stage unrelated existing edits. Push only feature branches after checks; never force-push or merge to main.

## 4. Breaking-change and migration risk register

| Risk | Severity | Required safeguard |
|---|---:|---|
| Existing Nest auth files are deleted in the API working tree | Critical | Preserve current diffs; restore behavior in a feature branch before any auth deployment; test password/OTP/refresh flows. |
| Frontend currently contains a second direct-SQL API/platform implementation | High | Establish Nest as canonical service boundary; avoid new duplicate business logic; align/reuse schemas only after contract review. |
| Database-per-tenant changes repositories and connections used by every existing service | Critical | Tenant-context isolation design; concurrent request tests; no shared mutable connection switching. |
| Existing schema/migration histories differ across API and Next repo | High | Inventory table/FK/enum/UUID differences; choose one migration authority; rehearsal before apply. |
| Production/source database access and backups are not verified | Critical | Do not touch production; obtain encrypted backup and restore proof before migration. |
| Auth/session transition can strand users or permit tenant switching | Critical | Tenant-bound access/refresh tokens, secure cookies, rollback-compatible login and session invalidation plan. |
| Lifetime-free exception can be claimed by name | High | Central verified grant only, separate permission, audit, and no public claim route. |
| Public site can leak child/church data or reveal tenant metadata | High | Synthetic demos, explicit public-directory allowlist, response redaction and route tests. |
| Eight-language translations and RTL/LTR can be incomplete | Medium | Locale-specific dictionaries and automated layout/route checks; report incomplete translations honestly. |
| Two active Git repositories have dirty worktrees | High | New feature branch per repository; do not reset/stage/commit unrelated work; write permission required for API repo outside workspace. |

## 5. Current gates and non-claims

- No database or migration has been executed in this implementation pass.
- No source records have been copied and no user UUIDs have been changed.
- No public registration, directory, join, approval or platform-admin API is considered operational until it is implemented in the canonical API and tested.
- The API repository is outside the current writable root and has extensive uncommitted authentication deletions. Request execution approval before writing there; continue independent frontend work meanwhile.
- GitHub push/commit and production actions remain later delivery steps after branch-local work, tests, and security/migration gates.

## 6. Implementation progress (12 November 2026)

### Completed in this pass

- Replaced the public `/` content with a visitor-focused page using the supplied visual direction. Added responsive header, hero, benefits, synthetic product preview, current/planned feature labels, how-it-works steps, directory entry point, global Preview statement, FAQ, contact notice, and footer.
- Added a local, replaceable crop of the supplied reference illustration at `public/images/public-hero-illustration.jpg`; no full reference screenshot is used as a page background.
- Added eight authored locale dictionaries for the landing and public flows, locale persistence in the browser, HTML `lang`/`dir` switching, logical CSS layout, and a responsive public flow shell.
- Added route UI for `/register/church`, `/register/church/provisioning`, `/churches`, `/join`, `/privacy`, and `/terms`; existing `/login`, `/register`, OTP and recovery routes remain in place.
- Added an allowlisted, no-store Next-to-Nest public API proxy. Forms and search target that API; no public church records or fake provisioning result are supplied locally.
- Hardened the proxy to bound query/body sizes, reject non-JSON writes, strip upstream error bodies, and return only allowlisted directory, provisioning, join, and Preview fields. Added five unit tests for those response boundaries.
- Added a servant account creation link from the church match screen, in all eight public-flow dictionaries.
- Removed raw provisioning error details from the browser UI and darkened the primary CTA gradient to meet 4.5:1 white-text contrast at its lightest stop.
- Removed current-date Preview fallbacks from the existing Next-side helper and platform seed. An unset official date remains `unconfigured`; core Preview access stays free, payments/subscriptions remain disabled, and tenant provisioning stops before database creation until one official date and its exact two-year period are configured.
- Removed placeholder support/legal version values from the platform seed and defaults.
- Added `ARCHITECTURE.md`, `DATABASE_ARCHITECTURE.md`, `SECURITY.md`, `MIGRATION_GUIDE.md`, `TENANT_PROVISIONING.md`, `ENVIRONMENT_VARIABLES.md`, `API_DOCUMENTATION.md`, `DEPLOYMENT_GUIDE.md`, `PUBLIC_WEBSITE_DESIGN_SPEC.md`, `LOCALIZATION_GUIDE.md`, and `CHURCH_DISCOVERY_AND_JOIN_FLOW.md`.

### Verification completed

- `npm.cmd run build` passed after the latest code changes; all 55 Next routes generated.
- Focused ESLint passed for the public pages, components, proxy, sanitizer and new unit test.
- `npm.cmd run test:unit` passed: 33 tests, including Preview policy and public-response filtering.
- `npm.cmd test` passed: 45 tests, including read-only integration/database checks, public response filtering, and Preview policy tests.
- In the separate API repository, `npm.cmd run build` passed and `npm.cmd test` passed (1 existing unit test). These results validate only the existing Nest baseline; they do not exercise multi-tenant functionality.
- Full Playwright smoke check used the production build at 1440px desktop, 768px tablet and 390px mobile. `/`, `/register/church`, `/churches` and `/join` rendered without horizontal overflow. Existing `/login`, `/register`, `/verify-otp`, `/forgot-password` and `/reset-password` routes were opened without submitting credentials.
- Arabic and seven LTR locales were smoke-tested on `/` and `/register/church` at 390px; each set `lang`/`dir` correctly and had no horizontal overflow. Keyboard focus reached the skip link with a visible outline; reduced-motion CSS was verified.
- Contrast was checked for the main text and primary action states. CTA white text now has at least 5.33:1 contrast at the lightest gradient stop; muted body text is above 5.5:1 on the light surface.
- The Vercel Analytics local script returned a 404 at `/_vercel/insights/script.js`; this is a local instrumentation endpoint and not a page asset. No other browser console error was found in the public route checks.

### Still pending

- No Nest public API endpoints have been implemented in this pass. Church registration, provisioning, code lifecycle, directory records, join requests and approval are not operational.
- The existing servant registration immediately creates a tenant-local account. It must not be used for the new pending-membership journey until central identity mapping and approval semantics are implemented.
- Landing Preview text currently reflects the requested policy but is not yet fetched from protected platform configuration.
- The privacy and terms routes are notices that final approved owner/legal text is pending.
- The complete frontend lint command `npm.cmd run lint` still fails with 89 errors and 56 warnings across pre-existing application files and generated `.next` output. The focused lint command for this change set passes.
- The API-side platform database and migration authority, public/provisioning endpoints, tenant-bound authentication/authorization, administrator approval UI/API, database rehearsal, rollback, native translation review, legal review, full E2E/security testing, commits and push remain pending.
- API repository edits require workspace execution approval because `G:\God\sunday-school-api` is outside the writable root. No API files have been modified by this task yet.
