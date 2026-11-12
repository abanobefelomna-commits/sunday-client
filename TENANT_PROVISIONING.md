# Tenant Provisioning

**Status:** The public registration/provisioning screens are present; the Nest provisioning service and platform database are not operational yet.

## Required lifecycle

1. Validate church identity, initial administrator details, and required policy consent.
2. Apply rate limits and duplicate-registration checks with a stable idempotency key.
3. Create a central church record in a non-active state and a provisioning job.
4. Allocate a unique tenant identifier and dedicated PostgreSQL database.
5. Apply the versioned tenant migrations and seed permissions plus one definition for each standard role.
6. Create the initial church administrator in the tenant database with a verified identity and a server-generated UUID.
7. Store the tenant connection reference securely and create an auditable, non-guessable church lookup code.
8. Mark the church active only after every prior step succeeds.
9. Return a short-lived provisioning status credential to the registering administrator. Reveal the church code only after successful provisioning and authorized status verification.

## Failure and retry behavior

- Persist each stage and its attempt count; retries must be idempotent.
- Never duplicate a database, church record, role definition, administrator, or invitation code during a retry.
- On failure, keep the church non-active, retain an auditable failure state, and allow a safe retry or operator remediation.
- Do not return raw infrastructure errors to visitors. Record sanitized diagnostic identifiers in protected server logs.
- Database cleanup after partial provisioning must be an explicit, reviewed compensation action; never silently drop a database as a retry strategy.

## Current frontend contract

`/register/church` posts to `/api/public/church-registrations`. The UI expects a UUID `jobId` and an opaque `provisioningToken`; it stores the token in `sessionStorage` and navigates to `/register/church/provisioning?jobId=...`. The status page polls the matching allowlisted GET route and displays a church code only when the status is `succeeded`.

The Next proxy validates response shapes and strips arbitrary server fields. The Nest endpoints, tenant database creation, migrations, role seeding, initial admin creation, and code lifecycle have not been implemented or tested. A form submission must not be described as a completed registration until that API work exists.
