# Security Fixes Report — Phase 1 (Items 1–10)

**Project:** Sunday School multi-church SaaS (`G:\God\mom-mary`)  
**Date:** 17 November 2026  
**Scope:** Phase 1 security hardening, items 1–10  
**Status:** Implemented and verified locally. No database migration was executed. No commit, push, stash, reset, or clean was performed.

---

## 1. Outcome

| Area | Result |
|---|---|
| Phase 1 audit items | 10 / 10 implemented |
| Additional findings fixed during verification | 8 |
| Findings already fixed or incorrect | None |
| Findings deferred | 1 (`PostgresAdminProvider` per-tenant database role isolation) |
| Tenant SQL migration | Added `db/tenant/005_security_hardening.sql`; bundled into `src/server/tenant/schema.generated.ts` |
| Production migration executed | None |
| Database access | Tests connected to the configured test database; no migration command was run |
| Existing user UUIDs | Unchanged |
| Typecheck | `npx tsc --noEmit` — clean |
| Unit tests | `npm run test:unit` — 76 passed, 0 failed |
| Full test suite | `npm test` — 102 passed, 0 failed |
| Production build | `npm run build` — succeeded, 59 routes generated |
| Targeted lint | 0 errors in changed files, except 2 pre-existing errors in untouched lines of `app/news/page.tsx` |
| Full-project lint | Still red on pre-existing issues (`68 errors, 63 warnings`); no new error attributable to this change set |

The working tree remains uncommitted. Owner files such as `* - Copy.md` were not modified.

---

## 2. Findings verification

Every audit finding was checked against the current code before changing it. None was already fixed, and none was a false positive.

| # | Finding | Verification evidence | Result |
|---|---|---|---|
| 1 | Child/care data was readable outside a servant's assigned classes | `children`, notes, progress, visitations, follow-ups, attendance and analytics routes scoped only by `privileged`, not by the church read policy | Confirmed; fixed |
| 2 | Refresh tokens were reusable and not rotated | `/api/auth/refresh` accepted the same cookie repeatedly; no reuse detection or revocation path | Confirmed; fixed |
| 3 | Registration returned tokens before proving email ownership | `POST /api/auth/register` created an active user and returned an access token immediately | Confirmed; fixed |
| 4 | Password policy was too weak and inconsistent | Server and client accepted 8 characters; no composition rules; reset/profile used different checks | Confirmed; fixed |
| 5 | `next` redirects could escape the app | Login and logout implemented weak local `safeNext` checks | Confirmed; fixed |
| 6 | No CSP or HSTS response headers | `next.config.ts` had no `headers()` security policy | Confirmed; fixed |
| 7 | Vercel Analytics received full URLs with query/hash/record IDs | `<Analytics />` was mounted without a `beforeSend` filter | Confirmed; fixed |
| 8 | Raw exception messages reached API clients | 55 response sites used `error.message`; internal-error cases returned database or framework text | Confirmed; fixed |
| 9 | Upload failures returned raw exception text | Avatar, class-image and news-image routes returned `error.message` for any failure | Confirmed; fixed |
| 10 | News edit/delete was not authorized on the server | `/api/news/[id]` and `/api/news/[id]/image` trusted the bearer token without checking ownership or `news.write` | Confirmed; fixed |

Additional issues found while verifying the ten items were also fixed; see section 4.11.

---

## 3. Product decisions applied

| Decision | Implemented behaviour |
|---|---|
| **Default class read scope** | Non-privileged servants can read child details, notes, visitations, follow-ups and attendance only for classes assigned through `servants_classes` or their account grade list. Class names and aggregate counts remain browsable. |
| **Legacy broad read** | A new `access.readAllClasses` church setting preserves the founding church's previous broad-read behaviour. Migration 005 seeds `true` only when a `tenant_identity` row already exists. New churches are provisioned with `false`. A missing setting still defaults to `true` so pre-settings databases keep working. |
| **Registration verification** | Registration creates an inactive, unverified account and returns no tokens. A 6-digit email code, sent through the existing OTP/SMTP infrastructure, activates the account. Production fails closed if the email cannot be sent. |
| **Duplicate registration response** | A generic message tells the person to sign in or reset their password; it never reveals whether the email or phone exists. |
| **Analytics privacy** | Query strings, hashes and UUID path segments are removed before events are sent to Vercel Analytics. |
| **Registration avatar** | No avatar upload during registration, because no authenticated session exists until email verification. Avatars remain editable from the profile page. |
| **Per-tenant Postgres role isolation** | Deferred. `PostgresAdminProvider` still provisions with the administrative connection URL. This is reported in section 7 and was not changed. |

