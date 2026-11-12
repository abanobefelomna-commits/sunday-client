# Church Discovery and Join Flow

## Public directory policy

The directory may return only an allowlisted public church name, city/area when opted in, public description when opted in, and verification status. It must exclude database IDs, connection details, church codes, private contact details, members, users, child records, operational counts, and internal status/error metadata. Only active churches with directory publication enabled should be listed. Directory data must be served from the central platform database without opening a tenant database.

The current `/churches` route renders no sample listings. It queries `/api/public/churches` and shows an unavailable state if the API cannot provide a safe response. Search currently accepts a free-text query; the backend must apply bounded lengths and rate limits.

## Church registration and code lifecycle

The `/register/church` form gathers church identity, optional city publication consent, and initial administrator details. It sends the request through the Next public API proxy. The canonical API must validate and deduplicate the request, hash the administrator password with the existing Argon2 implementation, create a pending central church/provisioning job, and avoid returning an active tenant before successful provisioning.

After successful provisioning, the API should generate a random non-guessable code. Store a verifier/hash rather than plaintext where possible; reveal the code only to the authorized initial administrator after the provisioning token is checked. Codes identify a church for a join request; they are not passwords, login factors, or authorization credentials. Add rotation/revocation with audit actor and timestamp. Never publish the code in the directory, public URLs, logs, or analytics.

The UI stores the short-lived provisioning token in `sessionStorage`, not in the URL. It polls status with an `X-Provisioning-Token` header and renders a church code only after a successful status response. The Nest endpoint and actual code generation are not implemented yet, so the complete onboarding path is pending.

## Join request and membership rules

1. A servant finds an opted-in directory entry or enters a private code.
2. The server returns the church's public identity so the requester can confirm the destination.
3. A signed-in, verified identity submits a request. The server resolves the identity from the verified session, not from a user ID or church ID supplied by the browser.
4. The server records a pending request with target church, requester identity, creation time and audit data. The requester receives a pending status.
5. A church administrator authenticated in the target tenant reviews and approves/rejects. Record decision actor, time and reason. Reject self-approval and role changes supplied by the requester.
6. Only after approval may a tenant-local account/membership and the administrator-assigned permissions become active.

Entering a code or selecting a directory card must never create a membership or grant tenant access. Platform administrators are not church administrators by default.

## Identity model decision

The target model is a central person/identity record keyed by a verified normalized email (and explicit account-link verification), with per-church membership records that point to each tenant-local user UUID. Existing tenant user UUIDs remain unchanged during the first migration. Do not silently merge accounts based on name or unverified contact information. Identity linking and the migration of credentials/session behavior require a separate tested API implementation before cross-church account access is enabled.

## Current integration state

The directory and join routes are built and call the allowlisted Next-to-Nest API proxy. The directory degrades gracefully. Code lookup and join submission are wired to expected API paths but will return unavailable until the Nest public endpoints and central identity/membership tables exist. The current legacy servant registration creates a tenant-local user immediately and therefore must not be used as the new pending-membership flow. Existing `/register` remains unchanged for compatibility.

The visitor API proxy now bounds search/body size, rejects non-JSON writes, discards upstream error bodies, and filters successful payloads to allowlisted directory, provisioning, join, and Preview fields. The join page offers the existing servant registration route after a church has been matched. These are frontend safeguards and routes only; they do not create membership.

The implementation is not complete until the Nest API, tenant provisioning, membership approval UI/API, tenant-bound authorization, notifications, and isolation tests are implemented and run. The real backend path is not yet available.
