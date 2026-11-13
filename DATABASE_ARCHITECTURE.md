# Database Architecture

**Status:** Current multi-tenant architecture. The platform schema in `db/platform` is applied to the dedicated `sunday_platform` database, and the founding church operates from its existing `neondb` tenant database. Verify any environment with `npm run db:verify:platform -- --deep` before relying on this description.

## Target database ownership

### Central platform database

Store only platform records: church registry and verification/publication fields; tenant database connection references; provisioning jobs; platform administrators and refresh sessions; global Preview configuration; plans, subscriptions, features and entitlements; add-ons, invoices and payment records; verified lifetime-free grants; and platform audit logs.

Do not put children, servants, classes, attendance, reservations, visitation/care information, or church operational notifications in the central database.

### One database per church

Each church database owns its users, roles, permissions, children, servants, classes, attendance, attendance sessions, educational progress, notes, visitations, follow-ups, activities, news, notifications, settings, and other existing operational data. Future reservation/activity entities belong in the tenant database when implemented. Tenant-local record UUIDs and relationships must be preserved during the first migration.

## SQL currently present in the Next repository

The `db/platform` directory contains schema and seed SQL for platform migrations, platform admins/sessions, churches, tenant connections, provisioning jobs, settings, plans, subscriptions, features, entitlements, add-ons, invoices, payments, lifetime-free grants, and audit logs. The seed leaves official Preview dates, support contact, and legal versions unset; the platform owner must configure verified values centrally before provisioning.

The `db/tenant` directory contains a baseline with users, refresh tokens, OTP codes, classes, servants, children, attendance, progress, notes, visitations, follow-up rules/records/activities, news, notifications, audit logs, and Friday preparations. Additional SQL adds roles, permissions, user-role assignments, church settings, identity mapping, and tenant auth structures.

The separate Nest repository also has TypeORM migration files. The two migration histories and schema definitions have not been reconciled. Select one authoritative migration path before implementation continues; do not maintain divergent schemas.

## Isolation and connection rules

- The platform database URL must be configured explicitly through `PLATFORM_DATABASE_URL`. Production must not fall back to the tenant `DATABASE_URL`, and the app rejects a platform URL that resolves to the tenant database.
- The platform registry resolves a tenant database reference only after the API validates the authenticated identity and membership.
- Keep a tenant data source keyed by a verified registry record; never select a tenant using an untrusted `church_id` request field.
- Do not use a shared mutable connection whose database changes per request.
- Do not expose database URLs or connection identifiers in public results, logs, analytics, or errors.
- Apply tenant migrations and role seeds before activating a church.

## Migration safeguards

No production migration or record movement has been executed. Before moving the existing church:

1. Identify the source database and create an encrypted, restorable backup.
2. Inventory every table, foreign key, index, enum, trigger, and relationship.
3. Rehearse additive migration and data copy in an isolated environment.
4. Preserve UUIDs and verify source/destination counts and relationship integrity.
5. Test authentication and critical workflows against the isolated tenant.
6. Document rollback and retain the original database.
7. Require explicit approval before any production migration or data movement.