---

## 4. Implemented controls

### 4.1 Class-scoped reads (item 1)

- Added pure helpers in `src/server/access.ts`:
  - `readAllClassesEnabled` parses the tenant setting safely.
  - `hasBroadClassRead` returns true for privileged users or an enabled church setting.
  - `canReadClass` allows privileged users, broad-read churches, or an assigned class only.
  - `canWriteClass` never honours broad read; writes stay limited to assigned classes.
- `getAccessContext` in `src/server/middleware.ts` now loads `access.readAllClasses` and returns it with `servantRole`, `classIds`, `permissions`, `servantId` and `userId`.
- Applied read scope to:
  - `GET /api/children` and `GET /api/children/[id]`
  - child notes and progress routes
  - visitation list and per-child visitations
  - follow-up list and analytics
  - attendance list, sessions, summary and report
  - analytics overview
- Writes continue to use `canWriteClass`; a scoped user cannot create or edit records in another class by passing a different `classId`.
- A requested `classId` is validated with `canReadClass` before it can override the default scope, so the filter cannot be used to escape assignments.
- The general-class detail endpoint no longer returns every child in the database. Scoped users see only children in their readable classes; broad-read churches keep the legacy list.

### 4.2 Session and refresh-token hardening (item 2)

- `verifyAndRotateRefreshToken` claims a token with one conditional `UPDATE ... WHERE revokedAt IS NULL`, so two concurrent refreshes cannot both succeed.
- Rotation revokes the old token and issues a new one.
- Reuse of an already-rotated token after a short grace period revokes **all** refresh tokens for that user; the grace period avoids logging out users whose tabs raced during a normal rotation.
- Refresh is cookie-only. The request body is not accepted as a token source.
- Logout revokes the presented refresh token and clears both the current root-path cookie and the legacy `/api/auth` cookie path.
- `revokeRefreshToken` and `revokeAllUserRefreshTokens` are tenant-scoped.
- Deleting a servant now deactivates the linked user account and revokes all of that user's sessions.
- Login returns the generic credential error for a deactivated account; only an **unverified** email gets the `EMAIL_NOT_VERIFIED` prompt. This avoids using the response as an account-status oracle.
- Login, refresh, verify-email and `/api/auth/me` responses now include `servantRole`, `classIds` and `permissions`, so the client does not have to infer authorization from a role label.

### 4.3 Registration email verification (item 3)

- `POST /api/auth/register`:
  - Accepts only `servant` or `class_leader`; administrative and priest labels are ignored, and the account role is always `servant`.
  - Creates the user with `isActive = false` and `emailVerified = false`.
  - Stores the chosen service label in the new `users.servantRole` column.
  - Creates an `email_verification` OTP and sends it through the existing SMTP helper.
  - Returns `requiresEmailVerification`, the email and the church, but **no access or refresh token**.
  - Returns a generic conflict message for an existing email or phone.
- New `POST /api/auth/verify-email`:
  - Verifies the 6-digit code with the atomic OTP CTE.
  - Activates the account and sets `emailVerified = true`.
  - Tolerantly syncs the servant directory; a legacy identity conflict is logged but does not block an already verified account.
  - Issues tokens and tenant cookies only after successful verification.
  - Supports `action: "resend"` with a generic response and its own rate limit.
- New `/verify-email` page with code entry, 60-second resend timer, success state and Arabic/English copy.
- OTP verification:
  - Added `src/server/otp-core.ts` for pure outcome classification.
  - `verifyOtp` selects the newest unconsumed code with `FOR UPDATE`, increments attempts, checks expiry/attempt limits and marks the code consumed in one CTE.
  - Invalid, expired, exhausted and missing codes are distinguished server-side without exposing whether another user's code exists.
  - Added partial index `IDX_otp_codes_active_lookup` for the newest-unconsumed lookup.
- `src/server/email.ts` now has `sendVerificationEmail` and uses purpose-specific Arabic copy. In development without SMTP it logs the OTP once for local testing; in production it returns `false` and registration fails closed.

### 4.4 Password policy (item 4)

