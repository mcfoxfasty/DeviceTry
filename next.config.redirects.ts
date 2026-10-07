import { ROUTE_MIGRATIONS } from './lib/tools/migration';

/**
 * Redirect wiring for the Phase 9 route migration map, extracted from
 * next.config.ts so tests can assert every old route is redirected exactly
 * once with the correct destination, tab deep link, and permanence.
 *
 * THE `/blog` TREE, kept alive after articles moved to `/guides/<slug>`.
 *
 * Articles were served from `/blog` and now live in the same URL space as the
 * hand-authored guides. A permanent redirect is what keeps every shared link,
 * bookmark and search result from before the move working — and what tells a
 * crawler to move its index to the new address rather than treating the old page
 * and the new one as duplicates.
 *
 * Kept apart from ROUTE_MIGRATIONS because it is a different kind of move: those
 * are tool slugs merged into other tools, this is a whole content tree that
 * changed root.
 */
export function articlePathRedirects(): Array<{ source: string; destination: string; permanent: boolean }> {
  return [
    { source: '/blog', destination: '/guides', permanent: true },
    { source: '/blog/:slug', destination: '/guides/:slug', permanent: true },
  ];
}

export function nextRedirects(): Array<{ source: string; destination: string; permanent: boolean }> {
  return [
    ...ROUTE_MIGRATIONS.map((m) => ({
      source: `/test/${m.from}`,
      destination: m.tab ? `/test/${m.destination}?tab=${m.tab}` : `/test/${m.destination}`,
      permanent: true,
    })),
    ...articlePathRedirects(),
  ];
}
