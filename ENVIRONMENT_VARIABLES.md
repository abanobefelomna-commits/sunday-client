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

The platform helpers also reference `TENANT_PROVISIONING_PROVIDER`, `PLATFORM_ROOT_DOMAIN`, `NEON_API_KEY`, `NEON_ORG_ID`, and `NEON_REGION_ID`. These references are part of pre-existing Next-side work and are not a finalized Nest deployment contract.

## Authentication and notifications

Secret/configuration names referenced include `JWT_SECRET`, `PLATFORM_JWT_SECRET`, `OTP_SECRET`, `TENANT_SECRET_KEY`, `JWT_EXPIRES_SECONDS`, `PLATFORM_JWT_EXPIRES_SECONDS`, `REFRESH_TTL_DAYS`, `PLATFORM_REFRESH_TTL_DAYS`, `OTP_TTL_MINUTES`, and `OTP_MAX_ATTEMPTS`. Email delivery references include `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM`. The API README also references `CORS_ORIGINS`.

## Preview settings

The current Next-side Preview helper references `PLATFORM_MODE`, `PLATFORM_LAUNCH_DATE`, `PREVIEW_START_DATE`, and `PREVIEW_END_DATE`. The platform seed leaves these dates unset; a missing setting now remains explicitly unconfigured instead of falling back to the current date. Tenant provisioning stays inactive until the official launch date and matching two-year period are configured. Core Preview access remains free while the program is unconfigured. These values are not yet controlled through a verified platform-admin API. The required central configuration also includes `SUBSCRIPTIONS_ENABLED` and `PAYMENTS_ENABLED`; keep both false until a separately approved paid launch.

## Setup and validation

Set only values required by the service being run, using local ignored environment files or a secret manager. Do not print or copy values when debugging. Validate production secrets at startup, enforce secure cookies, and keep provisioning credentials separate from runtime tenant credentials. The current frontend build succeeds without enabling the public platform API; the registration/directory/join actions remain unavailable until the API URL and Nest endpoints are configured.
