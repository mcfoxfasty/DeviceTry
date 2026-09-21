import type {NextConfig} from 'next';
import {nextRedirects} from './next.config.redirects';

/**
 * Single source of truth for the production site URL. Used by metadataBase,
 * canonicals, Open Graph, sitemap, and robots. Change it here and everywhere
 * follows. Do NOT put localhost or an unrelated domain here for releases.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://devicetry.com';

const nextConfig: NextConfig = {
  // Phase 9 route migrations: permanent 308s from old tool routes to their
  // merged/reorganized destinations (deep-linking tabs via ?tab=...).
  async redirects() {
    return nextRedirects();
  },
  reactStrictMode: true,
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
    // 2 GiB cgroup: the default pool of 4 static-generation workers (each
    // inheriting NODE_OPTIONS heap) can exceed the container limit during
    // prerender. Two workers keep the aggregate peak inside the limit.
    cpus: 2,
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
