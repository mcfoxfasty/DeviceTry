import type {NextConfig} from 'next';
import {nextRedirects} from './next.config.redirects';

/**
 * The production site URL is defined ONCE in lib/site.ts (validated
 * NEXT_PUBLIC_SITE_URL; no assumed domain fallback). Sitemap, robots, layout
 * metadata, and guide pages import it from there — not from this file.
 */

const nextConfig: NextConfig = {
  // Phase 9 route migrations: permanent 308s from old tool routes to their
  // merged/reorganized destinations (deep-linking tabs via ?tab=...).
  async redirects() {
    return nextRedirects();
  },
  reactStrictMode: true,
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
