import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * DeviceTry on Cloudflare Workers via the official OpenNext adapter.
 * Default config: no cache adapter, which this app does not need. Every page is
 * prerendered at build time and served as static output EXCEPT the ones that read
 * the repository per request: /guides (the hub, which merges in CMS articles the
 * build has not seen), /guides/[slug] for a slug no build has seen, and the admin
 * routes. Those render in the Worker, and the dummy incremental cache's errors are
 * ignorable (canIgnore), so an on-demand render of an unknown slug is a page rather
 * than a 404 — see app/guides/[slug]/page.tsx and lib/articles/registry.ts.
 */
export default defineCloudflareConfig();
