'use client';

import { makePage } from '@keystatic/next/ui/app';
import keystaticConfig from '../../keystatic.config';

/**
 * The Keystatic admin, mounted as a client component.
 *
 * WHY THIS FILE EXISTS, AND WHY IT CARRIES 'use client'.
 * `makePage` builds the dashboard from `@keystatic/core/ui`, and that package
 * ships two builds. The server build of the component is deliberately a stub:
 *
 *     function Keystatic(props) {
 *       if (props.config.storage.kind === 'github') assertValidRepoConfig(...);
 *       return null;
 *     }
 *
 * The admin is a browser application — it signs in with GitHub, reads and writes
 * this repository through app/api/keystatic/[...params]/route.ts, and renders its
 * own editor — so the server answers "nothing to draw" and the CLIENT is meant to
 * paint the real interface. That only happens when this module is in the client
 * graph, and 'use client' is what puts it there.
 *
 * WITHOUT IT: nothing throws. The route stays entirely server-rendered, the stub
 * returns null, the route's client chunk builds to an empty 163-byte shell with
 * no Keystatic code in it, and the browser never requests a thing — /keystatic
 * then serves a perfectly healthy 200 whose body contains only a screen-reader
 * skip link on a dark background. No console error, no failed request, no CSP
 * violation: just a blank screen, which is exactly what made this hard to see.
 *
 * WHY THE DIRECTIVE IS NOT ON page.tsx: a 'use client' module cannot export
 * `metadata`, and the page exports `metadata` to keep an admin dashboard out of
 * search results (`robots: { index: false }`). Keeping the page a server
 * component and rendering this from it preserves the noindex while giving the
 * dashboard a client boundary.
 *
 * `keystatic.config.ts` is imported here as well as by the server (the reader in
 * lib/blog/content.ts). That duplication is normal: the schema is what the editor
 * draws its fields from, and it contains no server-only code.
 */
export default makePage(keystaticConfig);