- Added shared `app/lib/password-policy.ts`:
  - 10–128 characters.
  - At least one Unicode letter and one Unicode number.
  - `passwordPolicyIssue` and `passwordPolicyMessageKey` are pure and unit-tested.
- Server enforcement in `src/server/auth.ts` uses the same helper and returns Arabic validation messages.
- Registration, reset-password and profile screens use the same client helper and 10-character labels.
- The i18n strings were updated in both Arabic and English.

### 4.5 Open redirect hardening (item 5)

- Added `app/lib/safe-next.ts` with strict validation:
  - Requires a single leading `/`.
  - Rejects protocol-relative `//`, backslash variants, schemes, control characters, CRLF, malformed percent-encoding and over-long values.
  - Decodes once and re-checks the decoded value.
- Login and logout now use `safeNextPath`.
- Login maps `/login`, `/register` and empty values back to `/dashboard`.
- Logout uses `fallback = null` so an invalid `next` simply returns to `/`.
- Unit coverage: `tests/unit/safe-next.test.mjs`.

### 4.6 Security headers (item 6)

`next.config.ts` now sends, for every route:

- `Content-Security-Policy`:
  - `default-src 'self'`
  - scripts from self, Vercel Analytics and inline Next bootstrap scripts
  - `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'self'`
  - `upgrade-insecure-requests` in production
  - `'unsafe-eval'` only in development
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` in production.
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### 4.7 Analytics privacy (item 7)

- Added `app/lib/analytics-sanitizer.ts`:
  - Strips query strings and hashes.
  - Replaces UUID path segments with `[id]`.
  - Keeps the origin only when the input was absolute.
  - Handles empty, malformed and non-string input safely.
- Added `app/components/SafeAnalytics.tsx`, which passes every event through `beforeSend`.
- `app/layout.tsx` now renders `SafeAnalytics` instead of the raw Vercel component.
- Unit coverage: `tests/unit/analytics-sanitizer.test.mjs`.

### 4.8 Error-message redaction (item 8)

- Reviewed 55 response sites that returned `error.message`; replaced every internal-error case with a fixed Arabic message.
- Validation and upload failures that are intentionally user-correctable keep their safe messages.
- Database errors, connection details, SQL text and stack information no longer reach API clients.
- `console.error` server logging remains for operators.

### 4.9 Upload validation (item 9)

- Added `UploadValidationError` in `src/server/upload.ts` for missing files, unsupported types and oversized images.
- All four image routes now:
  - Return the validation message as `400` for `UploadValidationError`.
  - Return a fixed Arabic message and `500` for unexpected failures.
- Affected routes:
  - `app/api/users/[id]/avatar/route.ts`
  - `app/api/servants/[id]/avatar/route.ts`
  - `app/api/classes/[id]/image/route.ts`
  - `app/api/news/[id]/image/route.ts`
  - `app/api/news/route.ts` (multipart create)
- Allowed types and the 5 MB limit are unchanged.

### 4.10 News authorization (item 10)

- `PATCH` and `DELETE` on `/api/news/[id]` now require authentication and allow only:
  - privileged users,
  - holders of `news.write`, or
  - the post author (`news.authorId === auth.sub`).
- `/api/news/[id]/image` now applies the same rule before replacing or deleting an image.
- The news UI shows the delete control only for authors or `news.write` holders, instead of for every signed-in user.
- `NewsItem` now exposes `authorId`.

### 4.11 Additional fixes found during verification

- **Servant role validation:** `POST /api/servants` and `PATCH /api/servants/[id]` normalize English codes and Arabic labels through `normalizeServantRole`; unknown roles are rejected. The privileged-role check accepts both spellings.
- **Servant identity linking:** `findServantForUser` prefers the explicit `userId` link, falls back to an unambiguous phone/email match only for unlinked rows, and links opportunistically. Migration 005 performs the same backfill only when both sides are unique.
- **Servant avatar sync:** switched from phone matching to `syncServantAvatarForUser(userId, avatar)`.
- **Servant deletion:** deactivates the linked account and revokes its sessions.
- **Profile updates:** `grades` are only re-evaluated when explicitly supplied, so a profile edit cannot silently remove class assignments. Grade is read-only in the UI.
- **Registration role escalation:** the public form offers only servant/class leader, and the server ignores admin/priest labels.
- **General class leak:** fixed as described in 4.1.
- **Localization:** added all new verification, password-policy and profile strings in Arabic and English; removed obsolete avatar/admin-registration strings.

---

## 5. Database changes

### 5.1 New migration

`db/tenant/005_security_hardening.sql` is additive and idempotent:

1. `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "servantRole" varchar(40);`
2. Insert `access.readAllClasses = true` **only if** `tenant_identity` already has a row; `ON CONFLICT DO NOTHING` preserves any explicit value.
3. Backfill `servants.userId` only for matches that are unique on both the servant side and the user side; already-linked rows are never reassigned.
4. Create partial index `IDX_otp_codes_active_lookup` on `otp_codes (userId, purpose, createdAt DESC) WHERE consumedAt IS NULL`.
5. Record `005_security_hardening` in `tenant_migrations` with `ON CONFLICT DO NOTHING`.

No `DROP`, `TRUNCATE`, `DELETE`, UUID rewrite or destructive type change is present.

### 5.2 Bundle

The file was bundled with:

```powershell
node scripts/bundle-tenant-schema.mjs
```

`src/server/tenant/schema.generated.ts` now contains the 005 entry. No migration command was run against any database.

### 5.3 Legacy and new tenant behaviour

- **Legacy/founding church:** migration 005 writes `access.readAllClasses = true`, preserving broad reads. If the church already has an explicit `false`, it is not overwritten.
- **Newly provisioned church:** `seedTenantIdentity` in `src/server/platform/provisioning.ts` inserts `access.readAllClasses = false` with `ON CONFLICT DO NOTHING`. New churches start scoped.
- **Database with no setting:** `getAccessContext` defaults to `true`, matching the previous behaviour for pre-settings tenants.
- **Writes:** never governed by `readAllClasses`; a broad-read church can still only write to assigned classes.

---

## 6. Verification

All commands were run in `G:\God\mom-mary`.

| Command | Result |
|---|---|
| `npx tsc --noEmit` | Passed, no output |
| `npm run test:unit` | 76 tests, 76 passed, 0 failed |
| `npm test` | 102 tests, 102 passed, 0 failed |
| `npm run build` | Passed; Next.js 16.4.2; 59 static pages generated |
| Targeted ESLint on changed files | 18 problems (2 errors, 16 warnings); both errors are pre-existing lines in `app/news/page.tsx` |
| Full `npm run lint` | 131 problems (68 errors, 63 warnings) — pre-existing project baseline |

### 6.1 Pre-existing lint errors

The two targeted-lint errors are in untouched lines of `app/news/page.tsx`:

- line 64: `setUser(getStoredUser())` and `setToken(...)` synchronously inside `useEffect` (`react-hooks/set-state-in-effect`).
- line 168: `Date.now()` called during render in `timeAgo` (`react-hooks/purity`).

The full-project lint also reports pre-existing issues in `app/children/page.tsx`, `src/server/followups.ts` (`no-explicit-any`) and generated output. These were not introduced by this change set and were left untouched to avoid unrelated rewrites.

### 6.2 Tests added

- `tests/unit/password-policy.test.mjs`
- `tests/unit/analytics-sanitizer.test.mjs`
- `tests/unit/safe-next.test.mjs` (already present, retained)
- `tests/unit/otp.test.mjs`
- Updated `tests/unit/authorization.test.mjs` for the scoped-read policy.

### 6.3 Database note

`npm test` includes integration checks that connected to the database configured for the test environment. **No migration command was executed.** The migration files were only bundled and statically tested.

---

## 7. Deferred item and remaining risks

### 7.1 `PostgresAdminProvider` tenant role isolation — deferred

`PostgresAdminProvider` still uses the administrative connection URL for tenant provisioning. Proper isolation requires:

- a distinct Postgres role per tenant (or per provisioning job),
- least-privilege grants limited to the tenant schema/database,
- credential storage and rotation,
- connection-limit and statement-timeout policy,
- a migration path for existing tenants.

This was intentionally not changed because it affects provisioning, credential storage and rollback. It remains a release gate for multi-church production.

### 7.2 CSP uses `'unsafe-inline'`

Next.js injects inline bootstrap scripts and styles. The current CSP therefore allows `'unsafe-inline'`; development also allows `'unsafe-eval'`. A nonce-based CSP is the stronger follow-up once the app is ready to thread a per-request nonce through the App Router.

### 7.3 Rate limiting is in-process

`src/server/security.ts` keeps rate-limit buckets in a module-level `Map`. This is adequate for a single instance and for development, but multi-instance deployments need a shared store (Redis or the platform database) so limits apply across instances.

### 7.4 Email verification depends on SMTP

Production registration fails closed when SMTP is not configured or the send fails. The account remains inactive and the user can request a resend. Operators must monitor SMTP configuration and delivery.

### 7.5 Legacy broad-read default

A tenant database that never receives the `access.readAllClasses` setting keeps broad reads. Only provisioning writes an explicit `false`. Any manual tenant creation path must write the setting or call the provisioning seed.

### 7.6 Full lint baseline

`npm run lint` remains red for pre-existing reasons. It is not a regression from this work; the changed files have no new lint errors beyond the two historical `app/news/page.tsx` lines.

---

## 8. Files changed

### New files

- `db/tenant/005_security_hardening.sql`
- `app/lib/password-policy.ts`
- `app/lib/safe-next.ts`
- `app/lib/analytics-sanitizer.ts`
- `app/components/SafeAnalytics.tsx`
- `app/verify-email/page.tsx`
- `app/api/auth/verify-email/route.ts`
- `src/server/otp-core.ts`
- `tests/unit/password-policy.test.mjs`
- `tests/unit/analytics-sanitizer.test.mjs`
- `tests/unit/otp.test.mjs`
- `tests/unit/safe-next.test.mjs`

### Modified — authentication and access

- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/me/route.ts`
- `app/api/auth/refresh/route.ts`
- `app/api/auth/register/route.ts`
- `src/server/auth.ts`
- `src/server/access.ts`
- `src/server/middleware.ts`
- `src/server/otp.ts`
- `src/server/servants.ts`
- `src/server/email.ts`
- `src/server/platform/provisioning.ts`

