import { neon } from '@neondatabase/serverless';
import { getTenantAdminDatabaseUrl } from './config';

export interface TenantDatabaseResult {
  provider: 'postgres' | 'neon-project' | 'manual';
  connectionString: string;
  databaseName: string;
  databaseHost: string;
  resourceId: string | null;
  created: boolean;
}

export interface TenantDatabaseProvider {
  readonly name: TenantDatabaseResult['provider'];
  ensureDatabase(input: {
    churchId: string;
    slug: string;
    existingResourceId?: string | null;
  }): Promise<TenantDatabaseResult>;
}

const RESERVED = new Set([
  'postgres', 'template0', 'template1', 'neondb', 'sunday_platform',
]);

export function tenantDatabaseName(slug: string, churchId: string): string {
  const cleaned = slug.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const suffix = churchId.replace(/-/g, '').slice(0, 8);
  let name = `church_${cleaned || 'tenant'}_${suffix}`;
  if (name.length > 63) name = name.slice(0, 63);
  if (RESERVED.has(name)) name = `tenant_${suffix}`;
  return name;
}

function databaseUrlFor(adminUrl: string, databaseName: string): URL {
  const url = new URL(adminUrl);
  url.pathname = `/${databaseName}`;
  return url;
}

export class PostgresAdminProvider implements TenantDatabaseProvider {
  readonly name = 'postgres' as const;

  async ensureDatabase(input: {
    churchId: string;
    slug: string;
    existingResourceId?: string | null;
  }): Promise<TenantDatabaseResult> {
    const adminUrl = getTenantAdminDatabaseUrl();
    const databaseName = input.existingResourceId || tenantDatabaseName(input.slug, input.churchId);
    if (!/^[a-z][a-z0-9_]{2,62}$/.test(databaseName)) {
      throw Object.assign(new Error('Invalid tenant database name'), { code: 'INVALID_DATABASE_NAME' });
    }

    const sql = neon(adminUrl);
    const existing = await sql.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
    let created = false;
    if (existing.length === 0) {
      try {
        await sql.query(`CREATE DATABASE "${databaseName}"`);
        created = true;
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== '42P04') throw error; // duplicate_database -> idempotent retry
        created = false;
      }
    }

    const url = databaseUrlFor(adminUrl, databaseName);
    return {
      provider: 'postgres',
      connectionString: url.toString(),
      databaseName,
      databaseHost: url.hostname,
      resourceId: databaseName,
      created,
    };
  }
}

interface NeonProject {
  id: string;
  name: string;
}

interface NeonCreateResponse {
  project?: NeonProject;
  connection_uris?: Array<{ connection_uri?: string }>;
}

export class NeonProjectProvider implements TenantDatabaseProvider {
  readonly name = 'neon-project' as const;

  private headers(): Record<string, string> {
    const apiKey = process.env.NEON_API_KEY;
    if (!apiKey) {
      throw Object.assign(new Error('NEON_API_KEY is not configured'), { code: 'PROVIDER_NOT_CONFIGURED' });
    }
    return {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`https://console.neon.tech/api/v2${path}`, {
      ...init,
      headers: { ...this.headers(), ...(init.headers || {}) },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      const text = await response.text();
      throw Object.assign(new Error(`Neon API ${response.status}: ${text.slice(0, 200)}`), {
        code: 'NEON_API_ERROR',
      });
    }
    return (await response.json()) as T;
  }

  async ensureDatabase(input: {
    churchId: string;
    slug: string;
    existingResourceId?: string | null;
  }): Promise<TenantDatabaseResult> {
    const projectName = `sunday-${input.slug}-${input.churchId.replace(/-/g, '').slice(0, 6)}`.slice(0, 63);
    let projectId = input.existingResourceId || null;
    let connectionString: string | null = null;

    if (!projectId) {
      const list = await this.request<{ projects?: NeonProject[] }>(
        `/projects?limit=100&search=${encodeURIComponent(projectName)}`,
      );
      const found = (list.projects || []).find((project) => project.name === projectName);
      if (found) projectId = found.id;
    }

    if (!projectId) {
      const orgId = process.env.NEON_ORG_ID;
      const path = orgId ? `/organizations/${orgId}/projects` : '/projects';
      const body: Record<string, unknown> = {
        project: {
          name: projectName,
          pg_version: 16,
          ...(process.env.NEON_REGION_ID ? { region_id: process.env.NEON_REGION_ID } : {}),
        },
      };
      const created = await this.request<NeonCreateResponse>(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      projectId = created.project?.id || null;
      connectionString = created.connection_uris?.[0]?.connection_uri || null;
      if (!projectId) {
        throw Object.assign(new Error('Neon did not return a project id'), { code: 'NEON_PROJECT_MISSING' });
      }
    }

    if (!connectionString) {
      const branches = await this.request<{
        branches?: Array<{ id: string; default?: boolean; primary?: boolean }>;
      }>(`/projects/${projectId}/branches`);
      const branch =
        (branches.branches || []).find((item) => item.default || item.primary) ||
        branches.branches?.[0];
      if (!branch) {
        throw Object.assign(new Error('Tenant project has no branch'), { code: 'NEON_BRANCH_MISSING' });
      }
      const uri = await this.request<{ uri?: string }>(
        `/projects/${projectId}/connection_uri?branch_id=${encodeURIComponent(branch.id)}&pooled=false`,
      );
      connectionString = uri.uri || null;
    }

    if (!connectionString) {
      throw Object.assign(new Error('Neon did not return a connection URI'), {
        code: 'NEON_CONNECTION_URI_MISSING',
      });
    }

    const parsed = new URL(connectionString);
    return {
      provider: 'neon-project',
      connectionString,
      databaseName: parsed.pathname.replace(/^\//, '') || 'neondb',
      databaseHost: parsed.hostname,
      resourceId: projectId,
      created: false,
    };
  }
}

export class ManualDatabaseProvider implements TenantDatabaseProvider {
  readonly name = 'manual' as const;
  async ensureDatabase(): Promise<TenantDatabaseResult> {
    throw Object.assign(
      new Error(
        'Automatic provisioning is disabled. Configure TENANT_PROVISIONING_PROVIDER=postgres or neon-project, or attach an existing database.',
      ),
      { code: 'PROVIDER_NOT_CONFIGURED' },
    );
  }
}
