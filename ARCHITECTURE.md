# Platform Architecture

**Status:** Current-state documentation for the multi-church transformation. The intended database-per-tenant architecture is not yet operational.

## Repositories and runtime

The product is split across two repositories on `feature/multi-church-preview-platform`:

- `sunday-client` is the Next.js App Router frontend. It contains public pages, authenticated church pages, existing Next route handlers, and pre-existing PostgreSQL/Neon helper code.
- `sunday-school-api` is the NestJS + TypeORM API. It owns the established operational modules for users, servants, classes, children, attendance, visitations, news, and uploads. Its worktree has extensive uncommitted changes, including removed authentication files; preserve these changes and do not treat the API as verified or deployable.

The current Nest application configures a single unnamed PostgreSQL TypeORM connection for the existing operational schema. It does not yet resolve a central platform data source and a tenant-specific operational data source per request.

The frontend routes include the existing `/login`, `/register`, `/verify-otp`, `/forgot-password`, and `/reset-password` journeys; church operations include dashboard, children, classes, attendance, servants, follow-ups, analytics, news, notifications, Friday preparation, and profile screens. The new visitor routes are `/`, `/register/church`, `/register/church/provisioning`, `/churches`, `/join`, `/privacy`, and `/terms`.

## Current public request path

```text
Browser → Next.js public route → allowlisted /api/public/* proxy → Nest API (planned)
```

The proxy uses `NEST_API_URL` or the existing `NEXT_PUBLIC_API_URL` as its base. It does not query church databases. It bounds request size, accepts JSON writes only, strips upstream error bodies, and filters successful responses to public fields. The Nest endpoints and central platform database are not implemented in this pass; visitor data actions remain unavailable until they exist.

## Intended multi-tenant request path

```text
Browser → Next.js UI → Nest API → verified identity/session
                                  ├── platform PostgreSQL: registry, settings, plans, audit
                                  └── resolved tenant PostgreSQL: church operations
```

The central database must not contain children, attendance, servant records, or other church operations. The API must resolve and bind a tenant from verified server-side identity/membership context before opening the tenant data source. A slug or church code can locate a church for a public request but cannot authorize access. Platform administrators and church administrators remain separate roles.

## Existing functionality to preserve

Preserve current authentication and recovery workflows, Argon2 password hashing, refresh behavior, users and UUIDs, children and child profiles, classes, servant management, attendance, follow-ups, analytics, news, notifications, Friday preparation, profile settings, historical relationships, and existing API integrations. See `UI_UX_DISCOVERY_REPORT.md` for the audited pre-redesign product inventory.

## Architecture decisions still required

1. Make NestJS + TypeORM the canonical API and migration authority; reconcile the existing Next-side SQL/Neon platform work with the API repository.
2. Design central identity/membership mapping while preserving tenant-local user UUIDs.
3. Establish request-scoped tenant data sources and repositories without mutable shared connections.
4. Restore and test the API authentication behavior before replacing any login or refresh path.
5. Rehearse source-to-first-tenant migration and rollback before any production change.

No platform migration or production provisioning has been run.
