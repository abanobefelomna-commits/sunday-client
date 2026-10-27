import { neon } from '@neondatabase/serverless';

function getConnectionString(): string {
  const conn = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
  if (!conn) {
    throw new Error('DATABASE_URL is not set in environment variables');
  }
  return conn;
}

export function getDb() {
  const url = getConnectionString();
  return neon(url);
}

/**
 * Execute a parameterized SQL query on Neon Postgres with auto-retry on cold-start suspension.
 * Example: query('SELECT * FROM users WHERE email = $1', [email])
 */
export async function query<T = any>(
  sqlText: string,
  params: any[] = [],
  retries = 2,
): Promise<T[]> {
  const sql = getDb();
  let attempt = 0;

  while (true) {
    try {
      const rows = await sql.query(sqlText, params);
      return rows as T[];
    } catch (err: any) {
      attempt++;
      if (attempt > retries) {
        throw err;
      }
      // Wait 1 second for Neon compute to resume from scale-to-zero
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Execute a query and return the first row or null
 */
export async function queryOne<T = any>(
  sqlText: string,
  params: any[] = [],
): Promise<T | null> {
  const rows = await query<T>(sqlText, params);
  return rows.length > 0 ? rows[0] : null;
}
