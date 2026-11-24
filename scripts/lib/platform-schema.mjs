/**
 * Required central-platform schema. Keep this list aligned with
 * db/platform/001_platform_schema.sql.
 */
export const REQUIRED_PLATFORM_TABLES = [
  'add_ons',
  'church_add_ons',
  'church_codes',
  'church_creation_codes',
  'church_entitlements',
  'churches',
  'features',
  'invoices',
  'lifetime_free_grants',
  'payments',
  'plan_features',
  'platform_admins',
  'platform_audit_logs',
  'platform_migrations',
  'platform_refresh_tokens',
  'platform_settings',
  'provisioning_jobs',
  'subscription_events',
  'subscription_plans',
  'subscriptions',
  'super_admin_auth_attempts',
  'super_admin_credentials',
  'super_admin_sessions',
  'tenant_connections',
];

export const REQUIRED_PLATFORM_COLUMNS = {  churches: [
    'id',
    'slug',
    'name',
    'normalizedName',
    'contactName',
    'contactEmail',
    'status',
    'verificationStatus',
    'isLifetimeFree',
    'primaryDomain',
    'customDomain',
    'settings',
    'databaseProvider',
    'databaseName',
    'databaseHost',
    'provisionedAt',
    'activatedAt',
    'suspendedAt',
    'creationCodeId',
    'creatorName',
    'creatorEmail',
    'createdAt',
    'updatedAt',
  ],
  tenant_connections: [
    'churchId',
    'provider',
    'encryptedUrl',
    'urlFingerprint',
    'databaseName',
    'databaseHost',
  ],
  church_codes: ['id', 'churchId', 'code', 'purpose', 'revoked', 'expiresAt', 'createdAt', 'updatedAt'],
  church_creation_codes: ['id', 'codeHash', 'codePrefix', 'status', 'createdAt'],
  super_admin_auth_attempts: ['id', 'ipHash', 'action', 'success', 'createdAt'],
  super_admin_credentials: ['id', 'isSingleton', 'passwordHash', 'setupCompletedAt'],
  super_admin_sessions: ['id', 'sessionTokenHash', 'refreshTokenHash', 'expiresAt'],
  platform_settings: ['key', 'value'],
  platform_migrations: ['name', 'appliedAt'],
};

/**
 * Tenant-side schema required by the current application code. Kept minimal on
 * purpose: `db:verify:platform --deep` checks these on each registered tenant.
 */
export const REQUIRED_TENANT_COLUMNS = {
  tenant_identity: ['churchId', 'slug'],
  classes: ['id', 'churchId', 'name', 'nameKey', 'grade', 'isActive', 'sortOrder', 'leadServantId', 'deletedAt'],
  users: ['id', 'role', 'servantRole'],
  children: ['id', 'classId'],
  attendance: ['id', 'childId', 'classId'],
  servant_attendance: ['id', 'servantId', 'classId', 'date', 'status'],
  class_promotions: ['id', 'childId', 'fromClassId', 'toClassId', 'academicYear'],
  notifications: ['id', 'userId'],
};
