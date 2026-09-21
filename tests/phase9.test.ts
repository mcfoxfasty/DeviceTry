/**
 * Phase 9 verification tests: catalog/migration integrity, guides, products,
 * IP endpoint behavior, speed provider, and reaction-time logic.
 *
 * The speed-provider and IP-fetch tests use clearly labeled mocks — they
 * verify OUR code's behavior, not real network measurements.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROUTE_MIGRATIONS,
  RETIRED_WITHOUT_REDIRECT,
  FINAL_CATALOG,
  findMigration,
} from '../lib/tools/migration';
import { TOOLS_REGISTRY, ALL_TOOL_PAGES } from '../lib/tools/registry';
import { nextRedirects } from '../next.config.redirects';
import {
  getPublishedGuides,
  getGuideBySlug,
  GUIDE_CATEGORIES,
} from '../lib/guides/registry';
import { GUIDE_ARTICLES } from '../content/guides';
import { PRODUCTS, resolveProducts, getAffiliateUrl, getManufacturerUrl } from '../lib/products/registry';
import { fetchPublicIp, classifyIp, IpLookupError } from '../lib/testing/ipLookup';
import { classifyAxes, classifyOrientation } from '../lib/testing/sensorGates';
import { ReactionRun, median, ATTEMPTS_PER_SESSION } from '../lib/testing/reactionTime';

// ---------------------------------------------------------------- migration

test('Every migration destination is a live primary route with a real tab', () => {
  const primarySlugs = new Set(TOOLS_REGISTRY.map((t) => t.slug));
  const tabIds: Record<string, string[]> = {
    'webcam-test': ['test', 'mirror'],
    'microphone-test': ['level', 'pitch', 'recorder'],
    'touchscreen-test': ['touch', 'multi-touch'],
    'screen-test': ['dead-pixel', 'patterns', 'screen-info'],
  };

  for (const m of ROUTE_MIGRATIONS) {
    assert.ok(primarySlugs.has(m.destination), `Migration source ${m.from} targets unknown ${m.destination}`);
    assert.equal(m.permanent, true, 'All Phase 9 migrations are permanent');
    if (m.tab) {
      const valid = tabIds[m.destination] ?? [];
      assert.ok(
        valid.includes(m.tab),
        `Migration ${m.from} uses tab "${m.tab}" which ${m.destination} does not define (valid: ${valid.join(', ')})`
      );
    }
  }
});

test('Migration sources and retired slugs never appear in any registry', () => {
  const live = new Set(ALL_TOOL_PAGES.map((t) => t.slug));
  for (const m of ROUTE_MIGRATIONS) {
    assert.equal(live.has(m.from), false, `Old route slug ${m.from} still exists as a page`);
  }
  for (const slug of RETIRED_WITHOUT_REDIRECT) {
    assert.equal(live.has(slug), false, `Retired slug ${slug} still exists as a page`);
  }
});

test('nextRedirects wires every migration as a permanent redirect', () => {
  const redirects = nextRedirects();
  assert.equal(redirects.length, ROUTE_MIGRATIONS.length);

  for (const m of ROUTE_MIGRATIONS) {
    const match = redirects.find((r) => r.source === `/test/${m.from}`);
    assert.ok(match, `No redirect wired for /test/${m.from}`);
    const expected = m.tab ? `/test/${m.destination}?tab=${m.tab}` : `/test/${m.destination}`;
    assert.equal(match.destination, expected);
    assert.equal(match.permanent, true);
  }
});

test('findMigration resolves old slugs and ignores everything else', () => {
  assert.equal(findMigration('online-mirror')?.destination, 'webcam-test');
  assert.equal(findMigration('nonexistent'), undefined);
});

test('FINAL_CATALOG lists exactly the 15 primary tools in registry order', () => {
  assert.deepEqual(TOOLS_REGISTRY.map((t) => t.slug), [...FINAL_CATALOG]);
});

// ------------------------------------------------------------------ guides

test('All 15 guide articles exist with unique slugs', () => {
  assert.equal(GUIDE_ARTICLES.length, 15, '9 troubleshooting + 6 buying guides');
  const slugs = new Set(GUIDE_ARTICLES.map((g) => g.slug));
  assert.equal(slugs.size, GUIDE_ARTICLES.length, 'Guide slugs must be unique');
});

test('Every guide category and type is represented', () => {
  const categories = new Set(GUIDE_ARTICLES.map((g) => g.category));
  for (const { key } of GUIDE_CATEGORIES) {
    assert.ok(categories.has(key), `No guide published in category ${key}`);
  }
  const types = new Set(GUIDE_ARTICLES.map((g) => g.type));
  assert.ok(types.has('troubleshooting'));
  assert.ok(types.has('buying'));
});

test('Guide related tool slugs resolve against the final registry', () => {
  const slugs = new Set(ALL_TOOL_PAGES.map((t) => t.slug));
  for (const guide of GUIDE_ARTICLES) {
    for (const toolSlug of guide.relatedToolSlugs) {
      assert.ok(slugs.has(toolSlug), `Guide ${guide.slug} links unknown tool ${toolSlug}`);
    }
  }
});

test('Draft guides never enter public listings', () => {
  const published = getPublishedGuides();
  for (const g of published) {
    assert.equal(g.published, true, 'A draft leaked into public listings');
  }
  // If a draft exists in the content set, it must be excluded from the
  // published list and (by construction) from the sitemap, which consumes
  // getPublishedGuides only.
  const drafts = GUIDE_ARTICLES.filter((g) => !g.published);
  for (const d of drafts) {
    assert.equal(published.includes(d), false);
  }
});

test('Guide lookups by slug work for published articles', () => {
  const first = getPublishedGuides()[0];
  assert.ok(first, 'At least one guide must be published');
  assert.equal(getGuideBySlug(first.slug)?.slug, first.slug);
});

test('Buying guides reference only registered product IDs', () => {
  for (const guide of GUIDE_ARTICLES) {
    for (const section of guide.sections) {
      for (const productId of section.productIds ?? []) {
        assert.ok(PRODUCTS[productId], `Guide ${guide.slug} references unregistered product ${productId}`);
      }
    }
  }
});

test('No affiliate URL is fabricated and manufacturer links exist', () => {
  for (const product of Object.values(PRODUCTS)) {
    assert.ok(product.sourceUrl.startsWith('https://'), `Product ${product.id} needs a real https source URL`);
    const affiliate = getAffiliateUrl(product);
    // Affiliate URLs stay empty until the owner supplies genuine links.
    if (affiliate !== undefined) {
      assert.match(affiliate, /^https:\/\//, 'Affiliate URL must be a real https link if configured');
    }
    assert.equal(typeof getManufacturerUrl(product), 'string');
  }
  // resolveProducts drops unknown IDs instead of crashing.
  assert.equal(resolveProducts(['does-not-exist']).length, 0);
});

// ------------------------------------------------------- IP endpoint logic

test('classifyIp identifies IPv4, IPv6, and unknown reliably', () => {
  assert.equal(classifyIp('203.0.113.7'), 'IPv4');
  assert.equal(classifyIp('2001:db8::1'), 'IPv6');
  assert.equal(classifyIp('not-an-ip'), 'unknown');
  assert.equal(classifyIp(''), 'unknown');
});

test('fetchPublicIp calls our same-origin endpoint and parses the response (mocked)', () => {
  // Mock fetch — verifies OUR fetchPublicIp contract, not the network.
  const originalFetch = globalThis.fetch;
  let calledUrl = '';
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calledUrl = String(input);
    return new Response(JSON.stringify({ ip: '203.0.113.7' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  return fetchPublicIp().then(
    (result) => {
      globalThis.fetch = originalFetch;
      assert.match(calledUrl, /\/api\/ip$/);
      assert.equal(result.ip, '203.0.113.7');
      assert.equal(result.version, 'IPv4');
    },
    (err) => {
      globalThis.fetch = originalFetch;
      throw err;
    }
  );
});

test('fetchPublicIp raises IpLookupError on endpoint failure (mocked)', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('{"error":"ip unavailable"}', { status: 501 })) as typeof fetch;
  try {
    await assert.rejects(() => fetchPublicIp(), IpLookupError);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ------------------------------------------------- reaction time (simulated)

test('median computes odd/even/empty medians correctly', () => {
  assert.equal(median([80, 120, 200, 240, 300]), 200);
  assert.equal(median([90, 110, 130]), 110);
  assert.equal(median([100, 200]), 150);
  assert.equal(median([]), null);
});

test('ReactionRun: early response marks too-soon and increments the token', () => {
  let clock = 1000;
  const run = new ReactionRun(
    () => clock,
    () => {}, // schedule: never fire the signal in this scenario
    () => {},
    () => 0.5
  );
  run.beginAttempt();
  assert.equal(run.currentPhase, 'waiting');
  // User clicks before the signal → attempt invalidated, phase back to idle.
  assert.equal(run.respond(), 'too-soon');
  assert.equal(run.currentPhase, 'idle');
  assert.equal(run.results.attempts[0].outcome, 'too-soon');
  assert.equal(run.results.attempts[0].ms, null);
});

test('ReactionRun: a measured attempt records ms, best, and median', () => {
  const scheduled: Array<{ fn: () => void; ms: number }> = [];
  let clock = 1000;
  const run = new ReactionRun(
    () => clock,
    (fn, ms) => scheduled.push({ fn, ms }), // capture instead of firing
    () => {},
    () => 0.5
  );
  run.beginAttempt();
  // Fire the captured signal callback manually (deterministic "go").
  scheduled[0].fn();
  assert.equal(run.currentPhase, 'signal');
  clock += 240; // 240 ms reaction time
  assert.equal(run.respond(), 'measured');
  const results = run.results;
  assert.equal(results.attempts[0].outcome, 'measured');
  assert.equal(results.attempts[0].ms, 240);
  assert.equal(results.best, 240);
  assert.equal(results.median, 240);
});

test('ReactionRun: hidden-during-attempt cancels and records the outcome', () => {
  const run = new ReactionRun(
    () => 1000,
    () => {},
    () => {},
    () => 0.5
  );
  run.beginAttempt();
  assert.equal(run.hiddenDuringAttempt(), true);
  assert.equal(run.results.attempts[0].outcome, 'hidden');
  assert.equal(run.currentPhase, 'idle');
  // No pending work survives: another hidden check reports nothing active.
  assert.equal(run.hiddenDuringAttempt(), false);
});

test('ReactionRun: reset clears results and invalidates pending signal', () => {
  const scheduled: Array<{ fn: () => void; ms: number }> = [];
  let clock = 1000;
  const run = new ReactionRun(
    () => clock,
    (fn, ms) => scheduled.push({ fn, ms }),
    () => {},
    () => 0.5
  );
  run.beginAttempt();
  run.reset();
  assert.equal(run.currentPhase, 'idle');
  assert.equal(run.results.attempts.length, 0);
  // The stale signal fires after reset — it must be rejected.
  scheduled[0].fn();
  assert.equal(run.currentPhase, 'idle');
});

test('Reaction session requires five valid attempts', () => {
  assert.equal(ATTEMPTS_PER_SESSION, 5);
  assert.equal(new ReactionRun().sessionComplete, false);
});

// --------------------------------------------------- sensor gates (regression)

test('classifyAxes treats finite zero as valid data and null as missing', () => {
  assert.equal(classifyAxes({ x: 0, y: 0, z: 0 }), 'valid');
  assert.equal(classifyAxes({ x: null, y: 0, z: 1 }), 'missing-data');
  assert.equal(classifyAxes({ x: Number.NaN, y: 0, z: 1 }), 'non-finite');
});

test('classifyOrientation uses alpha/beta/gamma (regression for the x/y/z slip)', () => {
  assert.equal(classifyOrientation({ alpha: 0, beta: 0, gamma: 0 }), 'valid');
  assert.equal(classifyOrientation({ alpha: null, beta: 0, gamma: 0 }), 'missing-data');
});

// ------------------------------------------------------- speed test (mocked)

test('bpsToMbps/msOrNull map engine values honestly (mocked engine numbers)', async () => {
  // Pure mapping tests against clearly-labeled fake engine numbers — NOT real
  // network measurements. Zero, negative, and non-finite map to null.
  const { bpsToMbps, msOrNull } = await import('../lib/testing/speedProvider');

  assert.equal(bpsToMbps(10_000_000), 10);
  assert.equal(bpsToMbps(1_234_567), 1.2);
  assert.equal(bpsToMbps(0), 0, 'a real measured zero is displayed as zero, not hidden');
  assert.equal(bpsToMbps(-5), null);
  assert.equal(bpsToMbps(Number.NaN), null);
  assert.equal(bpsToMbps(undefined), null);

  assert.equal(msOrNull(12.34), 12.3);
  assert.equal(msOrNull(-1), null);
  assert.equal(msOrNull(Number.POSITIVE_INFINITY), null);
  assert.equal(msOrNull(null), null);
});
