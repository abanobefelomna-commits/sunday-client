# Environment Variables

This file lists names only; it contains no secret values. The actual deployment values must be stored in an approved secret manager and must not be committed.

## Frontend and public API routing

| Name | Use |
|---|---|
| `NEXT_PUBLIC_API_URL` | Existing browser/API base and current fallback for the public proxy. It is public configuration, not a credential. |
| `NEST_API_URL` | Server-side Nest API base used by `/api/public/*`; the proxy appends `/api/public`. |
| `NEXT_PUBLIC_APP_URL`, `APP_BASE_URL` | Application base URL references in platform helpers. |

## PostgreSQL and provisioning references

Names currently referenced in the working tree include `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `PLATFORM_DATABASE_URL`, `PLATFORM_DATABASE_URL_UNPOOLED`, `TENANT_DATABASE_URL`, `TENANT_ADMIN_DATABASE_URL`, and API host-based fields `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_PASSWORD`, `DB_NAME`, and `DB_SYNCHRONIZE`.

### Platform database (required in production)

`PLATFORM_DATABASE_URL` is mandatory in production and must point to the dedicated platform database (for example `sunday_platform`), not to the tenant database. The application no longer falls back to `DATABASE_URL`: a missing URL, an invalid URL, or one that resolves to the same PostgreSQL database as `DATABASE_URL` fails closed. Tenant routes then return HTTP 503 `PLATFORM_CONFIGURATION_ERROR` instead of a misleading `42P01`/empty 500.

- Verify configuration before deploying: `npm run db:verify:platform` (read-only; add `-- --deep` to check tenant identity rows).
- Check applied platform migrations: `npm run db:check:platform`.
- Apply platform migrations (additive, uses `PLATFORM_DATABASE_URL` only): `npm run db:migrate:platform`.
- `ALLOW_SHARED_PLATFORM_DATABASE=true` is a development-only escape hatch. It is rejected in production and must not be configured there.
- `TENANT_SECRET_KEY` must remain stable across deployments: it decrypts the tenant URLs already stored in `tenant_connections`. Rotating it without `scripts/rotate-tenant-secret.mjs` makes existing churches unresolvable.

The platform helpers also reference `TENANT_PROVISIONING_PROVIDER`, `PLATFORM_ROOT_DOMAIN`, `NEON_API_KEY`, `NEON_ORG_ID`, and `NEON_REGION_ID`. These references are part of pre-existing Next-side work and are not a finalized Nest deployment contract.

## Authentication and notifications

Secret/configuration names referenced include `JWT_SECRET`, `PLATFORM_JWT_SECRET`, `OTP_SECRET`, `TENANT_SECRET_KEY`, `JWT_EXPIRES_SECONDS`, `PLATFORM_JWT_EXPIRES_SECONDS`, `REFRESH_TTL_DAYS`, `PLATFORM_REFRESH_TTL_DAYS`, `OTP_TTL_MINUTES`, and `OTP_MAX_ATTEMPTS`. Email delivery references include `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM`. The API README also references `CORS_ORIGINS`.

## Preview settings

The current Next-side Preview helper references `PLATFORM_MODE`, `PLATFORM_LAUNCH_DATE`, `PREVIEW_START_DATE`, and `PREVIEW_END_DATE`. The platform seed leaves these dates unset; a missing setting now remains explicitly unconfigured instead of falling back to the current date. Tenant provisioning stays inactive until the official launch date and matching two-year period are configured. Core Preview access remains free while the program is unconfigured. These values are not yet controlled through a verified platform-admin API. The required central configuration also includes `SUBSCRIPTIONS_ENABLED` and `PAYMENTS_ENABLED`; keep both false until a separately approved paid launch.

## Firebase Authentication (supporting identity layer)

Firebase is optional and only proves the email/password credential; the tenant Postgres database stays authoritative for users, roles, class scope and business data. With `NEXT_PUBLIC_FIREBASE_AUTH_ENABLED` unset or not `true`, the built-in login and registration are unchanged. No Firestore, FCM, Analytics or other Firebase product is required, so the free Spark plan is sufficient.

Public Web App config for project `sunday-school-5e9b2` (safe to expose): `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, and optionally `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` / `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`.

Server-only Admin credentials, never prefixed with `NEXT_PUBLIC_`: `FIREBASE_SERVICE_ACCOUNT_JSON` (full or base64 service-account JSON) or the split `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`. Without them the server still verifies Firebase ID tokens against Google's public JWKS; with them it also checks token revocation. The identity link itself is stored in the tenant `users.firebaseUid` column (migration `012_firebase_identity`).

## Setup and validation

Set only values required by the service being run, using local ignored environment files or a secret manager. Do not print or copy values when debugging. Validate production secrets at startup, enforce secure cookies, and keep provisioning credentials separate from runtime tenant credentials. The current frontend build succeeds without enabling the public platform API; the registration/directory/join actions remain unavailable until the API URL and Nest endpoints are configured.
