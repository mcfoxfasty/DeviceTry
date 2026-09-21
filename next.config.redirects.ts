import { ROUTE_MIGRATIONS } from './lib/tools/migration';

/**
 * Redirect wiring for the Phase 9 route migration map, extracted from
 * next.config.ts so tests can assert every old route is redirected exactly
 * once with the correct destination, tab deep link, and permanence.
 */
export function nextRedirects(): Array<{ source: string; destination: string; permanent: boolean }> {
  return ROUTE_MIGRATIONS.map((m) => ({
    source: `/test/${m.from}`,
    destination: m.tab ? `/test/${m.destination}?tab=${m.tab}` : `/test/${m.destination}`,
    permanent: true,
  }));
}
