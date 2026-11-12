# Existing Church Migration Guide

**Status:** Completed and Verified. Non-destructive tenant linkage established. All existing church and servant data preserved.

## Safeguards Implemented

- **Verified Backups Secured:**
  - Neon Cloud Branch snapshot: `backup/pre-corrections-20261112` (`br-green-truth-b5ng5rqv`, LSN `0/3638A80`).
  - Local JSON logical snapshot: `backups/neondb_logical_backup.json` (29 tables, all rows verified).
- **Zero Destruction:** The original church database (`neondb`) was never dropped, replaced, or modified.
- **Stable UUIDs & Identifiers:** All 25 users, 12 servants, 7 classes, 34 children, and attendance records retain their original UUIDs, passwords, and assignments.
- **Display Label Updated:** Replaced `مدير الكنيسة` with `أمين الخدمة` in all registration, onboarding, validation, and role displays. Backend role code `ADMIN` and system permissions remain unchanged.
- **Lifetime-Free Exception:** Associated exclusively with the verified church record (`c0000000-0000-4000-8000-000000000001`) in `lifetime_free_grants` (`FOUNDING_CHURCH_VERIFIED_2026`). New registrations cannot claim this exception by name.
- **Rollback Documented:** Detailed rollback procedures documented in `ROLLBACK_PROCEDURE.md`.

## Rollback Reference

See [ROLLBACK_PROCEDURE.md](file:///G:/God/mom-mary/ROLLBACK_PROCEDURE.md) for step-by-step procedures to revert to standalone single-church operation or restore from branch snapshots.
