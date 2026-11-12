import { neon } from '@neondatabase/serverless';
import { getPlatformDatabaseUrl } from './config';

let client: ReturnType<typeof neon> | null = null;
let clientUrl: string | null = null;

function getClient() {
  const url = getPlatformDatabaseUrl();
  if (!client || clientUrl !== url) {
    client = neon(url);
    clientUrl = url;
  }
  return client;
}

function isRetryable(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code || '';
  const message = error instanceof Error ? error.message : '';
  return (
    ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', '57P01', '57P02', '57P03'].includes(code) ||
    /fetch failed|network|timeout|connection terminated/i.test(message)
  );
}

export async function platformQuery<T = Record<string, unknown>>(
  sqlText: string,
  params: unknown[] = [],
  retries = 2,
): Promise<T[]> {
  const sql = getClient();
  let attempt = 0;
  for (;;) {
    try {
      return (await sql.query(sqlText, params)) as T[];
    } catch (error) {
      attempt += 1;
      if (attempt > retries || !isRetryable(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
}

export async function platformQueryOne<T = Record<string, unknown>>(
  sqlText: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await platformQuery<T>(sqlText, params);
  return rows[0] ?? null;
}

export interface PlatformStatement {
  text: string;
  params?: unknown[];
}

export async function platformTransaction<T = Record<string, unknown>>(
  statements: PlatformStatement[],
): Promise<T[][]> {
  if (statements.length === 0) return [];
  const sql = getClient();
  const queries = statements.map((statement) => sql.query(statement.text, statement.params ?? []));
  return (await (sql as unknown as {
    transaction: (queries: unknown[]) => Promise<T[][]>;
  }).transaction(queries)) as T[][];
}
