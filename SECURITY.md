# Security Notes

**Status:** Partial frontend safeguards are implemented; tenant isolation and the platform API are not complete.

## Current public safeguards

- Public data actions use an allowlisted Next proxy; arbitrary paths and methods are rejected.
- Search length is bounded, JSON request bodies are limited to 64 KB, and writes without a JSON content type are rejected.
- Public proxy errors are replaced with generic codes. Successful responses are rebuilt from allowlisted church, provisioning, join, and Preview fields; unexpected fields such as database URLs, children, membership data, and debug details are discarded.
- The provisioning page no longer displays arbitrary upstream error text.
- Preview configuration no longer derives an official date from the system clock. Missing or inconsistent dates remain unconfigured, keep core Preview access free, and prevent new-tenant database creation until the official two-year period is set.
- The landing product preview contains synthetic presentation data only. The public directory does not fabricate churches.

These protections do not replace validation, authorization, audit logging, and rate limiting in the Nest API. The proxy does not make registration, provisioning, lookup, or membership requests operational.

## Required platform controls before release

- Preserve the existing Argon2 and refresh-token behavior; test password reset, OTP, refresh, logout, cookie flags, and expiry before changing auth routes.
- Use distinct platform-admin and church-member authentication/authorization. A platform admin is not automatically a church admin.
- Bind each authenticated session and refresh token to a verified identity and tenant membership. Ignore client-provided tenant identifiers for authorization.
- Keep tenant database credentials encrypted at rest and restrict the provisioning database role to the exact operations required.
- Rate-limit public registration, directory search, code lookup, and join submission in the API. Add bounded validation and duplicate-request/idempotency controls.
- Store only hashed/verified church lookup codes where practical; rotate/revoke with an audit actor and timestamp. A code only identifies a church for a pending request.
- Create membership and grant tenant roles only after an authorized church administrator approves a pending request. Prevent self-approval and requester role selection.
- Do not reveal raw SQL errors, connection strings, passwords, tokens, or child information in responses or logs.
- Use encrypted, access-restricted backups for child data; never use real child/member records in public demonstrations.
- Keep payment collection disabled in Preview. Do not configure a live payment provider without explicit approval.

## Sensitive configuration

Environment variable names are documented in `ENVIRONMENT_VARIABLES.md`; this repository documentation intentionally contains no values. Never paste `.env` contents, database URLs, tokens, or private church codes into issues, logs, or public screenshots.

## Current security verification

The public response sanitizer has unit tests for directory-field filtering, provisioning token shape, provisioning error redaction, join state, and Preview allowlisting. Full cross-tenant authorization, API security, and end-to-end approval tests remain pending because the canonical Nest platform endpoints are not implemented.
