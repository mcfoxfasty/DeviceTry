import { IDatabaseAdapter } from './types';
import { D1Database, D1DatabaseAdapter } from './d1-adapter';
import { LocalDatabaseAdapter } from './local-adapter';

export * from './types';

let dbInstance: IDatabaseAdapter | null = null;
const localFallback = new LocalDatabaseAdapter();

/**
 * Returns the authoritative database adapter for the current runtime.
 * Seamlessly uses Cloudflare D1 in Workers runtime, or Local in-memory adapter in development and testing.
 */
export function getDb(): IDatabaseAdapter {
  if (dbInstance) return dbInstance;

  // Check for Cloudflare D1 DB binding in global or env
  const globalObj = globalThis as unknown as { DB?: D1Database; process?: { env?: { DB?: D1Database } } };
  const d1Binding = globalObj.DB || (typeof process !== 'undefined' && process.env?.DB);

  if (d1Binding && typeof (d1Binding as D1Database).prepare === 'function') {
    dbInstance = new D1DatabaseAdapter(d1Binding as D1Database);
    return dbInstance;
  }

  // Local fallback adapter
  return localFallback;
}

export const db = new Proxy({} as IDatabaseAdapter, {
  get(_target, prop) {
    const instance = getDb();
    const val = (instance as unknown as Record<string, unknown>)[prop as string];
    if (typeof val === 'function') {
      return val.bind(instance);
    }
    return val;
  },
});

export { localFallback };
