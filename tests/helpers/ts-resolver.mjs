import { existsSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CANDIDATE_SUFFIXES = ['.ts', '.tsx', '.mts', '/index.ts', '/index.tsx'];

/**
 * Resolve extensionless relative imports the way the Next.js bundler does.
 * Only runs after Node's own resolver fails, so normal ESM resolution keeps
 * precedence.
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) throw error;
    if (!context.parentURL?.startsWith('file:')) throw error;

    const base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
    for (const suffix of CANDIDATE_SUFFIXES) {
      const candidate = `${base}${suffix}`;
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }

    throw error;
  }
}
