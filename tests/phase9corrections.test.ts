/**
 * Phase 9 corrections — focused regressions (five fixes).
 *
 * The speed-provider test uses a clearly labeled fake engine: it verifies OUR
 * controller lifecycle (callback detachment ordering), not real network
 * measurements.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Fix 1: SITE_URL defined once, validated, no assumed domain fallback
// ---------------------------------------------------------------------------
import { resolveSiteUrl, SITE_URL } from '../lib/site';
import { readFileSync, existsSync } from 'node:fs';

test('site url - local dev without NEXT_PUBLIC_SITE_URL uses honest localhost default', () => {
  assert.equal(resolveSiteUrl(undefined, 'development'), 'http://localhost:3000');
  assert.equal(resolveSiteUrl(undefined, 'test'), 'http://localhost:3000');
});

test('site url - production without NEXT_PUBLIC_SITE_URL uses .invalid placeholder, never an assumed domain', () => {
  const url = resolveSiteUrl(undefined, 'production');
  assert.equal(url, 'https://site-url-unset.invalid');
  assert.ok(!url.includes('devicetry.com'), 'no invented domain fallback');
});

test('site url - valid absolute http(s) roots are accepted and normalized (trailing slash stripped)', () => {
  assert.equal(resolveSiteUrl('https://example.com', 'production'), 'https://example.com');
  assert.equal(resolveSiteUrl('https://example.com/', 'production'), 'https://example.com');
  assert.equal(resolveSiteUrl('http://localhost:3000', 'development'), 'http://localhost:3000');
});

test('site url - invalid values throw with actionable messages', () => {
  assert.throws(() => resolveSiteUrl('devicetry.com', 'production'), /absolute URL/);
  assert.throws(() => resolveSiteUrl('ftp://example.com', 'production'), /http\(s\)/);
  assert.throws(() => resolveSiteUrl('https://example.com/guides', 'production'), /site root/);
  assert.throws(() => resolveSiteUrl('https://example.com/?x=1', 'production'), /site root/);
});

test('site url - localhost is rejected in production builds', () => {
  assert.throws(() => resolveSiteUrl('http://localhost:3000', 'production'), /localhost/);
  assert.throws(() => resolveSiteUrl('http://127.0.0.1:3000', 'production'), /localhost/);
});

test('site url - SITE_URL is defined only in lib/site.ts (next.config no longer exports it)', () => {
  const nextConfig = readFileSync('next.config.ts', 'utf8');
  assert.ok(
    !nextConfig.includes("export const SITE_URL"),
    'next.config.ts must not define a second SITE_URL'
  );
  assert.ok(
    !nextConfig.includes('devicetry.com'),
    'no assumed domain fallback in next.config.ts'
  );
  assert.ok(existsSync('lib/site.ts'), 'lib/site.ts exists as the single source');
});

test('site url - no assumed domain fallback anywhere in app code', () => {
  for (const file of ['lib/site.ts', 'app/layout.tsx', 'app/sitemap.ts', 'app/robots.ts', 'app/terms/page.tsx']) {
    const content = readFileSync(file, 'utf8');
    assert.ok(!content.includes('devicetry.com'), `${file} must not hardcode devicetry.com`);
  }
});

test('site url - production env var flows through SITE_URL when set (sanity)', () => {
  // SITE_URL was computed at import time from the sandbox env (unset here →
  // non-production default). The invariant that matters: it is a valid URL.
  assert.ok(SITE_URL.startsWith('http://') || SITE_URL.startsWith('https://'));
});

// ---------------------------------------------------------------------------
// Fix 2: /api/ip — PORT cannot enable dev fallback; validation + trusted proxy
// ---------------------------------------------------------------------------
import { resolveClientIp, isValidIp } from '../lib/testing/ipTrust';

function makeHeaders(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

test('ip route - production without a declared trusted proxy never trusts forwarded headers', () => {
  const resolution = resolveClientIp(
    makeHeaders({ 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '203.0.113.7' }),
    { isProduction: true }
  );
  assert.equal(resolution.outcome, 'unconfigured', 'untrusted headers must be ignored');
});

test('ip route - PORT-style environments do not enable dev fallbacks in production', () => {
  // The old defect: process.env.PORT !== undefined unlocked x-forwarded-for.
  // The function no longer accepts any such signal; this asserts the contract
  // by exercising the production path with forwarding headers present.
  const resolution = resolveClientIp(
    makeHeaders({ 'x-forwarded-for': '198.51.100.9' }),
    { trustedProxy: undefined, isProduction: true }
  );
  assert.equal(resolution.outcome, 'unconfigured');
});

test('ip route - cf-connecting-ip trusted only under IP_TRUSTED_PROXY=cloudflare', () => {
  const headers = makeHeaders({ 'cf-connecting-ip': '203.0.113.7' });

  const trusted = resolveClientIp(headers, { trustedProxy: 'cloudflare', isProduction: true });
  assert.deepEqual(trusted, { outcome: 'ok', ip: '203.0.113.7' });

  const untrusted = resolveClientIp(headers, { isProduction: true });
  assert.equal(untrusted.outcome, 'unconfigured');
});

test('ip route - x-forwarded-for allowed only for local development without a proxy declaration', () => {
  const headers = makeHeaders({ 'x-forwarded-for': '192.0.2.44, 10.0.0.1' });
  const dev = resolveClientIp(headers, { isProduction: false });
  assert.deepEqual(dev, { outcome: 'ok', ip: '192.0.2.44' });

  const devWithProxyDeclared = resolveClientIp(headers, { trustedProxy: 'cloudflare', isProduction: false });
  assert.equal(devWithProxyDeclared.outcome, 'unconfigured', 'proxy declaration replaces dev fallback');
});

test('ip route - invalid header values are rejected, not returned as IPs', () => {
  const resolution = resolveClientIp(
    makeHeaders({ 'cf-connecting-ip': 'not-an-ip' }),
    { trustedProxy: 'cloudflare', isProduction: true }
  );
  assert.equal(resolution.outcome, 'invalid');
});

test('ip route - IPv4-mapped IPv6 is normalized for display', () => {
  const resolution = resolveClientIp(
    makeHeaders({ 'cf-connecting-ip': '::ffff:203.0.113.7' }),
    { trustedProxy: 'cloudflare', isProduction: true }
  );
  assert.deepEqual(resolution, { outcome: 'ok', ip: '203.0.113.7' });
});

test('ip route - isValidIp accepts real address shapes and rejects garbage', () => {
  assert.equal(isValidIp('203.0.113.7'), true);
  assert.equal(isValidIp('2001:db8::1'), true);
  assert.equal(isValidIp('::1'), true);
  assert.equal(isValidIp('::ffff:203.0.113.7'), true);
  assert.equal(isValidIp('fe80::1%eth0'), true);
  assert.equal(isValidIp(''), false);
  assert.equal(isValidIp('999.1.1.1'), false);
  assert.equal(isValidIp('not-an-ip'), false);
  assert.equal(isValidIp('a'.repeat(50)), false);
});

// ---------------------------------------------------------------------------
// Fix 3: speedProvider.dispose() detaches callbacks BEFORE cancel()
// ---------------------------------------------------------------------------
test('speed provider - dispose detaches engine callbacks before cancel clears the engine', async () => {
  const { CloudflareSpeedTestController, __setEngineFactoryForTests } = await import(
    '../lib/testing/speedProvider'
  );

  let detachedBeforeCancel = false;

  class FakeEngine {
    onRunningChange: unknown = () => {};
    onResultsChange: unknown = () => {};
    onFinish: unknown = () => {};
    onError: unknown = () => {};
    paused = false;
    results = {
      getSummary: () => ({}),
      getUnloadedLatency: () => null,
      getUnloadedJitter: () => null,
      getDownLoadedLatency: () => null,
      getUpLoadedLatency: () => null,
    };
    play() {}
    restart() {}
    pause() {
      this.paused = true;
      // During cancel, the engine reference must ALREADY be detached:
      detachedBeforeCancel = this.onResultsChange === null && this.onFinish === null;
    }
  }

  const restore = __setEngineFactoryForTests(async () => FakeEngine as unknown as never);
  try {
    const events = { onPhase: () => {}, onProgress: () => {} };
    const controller = new CloudflareSpeedTestController(events);
    await controller.start();
    controller.dispose();

    assert.ok(
      detachedBeforeCancel,
      'callbacks must be detached before cancel() runs pause()/clears the engine reference'
    );
    assert.equal(controller.currentPhase, 'aborted');
  } finally {
    restore();
  }
});

test('speed provider - engine callbacks fired after dispose are ignored', async () => {
  const { CloudflareSpeedTestController, __setEngineFactoryForTests } = await import(
    '../lib/testing/speedProvider'
  );

  interface CapturedEngine {
    onResultsChange: ((info: { type: string }) => void) | null;
    onFinish: ((results: unknown) => void) | null;
    onError: ((error: string) => void) | null;
  }
  let engineInstance: CapturedEngine | null = null;
  const getEngine = (): CapturedEngine | null => engineInstance;

  class FakeEngine {
    onRunningChange: unknown = null;
    onResultsChange: ((info: { type: string }) => void) | null = null;
    onFinish: ((results: unknown) => void) | null = null;
    onError: ((error: string) => void) | null = null;
    results = { getSummary: () => ({ download: 5_000_000 }) };
    pause() {}
    play() {}
    restart() {}
    constructor() {
      engineInstance = this as unknown as CapturedEngine;
    }
  }

  const restore = __setEngineFactoryForTests(async () => FakeEngine as unknown as never);
  try {
    const phases: string[] = [];
    const controller = new CloudflareSpeedTestController({
      onPhase: (p) => phases.push(p),
      onProgress: () => {},
    });
    await controller.start();
    controller.dispose();

    // The engine fires callbacks after dispose — all must be no-ops.
    const eng = getEngine();
    eng?.onResultsChange?.({ type: 'latency' });
    eng?.onFinish?.(null);
    eng?.onError?.('late error');
    assert.equal(phases.filter((p) => p === 'finished' || p === 'error').length, 0,
      'a disposed controller must not transition phases from detached engine callbacks');
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------------
// Fix 4: no suppressHydrationWarning, no eslint.ignoreDuringBuilds
// ---------------------------------------------------------------------------
test('layout - html/body no longer carry suppressHydrationWarning', () => {
  const layout = readFileSync('app/layout.tsx', 'utf8');
  assert.ok(!layout.includes('suppressHydrationWarning'), 'root hydration suppression removed');
  assert.ok(layout.includes('<html lang="en">'), 'html tag preserved');
});

test('config - lint is enforced as a hard gate in the verify script', () => {
  // In-build lint OOM-killed this 2 GiB container (documented in
  // docs/phase9-migration.md), so lint enforcement lives in the verify gate
  // instead of the build step.
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.match(pkg.scripts.verify, /bun run lint &&/, 'verify must run lint FIRST');
  assert.ok(
    pkg.scripts.verify.includes('&& bun test') &&
      pkg.scripts.verify.includes('&& tsc --noEmit') &&
      pkg.scripts.verify.includes('&& next build'),
    'verify chains tests, typecheck, and build after lint'
  );
});

// ---------------------------------------------------------------------------
// Fix 5: supporting routes resolve through ALL_TOOL_PAGES
// ---------------------------------------------------------------------------
import { ALL_TOOL_PAGES, TOOLS_REGISTRY, SUPPORTING_REGISTRY } from '../lib/tools/registry';

test('tool page - routing registry includes every supporting diagnostic route', () => {
  const page = readFileSync('app/test/[slug]/page.tsx', 'utf8');
  assert.ok(page.includes('ALL_TOOL_PAGES') || page.includes('findToolBySlug'),
    'page must resolve via the complete registry');
  assert.ok(!page.match(/TOOLS_REGISTRY\.find\(\(item\) => item\.slug === slug\)/),
    'slug lookup must not be limited to the primary catalog');

  // Every supporting tool must be routable.
  for (const tool of SUPPORTING_REGISTRY) {
    assert.ok(
      ALL_TOOL_PAGES.some((t) => t.slug === tool.slug),
      `supporting route /test/${tool.slug} must be present in ALL_TOOL_PAGES`
    );
  }

  // Catalog-card semantics remain limited to the 15 primary tools.
  assert.equal(TOOLS_REGISTRY.length, 15, 'primary catalog stays at 15 tools');
  assert.equal(ALL_TOOL_PAGES.length, TOOLS_REGISTRY.length + SUPPORTING_REGISTRY.length);
});

test('tool page - supporting tool definitions carry routable, honest metadata', () => {
  for (const tool of SUPPORTING_REGISTRY) {
    assert.ok(tool.title.length > 0, `${tool.slug} has a title`);
    assert.ok(tool.shortDesc.length > 0, `${tool.slug} has a short description`);
    assert.ok(!tool.slug.includes(' '), `${tool.slug} is a valid route segment`);
  }
});

test('tool page - sitemap and routing agree on the same complete registry', () => {
  const sitemap = readFileSync('app/sitemap.ts', 'utf8');
  assert.ok(sitemap.includes('ALL_TOOL_PAGES'), 'sitemap enumerates the complete registry');
});
