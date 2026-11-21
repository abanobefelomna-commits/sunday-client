import { register } from 'node:module';

/**
 * The application is written for the Next.js bundler, which resolves
 * extensionless TypeScript imports. `node --test` needs that same resolution
 * when an integration test imports server modules directly.
 */
register('./ts-resolver.mjs', import.meta.url);
