-- =============================================================================
-- Tenant RBAC + settings. Idempotent. One role definition per church, many users.
-- Existing users.role values are preserved; RBAC is additive and backfilled.
-- =============================================================================

CREATE TABLE IF NOT EXISTS "permissions" (
  "code" varchar(80) PRIMARY KEY,
  "name" varchar(160) NOT NULL,
  "description" text,
  "category" varchar(40) NOT NULL DEFAULT 'general',
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "roles" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "code" varchar(40) NOT NULL UNIQUE,
  "name" varchar(160) NOT NULL,
  "description" text,
  "isSystem" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "role_permissions" (
  "roleId" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "permissionCode" varchar(80) NOT NULL REFERENCES "permissions"("code") ON DELETE CASCADE,
  PRIMARY KEY ("roleId", "permissionCode")
);

CREATE TABLE IF NOT EXISTS "user_roles" (
  "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "roleId" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "assignedBy" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "assignedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("userId", "roleId")
);
CREATE INDEX IF NOT EXISTS "IDX_user_roles_role" ON "user_roles" ("roleId");

CREATE TABLE IF NOT EXISTS "church_settings" (
  "key" varchar(80) PRIMARY KEY,
  "value" jsonb NOT NULL,
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "tenant_identity" (
  "churchId" uuid PRIMARY KEY,
  "slug" varchar(63) NOT NULL UNIQUE,
  "provisionedAt" timestamptz NOT NULL DEFAULT now(),
  "schemaVersion" varchar(20) NOT NULL DEFAULT '1'
);

CREATE TABLE IF NOT EXISTS "tenant_migrations" (
  "name" varchar(160) PRIMARY KEY,
  "appliedAt" timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Permission catalogue
-- ---------------------------------------------------------------------------
INSERT INTO "permissions" ("code", "name", "description", "category")
VALUES
  ('children.read', 'قراءة الأطفال', 'عرض سجل الأطفال والملفات', 'children'),
  ('children.write', 'إدارة الأطفال', 'إضافة وتعديل بيانات الأطفال', 'children'),
  ('classes.read', 'قراءة الفصول', 'عرض الفصول والمراحل', 'classes'),
  ('classes.write', 'إدارة الفصول', 'إضافة وتعديل الفصول', 'classes'),
  ('attendance.read', 'قراءة الحضور', 'عرض سجلات الحضور', 'attendance'),
  ('attendance.write', 'تسجيل الحضور', 'تسجيل وتعديل الحضور', 'attendance'),
  ('servants.read', 'قراءة الخدام', 'عرض بيانات الخدام', 'servants'),
  ('servants.write', 'إدارة الخدام', 'إضافة وتعديل الخدام', 'servants'),
  ('followups.read', 'قراءة الافتقاد', 'عرض حالات المتابعة', 'followups'),
  ('followups.write', 'إدارة الافتقاد', 'إنشاء وتحديث حالات المتابعة', 'followups'),
  ('news.read', 'قراءة الأخبار', 'عرض أخبار الخدمة', 'news'),
  ('news.write', 'إدارة الأخبار', 'نشر وتعديل الأخبار', 'news'),
  ('reports.read', 'قراءة التقارير', 'عرض التقارير والتحليلات', 'reports'),
  ('friday_prep.read', 'قراءة تحضير الجمعة', 'عرض تحضير الدروس', 'friday'),
  ('friday_prep.write', 'تحضير الجمعة', 'إنشاء وتحديث تحضير الدروس', 'friday'),
  ('notifications.read', 'قراءة التنبيهات', 'عرض التنبيهات', 'notifications'),
  ('users.read', 'قراءة المستخدمين', 'عرض حسابات الخدام', 'users'),
  ('users.write', 'إدارة المستخدمين', 'إضافة وتعديل الحسابات', 'users'),
  ('roles.manage', 'إدارة الأدوار', 'تعيين الأدوار والصلاحيات', 'roles'),
  ('settings.read', 'قراءة الإعدادات', 'عرض إعدادات الكنيسة', 'settings'),
  ('settings.write', 'إدارة الإعدادات', 'تعديل إعدادات الكنيسة', 'settings'),
  ('audit.read', 'قراءة سجل التدقيق', 'عرض سجل التغييرات', 'audit')
ON CONFLICT ("code") DO NOTHING;

-- ---------------------------------------------------------------------------
-- One canonical role definition per church
-- ---------------------------------------------------------------------------
INSERT INTO "roles" ("code", "name", "description", "isSystem")
VALUES
  ('ADMIN', 'أمين الخدمة', 'إدارة كاملة لبيانات الكنيسة والخدام والإعدادات', true),
  ('PRIEST', 'أب كاهن', 'وصول كامل للبيانات والتقارير', true),
  ('SUPERVISOR', 'مشرف', 'إدارة الفصول والخدام والمتابعة', true),
  ('CLASS_LEADER', 'قائد فصل', 'إدارة فصل معين ومتابعة أطفاله', true),
  ('SERVANT', 'خادم', 'تسجيل الحضور ومتابعة الأطفال', true)
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "description" = EXCLUDED."description";

INSERT INTO "role_permissions" ("roleId", "permissionCode")
SELECT r."id", p."code"
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."code" IN ('ADMIN', 'PRIEST')
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionCode")
SELECT r."id", p."code"
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."code" = 'SUPERVISOR'
  AND p."code" IN (
    'children.read', 'children.write', 'classes.read', 'classes.write',
    'attendance.read', 'attendance.write', 'servants.read', 'servants.write',
    'followups.read', 'followups.write', 'news.read', 'news.write',
    'reports.read', 'friday_prep.read', 'friday_prep.write',
    'notifications.read', 'users.read', 'settings.read'
  )
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionCode")
SELECT r."id", p."code"
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."code" = 'CLASS_LEADER'
  AND p."code" IN (
    'children.read', 'children.write', 'classes.read', 'attendance.read',
    'attendance.write', 'servants.read', 'followups.read', 'followups.write',
    'news.read', 'reports.read', 'friday_prep.read', 'friday_prep.write',
    'notifications.read'
  )
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionCode")
SELECT r."id", p."code"
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."code" = 'SERVANT'
  AND p."code" IN (
    'children.read', 'children.write', 'classes.read', 'attendance.read',
    'attendance.write', 'servants.read', 'followups.read', 'followups.write',
    'news.read', 'friday_prep.read', 'friday_prep.write', 'notifications.read'
  )
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Backfill one effective role for existing users, preserving legacy access.
-- ---------------------------------------------------------------------------
INSERT INTO "user_roles" ("userId", "roleId")
SELECT u."id", r."id"
FROM "users" u
LEFT JOIN "servants" s
  ON s."phone" = u."phone" OR (s."email" IS NOT NULL AND s."email" = u."email")
JOIN "roles" r ON r."code" = CASE
  WHEN u."role" = 'admin' THEN 'ADMIN'
  WHEN u."role" = 'priest' THEN 'PRIEST'
  WHEN s."role" = 'مسؤول' THEN 'ADMIN'
  WHEN s."role" = 'أب كاهن' THEN 'PRIEST'
  WHEN s."role" IN ('مشرف', 'خادم رئيسي') THEN 'SUPERVISOR'
  WHEN s."role" = 'قائد فصل' THEN 'CLASS_LEADER'
  ELSE 'SERVANT'
END
ON CONFLICT ("userId", "roleId") DO NOTHING;

-- ---------------------------------------------------------------------------
-- Church settings defaults
-- ---------------------------------------------------------------------------
INSERT INTO "church_settings" ("key", "value")
VALUES
  ('site.name', '"مدارس الأحد"'::jsonb),
  ('site.locale', '"ar"'::jsonb),
  ('site.timezone', '"Africa/Cairo"'::jsonb),
  ('members.signupEnabled', 'true'::jsonb),
  ('branding.primaryColor', '"#3b6ff5"'::jsonb),
  ('preview.bannerDismissed', 'false'::jsonb)
ON CONFLICT ("key") DO NOTHING;
