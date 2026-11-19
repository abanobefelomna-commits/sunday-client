-- =============================================================================
-- Migration 009: Church invitation code notifications
-- Allows privileged users to receive the church invitation code as an in-app
-- notification, and adds a preference to control that notification.
-- Safe, additive, idempotent.
-- =============================================================================

ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_type_check";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_check"
  CHECK ("type" IN (
    'follow_up_assigned',
    'follow_up_overdue',
    'follow_up_completed',
    'attendance_alert',
    'church_code'
  ));

ALTER TABLE "notification_preferences"
  ADD COLUMN IF NOT EXISTS "churchCode" boolean NOT NULL DEFAULT true;

INSERT INTO "tenant_migrations" ("name") VALUES ('009_church_code_notifications')
ON CONFLICT ("name") DO NOTHING;
