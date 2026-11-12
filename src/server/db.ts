import { neon } from '@neondatabase/serverless';
import { requireTenantContext } from './tenant/context';

const clients = new Map<string, ReturnType<typeof neon>>();
const MAX_CLIENTS = 100;

function getConnectionString(): string {
  const tenant = requireTenantContext();
  return tenant.connectionString;
}

export function getDb() {
  const url = getConnectionString();
  let client = clients.get(url);
  if (!client) {
    if (clients.size >= MAX_CLIENTS) clients.clear();
    client = neon(url);
    clients.set(url, client);
  }
  return client;
}

function isRetryable(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code || '';
  const message = error instanceof Error ? error.message : '';
  return (
    ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', '57P01', '57P02', '57P03'].includes(code) ||
    /fetch failed|network|timeout|connection terminated|compute time/i.test(message)
  );
}

/**
 * Execute a parameterized SQL query against the authenticated tenant database.
 * The tenant connection is resolved by the route wrapper and stored in
 * AsyncLocalStorage; callers cannot select a church through query parameters.
 */
export async function query<T = Record<string, unknown>>(
  sqlText: string,
  params: unknown[] = [],
  retries = 2,
): Promise<T[]> {
  const sql = getDb();
  let attempt = 0;

  for (;;) {
    try {
      const rows = await sql.query(sqlText, params);
      return rows as T[];
    } catch (error) {
      attempt += 1;
      if (attempt > retries || !isRetryable(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
}

export async function queryOne<T = Record<string, unknown>>(
  sqlText: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sqlText, params);
  return rows.length > 0 ? rows[0] : null;
}

export interface TransactionStatement {
  text: string;
  params?: unknown[];
}

/**
 * Run multiple parameterized statements atomically using Neon's HTTP
 * transaction API. Returns one result array per statement, in order.
 */
export async function transaction<T = Record<string, unknown>>(
  statements: TransactionStatement[],
  retries = 1,
): Promise<T[][]> {
  if (statements.length === 0) return [];
  const sql = getDb();
  let attempt = 0;

  for (;;) {
    try {
      const queries = statements.map((statement) =>
        sql.query(statement.text, statement.params ?? []),
      );
      const results = await (sql as unknown as {
        transaction: (queries: unknown[]) => Promise<T[][]>;
      }).transaction(queries);
      return results;
    } catch (error) {
      attempt += 1;
      if (attempt > retries || !isRetryable(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
}
