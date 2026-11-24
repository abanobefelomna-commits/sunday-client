# Church Discovery and Join Flow

## Public directory policy

The directory may return only an allowlisted public church name, city/area when opted in, public description when opted in, and verification status. It must exclude database IDs, connection details, church codes, private contact details, members, users, child records, operational counts, and internal status/error metadata. Only active churches with directory publication enabled should be listed. Directory data must be served from the central platform database without opening a tenant database.

The current `/churches` route renders no sample listings. It queries `/api/public/churches` and shows an unavailable state if the API cannot provide a safe response. Search currently accepts a free-text query; the backend must apply bounded lengths and rate limits.

## Church registration and code lifecycle

The `/register/church` form gathers church identity, optional city publication consent, and initial administrator details. It sends the request through the Next public API proxy. The canonical API validates and deduplicates the request, hashes the administrator password with the existing Argon2 implementation, creates a pending central church/provisioning job, and returns only a job ID plus an opaque provisioning token. The church never becomes active before successful provisioning.

The church join code is generated atomically with the church record and its provisioning job. It lives in `church_codes` as a shareable, non-sensitive code (one active code per church, enforced by a partial unique index). Church **creation** codes are different: they are stored only as SHA-256 hashes and are consumed when a new church is registered. Never publish either code in the directory, public URLs, logs, or analytics.

After provisioning succeeds, the join code is delivered to the church's privileged users. Super Admin can list every church's active join code, copy it, rotate it, or revoke it. Rotations and revocations are audited without recording the plaintext code.

The UI stores the short-lived provisioning token in `sessionStorage`, not in the URL. It polls status with an `X-Provisioning-Token` header and renders a church code only after a successful status response. Provisioning starts immediately after registration through `after()` and is retried by the daily `/api/super-admin/provision` cron, which is guarded by `PROVISIONING_CRON_SECRET`/`CRON_SECRET`.

## Join code and registration rules

1. A member receives a church join code from the Super Admin or a church administrator.
2. The member opens `/join` and enters the code.
3. The server validates the code against the central `church_codes` table and resolves the active church.
4. The browser stores the code in tab-scoped `sessionStorage` and redirects to `/register?church=<slug>`.
5. The registration page re-validates the code, confirms it belongs to the requested church, and shows the church name.
6. The member may register as a servant or class leader. Those accounts are activated immediately without email verification.
7. To register as an administrator or priest, the member must also enter that church's matching role code. The server checks the code's purpose, church, revocation, and expiration before assigning the privileged role; privileged roles do not receive a class or grade assignment.

A church join code or directory selection only identifies the church; neither grants a privileged role. Role codes are distinct per church and are held and managed by the Super Admin. Platform administrators are not church administrators by default.

## Identity model decision

The target model is a central person/identity record keyed by a verified normalized email (and explicit account-link verification), with per-church membership records that point to each tenant-local user UUID. Existing tenant user UUIDs remain unchanged during the first migration. Do not silently merge accounts based on name or unverified contact information. Identity linking and the migration of credentials/session behavior require a separate tested API implementation before cross-church account access is enabled.

## Current integration state

The directory and join routes call the allowlisted Next-to-Nest API proxy for directory lookup and membership requests. When no Nest API URL is configured, public code lookup uses the central `church_codes` table directly; `/api/auth/church-code` validates join codes. A matched code links to `/register` with the church slug; the code is passed through tab-scoped session storage, not a URL, and registration rejects a slug that does not match the centrally resolved code. Registration activates accounts immediately without sending email verification; the email stays unverified until a successful password-reset code proves mailbox access.

The Super Admin dashboard has separate controls for church creation codes, join codes, administrator registration codes, and priest registration codes. Each church has one active code per purpose. The codes can be copied, rotated, or revoked, and management mutations are audited without recording the plaintext code. Revocation prevents new registrations using that code and does not alter existing users.

The visitor API proxy now bounds search/body size, rejects non-JSON writes, discards upstream error bodies, and filters successful payloads to allowlisted directory, provisioning, code-lookup, and Preview fields. The join page validates the code and redirects directly to the church's servant registration page; there is no separate membership-request approval step in the current legacy flow.

Church provisioning is implemented in `src/server/platform/provisioning.ts`. New registrations trigger it immediately after the HTTP response, and a guarded daily cron retries queued or failed jobs. A church becomes `active` only after its tenant database, migrations, identity row, initial administrator, entitlements, and tenant connection are all verified.
