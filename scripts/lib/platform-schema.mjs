/**
 * Required central-platform schema. Keep this list aligned with
 * db/platform/001_platform_schema.sql.
 */
export const REQUIRED_PLATFORM_TABLES = [
  'add_ons',
  'church_add_ons',
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
  platform_settings: ['key', 'value'],
  platform_migrations: ['name', 'appliedAt'],
};

/**
 * Tenant-side schema required by the current application code. Kept minimal on
 * purpose: `db:verify:platform --deep` checks these on each registered tenant.
 */
export const REQUIRED_TENANT_COLUMNS = {
  tenant_identity: ['churchId', 'slug'],
  classes: ['id', 'churchId', 'name', 'nameKey', 'grade', 'isActive', 'sortOrder', 'deletedAt'],
  users: ['id', 'role'],
  children: ['id', 'classId'],
  attendance: ['id', 'childId', 'classId'],
  notifications: ['id', 'userId'],
};