### Modified — routes and UI

- `app/api/analytics/overview/route.ts`
- `app/api/attendance/*` (list, sessions, summary, report, bulk, item)
- `app/api/children/*` (list, details, notes, profile, progress)
- `app/api/classes/*` (list, details, image)
- `app/api/follow-ups/*`
- `app/api/news/*` (list, item, image)
- `app/api/notifications/*`
- `app/api/servants/*` (list, item, avatar)
- `app/api/users/*` (item, avatar)
- `app/api/visitations/*`
- `app/lib/api.ts`
- `app/lib/app-i18n.ts`
- `app/login/page.tsx`
- `app/logout/route.ts`
- `app/news/page.tsx`
- `app/profile/page.tsx`
- `app/register/page.tsx`
- `app/reset-password/page.tsx`
- `app/layout.tsx`
- `next.config.ts`
- `src/server/analytics.ts`
- `src/server/followups.ts`
- `src/server/upload.ts`
- `src/server/tenant/schema.generated.ts`
- `tests/unit/authorization.test.mjs`
- `tsconfig.json` (`allowImportingTsExtensions` for the pure OTP helper)

---

## 9. Deployment notes

1. Apply `005_security_hardening.sql` to each tenant database before, or in the same release as, the new API routes. `register` and `verify-email` read/write `users.servantRole`; the registration endpoint fails if the column is missing. The migration is additive and safe, but it must not be run against production without the normal backup/rehearsal gate.
2. Deploy the frontend and API routes together. Old clients expect registration to return tokens; the new endpoint intentionally returns none.
3. Confirm SMTP variables are configured in production before enabling registration; otherwise registration fails closed.
4. Decide whether the founding church should keep `access.readAllClasses = true` or be moved to scoped reads. The migration preserves the current broad-read behaviour by default.
5. Review the CSP in a staging environment before enforcing it in production. If a third-party script is added later, update `script-src`/`connect-src` deliberately.
6. Track the deferred `PostgresAdminProvider` isolation work as a release gate for multi-church provisioning.

## 10. Rollback notes

- Code rollback is straightforward: the schema additions are additive and can remain in place.
- Setting `access.readAllClasses = true` restores legacy broad reads without a code change.
- Refresh-token rotation is backward-compatible: existing refresh tokens remain valid for their next rotation; no mass logout is required.
- Newly registered but unverified accounts remain inactive after a code rollback. They can be activated manually if necessary, or the user can register again after the rollback.
- No user, child, class, attendance or servant UUID was changed by this work.
