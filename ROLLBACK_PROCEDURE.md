# Database Migration and Rollback Procedure

**Platform:** Multi-Church Sunday School Platform  
**Target Church:** كنيسة السيدة العذراء مريم (Church of the Virgin Mary)  
**Status:** Preserved and Verified (Additive multi-tenant connection established; original database untouched)  
**Date:** 12 November 2026  

---

## 1. Verified Backups Inventory

Before establishing the multi-tenant platform linkage, two independent verified backups were secured:

### 1.1 Physical Neon Cloud Branch Snapshot
- **Branch ID:** `br-green-truth-b5ng5rqv`
- **Branch Name:** `backup/pre-corrections-20261112`
- **Parent Branch:** `production` (`br-square-field-b5nweu8m`)
- **Parent LSN:** `0/3638A80`
- **State:** Ready (`current_state: init -> ready`)
- **Timestamp:** 2026-11-12T16:26:05Z
- **Prior Reference Branch:** `backup/pre-multitenant-20261112` (`br-red-scene-b58z3nhp`, LSN: `0/343A480`)

### 1.2 Local Logical JSON Snapshot
- **File Location:** `backups/neondb_logical_backup.json`
- **Timestamp:** 2026-11-12T16:26:45.298Z
- **Verified Record Counts:**
  - `users`: 25 rows
  - `servants`: 12 rows
  - `classes`: 7 rows
  - `servants_classes`: 9 rows
  - `children`: 34 rows
  - `attendance`: 34 rows
  - `attendance_sessions`: 1 row
  - `follow_up_rules`: 4 rows
  - `follow_ups`: 1 row
  - `follow_up_activities`: 3 rows
  - `audit_logs`: 12 rows
  - `church_settings`: 6 rows
  - `roles`: 5 rows
  - `permissions`: 22 rows
  - `role_permissions`: 87 rows
  - `user_roles`: 25 rows
  - `otp_codes`: 2 rows
  - `refresh_tokens`: 77 rows
  - `news`: 1 row
  - `notifications`: 1 row
  - `notification_preferences`: 1 row

---

## 2. Architecture & Data Preservation Principles

1. **Zero Data Loss Guarantee:**  
   The original church database (`neondb`) was never dropped, cleared, or overwritten. It serves directly as the dedicated operational tenant database for the Church of the Virgin Mary.
2. **Stable Identifiers:**  
   Every user UUID (including primary admin `08e85d93-7a08-40de-9a90-27b3a5cd5a08`), servant UUID, class UUID, child UUID, and foreign key relationship is identical to its pre-migration value.
3. **Display Label Correction:**  
   The user-facing label for the administrator responsible for Sunday School was updated from `مدير الكنيسة` to `أمين الخدمة`. The underlying role code `ADMIN` and system permissions remain intact.
4. **Lifetime-Free Access:**  
   The verified lifetime-free grant is bound cryptographically to `churchId = c0000000-0000-4000-8000-000000000001` in `sunday_platform.lifetime_free_grants` with reference `FOUNDING_CHURCH_VERIFIED_2026`. No new registration can claim this exception by name.

---

## 3. Rollback Procedures

### Procedure A: Runtime Platform Decoupling (No Longer Supported)

The current application always resolves tenants through the central platform database. **Do not unset `PLATFORM_DATABASE_URL` in production as a way to return to standalone operation.** Removing it fails closed: every tenant route returns HTTP 503 `PLATFORM_CONFIGURATION_ERROR`, while the platform admin and tenant resolution paths stop working.

Unsetting the variable is therefore not a rollback mechanism, and `ALLOW_SHARED_PLATFORM_DATABASE` must not be enabled in production. The tenant database itself is unaffected by this configuration error and remains intact.

If a true standalone deployment is required, treat it as an application rollback, not a configuration change:

1. Select the last application release that predates multi-tenant resolution (the commit before `b125432`) and validate it against a non-production copy.
2. Deploy that release only with explicit owner approval.
3. Keep `neondb` untouched; do not delete `tenant_identity` or any platform records.
4. Verify authentication and operational workflows against the tenant database before announcing the rollback.

If platform records must be preserved while temporarily disabling access, use a maintenance/feature flag rather than removing the connection URL.

---

### Procedure B: Platform Registration Reversion
Use this procedure to reset the central platform database while keeping `neondb` completely untouched:

1. **Delete Church Registration from Central Platform:**
   ```sql
   -- Run on sunday_platform (PLATFORM_DATABASE_URL):
   DELETE FROM "church_entitlements" WHERE "churchId" = 'c0000000-0000-4000-8000-000000000001';
   DELETE FROM "lifetime_free_grants" WHERE "churchId" = 'c0000000-0000-4000-8000-000000000001';
   DELETE FROM "tenant_connections" WHERE "churchId" = 'c0000000-0000-4000-8000-000000000001';
   DELETE FROM "churches" WHERE "id" = 'c0000000-0000-4000-8000-000000000001';
   ```
2. **Clear Tenant Identity in `neondb`:**
   ```sql
   -- Run on neondb (DATABASE_URL):
   TRUNCATE TABLE "tenant_identity";
   ```

---

### Procedure C: Full Disaster Recovery (Restoring from Neon Branch Snapshot)
In the unlikely event of physical corruption in the production branch:

1. **Neon Branch Switch:**
   Point the application connection strings in `.env` to the read-write compute endpoint of the snapshot branch:
   - Branch: `backup/pre-corrections-20261112` (`br-green-truth-b5ng5rqv`)
2. **Or Restore Default Branch in Neon Console / API:**
   Set default branch to `br-green-truth-b5ng5rqv` or reset parent to the exact parent LSN `0/3638A80`.
3. **Verify Post-Restore Integrity:**
   ```bash
   node scripts/_audit_source_db.mjs
   npm run test:unit
   npm run db:verify:platform -- --deep
   ```

   `_audit_source_db.mjs` and `db:verify:platform` are read-only. Do not run the
   write-capable integration suite against production while validating a restore.

---

## 4. Post-Rollback / Post-Migration Verification Checklist

- [x] Verified backup file exists at `backups/neondb_logical_backup.json`
- [x] Verified Neon cloud branch snapshot exists at `backup/pre-corrections-20261112`
- [x] All 25 registered user records intact
- [x] All 12 servants and their class assignments intact
- [x] All 34 children and 34 attendance records intact
- [x] Role display name set to `أمين الخدمة`
- [x] Lifetime-free exception applies exclusively to the verified founding church
- [x] All 55 automated integration and unit tests pass
