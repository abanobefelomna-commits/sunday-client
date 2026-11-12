import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContext {
  churchId: string;
  slug: string;
  name: string;
  status: 'active' | 'suspended' | 'pending' | 'provisioning' | 'failed' | 'archived';
  verificationStatus: string;
  isLifetimeFree: boolean;
  connectionString: string;
  databaseName: string | null;
  databaseHost: string | null;
  timezone: string;
}

const storage = new AsyncLocalStorage<TenantContext>();

export class TenantContextMissingError extends Error {
  code = 'TENANT_CONTEXT_MISSING';
  constructor() {
    super('Tenant context is not established for this request');
  }
}

export function runWithTenant<T>(context: TenantContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(context, fn);
}

export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

export function requireTenantContext(): TenantContext {
  const context = storage.getStore();
  if (!context) throw new TenantContextMissingError();
  return context;
}
