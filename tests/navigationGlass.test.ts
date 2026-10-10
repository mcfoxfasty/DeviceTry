import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const navbar = readFileSync(join(repoRoot, 'components/layout/Navbar.tsx'), 'utf8');
const globals = readFileSync(join(repoRoot, 'app/globals.css'), 'utf8');
const landing = readFileSync(join(repoRoot, 'components/LandingClient.tsx'), 'utf8');

test('desktop header contains each primary destination once and keeps appearance last', () => {
  const desktopLinks = navbar.match(/const desktopLinks = \[([\s\S]*?)\n  \];/)?.[1];
  assert.ok(desktopLinks, 'desktop navigation entries exist');
  for (const route of ['/tests', '/advanced-diagnostics', '/guides', '/test-history']) {
    assert.ok(desktopLinks.includes(`href: '${route}'`), `${route} is in the desktop header`);
  }
  assert.equal((desktopLinks.match(/href:/g) ?? []).length, 4, 'each regular desktop destination is listed once');

  const nav = navbar.match(/<nav\s+className="hidden lg:flex[\s\S]*?<\/nav>/)?.[0];
  assert.ok(nav, 'desktop navigation landmark exists');
  assert.match(nav, /t\.nav\.categories/, 'Categories is an accessible dropdown trigger');
  assert.match(nav, /aria-expanded=\{desktopCategoriesOpen\}/, 'the dropdown reports its open state');
  assert.match(nav, /href="\/inspection"/, 'Guided Inspection remains a single CTA');
  assert.ok(nav.indexOf('</nav>') > nav.indexOf('Guided Inspection'), 'CTA is inside the desktop navigation');
  assert.match(navbar, /hidden lg:flex items-center ml-2[\s\S]{0,180}<ThemeSwitch/, 'appearance switch follows navigation at the far right');
});

test('mobile drawers have distinct destinations and route through semantic links', () => {
  const drawerLinks = navbar.match(/const DRAWER_LINKS:[\s\S]*?= \[([\s\S]*?)\n\];/)?.[1];
  assert.ok(drawerLinks, 'left navigation drawer links exist');
  const hrefs = [...drawerLinks.matchAll(/href: '([^']+)'/g)].map((match) => match[1]);
  assert.equal(new Set(hrefs).size, hrefs.length, 'left drawer destinations are not duplicated');
  assert.equal(hrefs.filter((href) => href === '/advanced-diagnostics').length, 1, 'Advanced Diagnostics appears once in the left drawer');
  assert.match(navbar, /<Link\s+key=\{href\}[\s\S]{0,90}href=\{href\}[\s\S]{0,80}onClick=\{closeDrawers\}/, 'drawer routes are real links');
  assert.match(navbar, /type DrawerId = 'nav' \| 'tools' \| null/, 'the two drawers remain mutually exclusive');
  assert.match(navbar, /matchMedia\('\(min-width: 1024px\)'\)/, 'open mobile drawers close at the desktop breakpoint');
});

test('Liquid Glass surfaces reveal the grid softly and retain safe fallbacks', () => {
  assert.match(globals, /\.glass\s*\{[\s\S]*?background-color:\s*rgba\(255, 255, 255, 0\.42\)[\s\S]*?backdrop-filter:\s*blur\(9px\)/);
  assert.match(globals, /\.dark \.glass\s*\{[\s\S]*?background-color:\s*rgba\(13, 24, 34, 0\.50\)[\s\S]*?backdrop-filter:\s*blur\(9px\)/);
  assert.match(globals, /\.glass-strong\s*\{[\s\S]*?background-color:\s*rgba\(248, 252, 252, 0\.70\)/);
  assert.match(globals, /\.glass-pill\s*\{[\s\S]*?backdrop-filter:\s*blur\(6px\)/);
  assert.match(globals, /@supports not \(\(backdrop-filter:[\s\S]*?background-image: none;/, 'unsupported browsers do not expose a sharp grid behind text');
  assert.match(globals, /prefers-reduced-transparency: reduce[\s\S]*?background-image: none;/, 'reduced-transparency preference is respected');
  assert.match(landing, /className="glass tool-card/);
  assert.match(landing, /glass-pill border/);
});
