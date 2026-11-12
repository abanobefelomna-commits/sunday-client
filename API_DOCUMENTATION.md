# API Documentation

**Status:** Current route map and planned public contract. The public platform endpoints listed below are not implemented in NestJS yet.

## Existing application API

The Next.js repository exposes route handlers below `/api` for auth/session operations and current church operations such as users, servants, classes, children, attendance, follow-ups, analytics, news, notifications, Friday preparation, visitations, and uploads. The Nest API has matching operational modules and applies the global `api` prefix in `main.ts`. The separate API worktree has uncommitted authentication deletions; confirm its actual route set before deployment.

## Public visitor proxy contract

The Next route handler is `/api/public/[...segments]`. It permits only the following methods and paths and forwards them to the Nest base URL under `/api/public/`:

| Method | Path | Expected safe result |
|---|---|---|
| `GET` | `/api/public/churches?search=...` | `{ data: [{ slug, name, city, publicDescription, verificationStatus }] }` |
| `GET` | `/api/public/preview` | Allowlisted platform mode, official Preview dates, and subscription/payment flags when configured |
| `POST` | `/api/public/church-registrations` | `{ jobId, provisioningToken }` after an idempotent registration request is accepted |
| `GET` | `/api/public/church-registrations/{uuid}/status` | `{ status, progress?, churchCode? }`; never returns raw infrastructure errors |
| `POST` | `/api/public/church-code/lookup` | `{ church: { slug, name, city, publicDescription, verificationStatus } }` |
| `POST` | `/api/public/join-requests` | `{ status: "pending" }` only after a verified identity creates a request |

The public proxy rejects unlisted paths/methods, search values over 120 characters, non-JSON POSTs, and bodies over 64 KB. It uses `Cache-Control: no-store`, removes upstream error bodies, and rebuilds successful responses from an allowlist. It never forwards cookies or arbitrary request headers.

## Security and localization contract

- A church code or directory slug locates a church; neither is a password or authorization credential.
- Join submission requires the existing authenticated identity. Membership stays pending until a church administrator explicitly approves it.
- Public output excludes database IDs/URLs, connection references, codes, membership lists, child data, and internal administrator metadata.
- UI error messages are localized client-side. Upstream error details must not be passed to the browser.
- Public routes are available without loading a tenant database.

## API work still required

Implement and test the Nest controller/DTO/service layer, central TypeORM schema, provisioning jobs, platform-admin protection, code lifecycle, directory opt-in rules, central identity mapping, approval/rejection audit trail, notifications, rate limiting, tenant-bound sessions, and isolation tests. Do not treat the proxy contract as an operational backend.

The existing Nest repository build passed and its current test suite passed one unit test. That baseline test does not cover any of the public routes or tenant-isolation requirements above.
