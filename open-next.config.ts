import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * DeviceTry on Cloudflare Workers via the official OpenNext adapter.
 * Default config: cache-free ISR/SSG handling suitable for this fully
 * static-prerendered app (50/50 pages prerender at build time; only
 * /api/ip is dynamic and runs in the Worker itself).
 */
export default defineCloudflareConfig();
