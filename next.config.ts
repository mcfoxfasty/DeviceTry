import type {NextConfig} from 'next';
import {nextRedirects} from './next.config.redirects';
import {securityHeaders} from './lib/security/headers';

/**
 * The production site URL is defined ONCE in lib/site.ts (validated
 * NEXT_PUBLIC_SITE_URL; no assumed domain fallback). Sitemap, robots, layout
 * metadata, and guide pages import it from there — not from this file.
 */

const nextConfig: NextConfig = {
  // ISOLATED PRODUCTION BUILDS (2026-09-22): the managed preview session can
  // restart `next dev` mid-`next build`, and dev compilation of the SAME
  // distDir deletes the per-route page.js.nft.json files the build's trace
  // collector then reads (evidence: ENOENT .../_not-found/page.js.nft.json;
  // dev-only artifacts under .next/static/development with mtimes inside the
  // build window). Pointing build runs at a separate distDir via NEXT_DIST_DIR
  // makes verification builds immune to preview interference; normal
  // dev/preview (NEXT_DIST_DIR unset) keeps using .next unchanged.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Phase 9 route migrations: permanent 308s from old tool routes to their
  // merged/reorganized destinations (deep-linking tabs via ?tab=...).
  async redirects() {
    return nextRedirects();
  },
  reactStrictMode: true,
  // Do not advertise the framework and its version on every response. Nothing
  // on this site needs X-Powered-By, and removing it costs no functionality.
  poweredByHeader: false,
  // Security headers are defined once, in lib/security/headers.ts, together
  // with the reasoning for each source in the CSP. They are applied here —
  // the application level — because that is where every response that Next.js
  // serves passes, and it is the only level that also applies to `next start`
  // in staging, so the policy can actually be observed here before the
  // Cloudflare build is cut. HSTS is intentionally absent until the production
  // domain exists (see lib/security/headers.ts).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders(),
      },
    ];
  },
  // LINT ENFORCEMENT (2026-09-21): this 2 GiB container OOM-killed two
  // production builds when Next's in-build lint worker ran alongside the
  // resident compile worker (evidence: "Cannot find module for page" ENOENT
  // storms after a successful compile + memory.events max 611 / oom 15 /
  // oom_kill 1). Lint is therefore enforced as a hard gate in the project's
  // `verify` script — `bun run verify` runs lint, tests, typecheck, and the
  // build; the build does not pass verification without lint exiting 0.
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  experimental: {
    // 2 GiB cgroup: static-generation workers inherit the NODE_OPTIONS heap
    // cap and run alongside the resident compile process. Two concurrent
    // workers (cpus: 2) OOM-killed the build at page-data collection after
    // the 2026-09-22 workspace restore (memory.peak = exactly 2147483648,
    // memory.events oom_kill 1, "Cannot find module for page" ENOENT storm).
    // Serializing to ONE worker keeps the aggregate peak inside the limit.
    // Documented deviation from the earlier cpus: 2 setting in
    // docs/phase9-migration.md — lint, types, and tests remain fully enforced.
    cpus: 1,
  },
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
