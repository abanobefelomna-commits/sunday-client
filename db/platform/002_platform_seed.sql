-- =============================================================================
-- Central platform seed data. Idempotent. Safe to re-run.
-- Preview dates are a bootstrap default only; platform admins own the values.
-- =============================================================================

INSERT INTO "platform_settings" ("key", "value")
VALUES (
  'preview',
  jsonb_build_object(
    'mode', 'PREVIEW',
    'officialLaunchDate', NULL,
    'startDate', NULL,
    'endDate', NULL,
    'subscriptionsEnabled', false,
    'paymentsEnabled', false,
    'headline', 'النسخة التجريبية — ابدأ مجانًا',
    'description', 'فترة تجريبية مجانية لمدة عامين من تاريخ الإطلاق الرسمي. لا تحتاج بطاقة ائتمان.'
  )
)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "platform_settings" ("key", "value")
VALUES (
  'platform',
  jsonb_build_object(
    'registrationEnabled', true,
    'provisioningEnabled', true,
    'supportEmail', '',
    'platformName', 'مدارس الأحد',
    'termsVersion', '',
    'privacyVersion', ''
  )
)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "platform_settings" ("key", "value")
VALUES (
  'billing',
  jsonb_build_object(
    'provider', 'none',
    'enabled', false,
    'checkoutEnabled', false
  )
)
ON CONFLICT ("key") DO NOTHING;

-- ---------------------------------------------------------------------------
-- Feature catalogue
-- ---------------------------------------------------------------------------
INSERT INTO "features" ("code", "name", "description", "category", "isCore", "availableInPreview")
VALUES
  ('core.children', 'إدارة الأطفال', 'سجل الأطفال والبيانات الأساسية والملاحظات', 'core', true, true),
  ('core.classes', 'الفصول والمراحل', 'إدارة الفصول والمراحل والخدمة', 'core', true, true),
  ('core.attendance', 'الحضور والغياب', 'تسجيل الحضور والتقارير والملخصات', 'core', true, true),
  ('core.servants', 'الخدام', 'إدارة الخدام وتعيين الفصول', 'core', true, true),
  ('core.followups', 'الافتقاد والمتابعة', 'قواعد المتابعة والزيارات والأنشطة', 'core', true, true),
  ('core.news', 'الأخبار', 'نشر أخبار الخدمة', 'core', true, true),
  ('core.notifications', 'التنبيهات', 'تنبيهات المتابعة والحضور', 'core', true, true),
  ('core.reports', 'التقارير', 'تقارير الحضور والخدمة', 'core', true, true),
  ('core.analytics', 'لوحة التحليلات', 'نظرة عامة على الخدمة', 'core', true, true),
  ('core.friday_prep', 'تحضير درس الجمعة', 'تحضير الدروس ومتابعة الجاهزية', 'core', true, true),
  ('core.audit', 'سجل التدقيق', 'سجل التغييرات الحساسة', 'core', true, true),
  ('premium.custom_domain', 'نطاق مخصص', 'ربط نطاق الكنيسة الخاص بها', 'premium', false, false),
  ('premium.advanced_analytics', 'تحليلات متقدمة', 'مؤشرات واتجاهات متقدمة', 'premium', false, false),
  ('premium.advanced_reports', 'تقارير متقدمة', 'تصدير وتقارير تفصيلية', 'premium', false, false),
  ('premium.extra_storage', 'مساحة تخزين إضافية', 'مساحة أكبر للصور والمرفقات', 'premium', false, false),
  ('premium.branding', 'تخصيص الهوية', 'شعار وألوان الكنيسة', 'premium', false, false),
  ('premium.api_access', 'تكامل API', 'تكاملات مخصصة للكنيسة', 'premium', false, false)
ON CONFLICT ("code") DO NOTHING;

-- ---------------------------------------------------------------------------
-- Plans. Paid prices deliberately unset until the platform owners configure
-- them after Preview. No checkout is enabled by this seed.
-- ---------------------------------------------------------------------------
INSERT INTO "subscription_plans"
  ("code", "name", "description", "monthlyPriceCents", "annualPriceCents", "currency", "isActive", "isPublic", "sortOrder")
VALUES
  ('preview', 'النسخة التجريبية', 'وصول مجاني لكل الميزات الأساسية خلال فترة الإطلاق التجريبية', 0, 0, 'EGP', true, true, 0),
  ('standard_monthly', 'الخطة الأساسية — شهري', 'تُفعّل بعد انتهاء النسخة التجريبية', NULL, NULL, 'EGP', false, false, 10),
  ('standard_annual', 'الخطة الأساسية — سنوي', 'تُفعّل بعد انتهاء النسخة التجريبية', NULL, NULL, 'EGP', false, false, 11)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "plan_features" ("planId", "featureCode", "enabled")
SELECT p."id", f."code", true
FROM "subscription_plans" p
CROSS JOIN "features" f
WHERE p."code" = 'preview' AND f."isCore" = true
ON CONFLICT ("planId", "featureCode") DO NOTHING;

INSERT INTO "add_ons" ("code", "name", "description", "featureCode", "priceCents", "billingCycle", "isActive")
VALUES
  ('custom_domain', 'نطاق مخصص', 'ربط نطاق الكنيسة', 'premium.custom_domain', NULL, 'monthly', false),
  ('extra_storage', 'مساحة تخزين إضافية', 'زيادة مساحة الصور', 'premium.extra_storage', NULL, 'monthly', false),
  ('advanced_reports', 'تقارير متقدمة', 'تقارير وتصدير متقدم', 'premium.advanced_reports', NULL, 'monthly', false)
ON CONFLICT ("code") DO NOTHING;
