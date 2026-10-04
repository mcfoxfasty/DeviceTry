import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { TOOLS_REGISTRY } from '../lib/tools/registry';
import { uiToolSearch, toolsInCategory } from '../lib/tools/search';

/**
 * Homepage search + category filtering.
 *
 * The defect: with a category active, tapping a popular/search chip kept that
 * category, so the "Microphone" chip searched for a microphone INSIDE (say) the
 * Games category and the grid showed nothing. The suggestion panel did not
 * apply the category at all, so the two panels could disagree — a suggestion
 * would name a tool the visible results did not contain.
 *
 * The composition the component performs is small enough to state here and
 * test for real: rank once, then narrow to the active category. The wiring
 * itself is pinned by reading the source, which is how this suite already
 * guards LandingClient.
 */

const landing = readFileSync('components/LandingClient.tsx', 'utf8');

/** Exactly what the component does for one (query, category) pair. */
function visibleTools(query: string, category: string): string[] {
  const ranked = query.trim() ? uiToolSearch(query, TOOLS_REGISTRY.length) : TOOLS_REGISTRY;
  const matched = new Set(ranked);
  return toolsInCategory(
    TOOLS_REGISTRY.filter((tool) => matched.has(tool)),
    category as 'all'
  ).map((tool) => tool.slug);
}

/** The suggestion panel: same narrowing, top 5. */
function suggestions(query: string, category: string): string[] {
  if (!query.trim()) return [];
  return toolsInCategory(uiToolSearch(query, TOOLS_REGISTRY.length), category as 'all')
    .slice(0, 5)
    .map((tool) => tool.slug);
}

test('search + category - a popular chip from a category shows the tool again', () => {
  // The reported failure: another category selected, then the "Microphone" chip.
  for (const category of ['input-devices', 'display', 'network']) {
    assert.equal(
      visibleTools('Microphone', category).length,
      0,
      `"Microphone" inside ${category} really did produce nothing`
    );
  }

  // The fix is the chip's behaviour (below): a chip is a new search and clears
  // the category, so what the user lands on is the unfiltered search.
  assert.deepEqual(visibleTools('Microphone', 'all').includes('microphone-test'), true);
});

test('search + category - a chip clears the conflicting category (no dead end)', () => {
  const fn = landing.slice(
    landing.indexOf('const applyQuickSearch'),
    landing.indexOf('const openSuggestion')
  );
  assert.match(fn, /applyFilter\(term, 'all'\)/, 'the chip resets the category as well as the query');
  assert.doesNotMatch(fn, /applyFilter\(term, selectedCategory\)/, 'the old conflicting call is gone');
});

test('search + category - typing in the input still filters within the category', () => {
  const fn = landing.slice(
    landing.indexOf('const handleQueryChange'),
    landing.indexOf('const handleCategoryChange')
  );
  assert.match(fn, /applyFilter\(value, selectedCategory\)/, 'typing refines, it does not reset browsing');

  const within = visibleTools('test', 'audio-video');
  assert.ok(within.includes('microphone-test'));
  assert.ok(within.every((slug) => TOOLS_REGISTRY.find((t) => t.slug === slug)!.category === 'audio-video'));
});

test('search + category - selecting a category keeps the query (search then category)', () => {
  const fn = landing.slice(
    landing.indexOf('const handleCategoryChange'),
    landing.indexOf('const rankedMatches')
  );
  assert.match(fn, /applyFilter\(inputValue, key\)/, 'a category tap refines the current search');

  const audio = visibleTools('record', 'audio-video');
  assert.ok(audio.length > 0, 'the search survives the category change');
  assert.ok(audio.every((slug) => TOOLS_REGISTRY.find((t) => t.slug === slug)!.category === 'audio-video'));
});

test('search + category - clearing the search keeps the category, clearing the category keeps the search', () => {
  assert.deepEqual(visibleTools('', 'audio-video').length > 0, true, 'clear search -> category view');
  const clear = landing.slice(landing.indexOf('const clearSearch'), landing.indexOf('const applyQuickSearch'));
  assert.match(clear, /applyFilter\('', selectedCategory\)/);

  // Category -> 'all' is the All chip; it must not discard the query.
  assert.match(landing, /onClick=\{\(\) => handleCategoryChange\('all'\)\}/);
  const unfiltered = visibleTools('microphone', 'all');
  assert.deepEqual(
    unfiltered,
    uiToolSearch('microphone', TOOLS_REGISTRY.length).map((t) => t.slug),
    "on 'all' the grid is exactly the unfiltered ranking"
  );
  assert.ok(unfiltered.includes('microphone-test'));
});

test('suggestions - they can never name a tool the visible results exclude', () => {
  const categories = ['all', 'audio-video', 'input-devices', 'display', 'network', 'supporting'];
  const queries = ['microphone', 'mic', 'test', 'webcam', 'keyboard', 'screen', 'speed', 'ip', 'zzz'];

  for (const category of categories) {
    for (const query of queries) {
      const shown = new Set(visibleTools(query, category));
      const offered = suggestions(query, category);
      for (const slug of offered) {
        assert.ok(
          shown.has(slug),
          `suggestion ${slug} (query "${query}", category ${category}) is not among the visible results`
        );
      }
    }
  }
});

test('suggestions - the component narrows them through the shared helper', () => {
  const fn = landing.slice(landing.indexOf('const suggestions = useMemo'), landing.indexOf('const toolCount'));
  assert.match(fn, /toolsInCategory\(rankedMatches, selectedCategory\)\.slice\(0, 5\)/);
  // The old global-only call is gone.
  assert.doesNotMatch(fn, /uiToolSearch\(searchQuery, 5\)/);
});

test('suggestions - with no category the panel is unchanged (top 5 of the ranking)', () => {
  assert.deepEqual(suggestions('test', 'all'), uiToolSearch('test', 5).map((t) => t.slug));
  assert.deepEqual(suggestions('   ', 'all'), [], 'an empty query offers nothing');
});

test('search + category - a filter cannot be undone by the stale URL it just replaced', () => {
  // router.replace() writes the address bar in a later task and never emits
  // popstate, so the URL snapshot the component re-reads can still hold the
  // PREVIOUS query string when React re-renders. The adopt-external-URL path
  // then re-applied that old category and the chip dead-ended on zero results
  // even though the address bar no longer mentioned a category. This was the
  // reported bug, reproduced in a real browser: the URL was right and the UI
  // was not. applyFilter records what it wrote and the snapshot serves it.
  assert.match(landing, /appliedSearch = qs \? `\?\${qs}` : '';/);

  const snapshot = landing.slice(
    landing.indexOf('function getUrlSearch'),
    landing.indexOf('function getServerUrlSearch')
  );
  assert.match(snapshot, /return appliedSearch \?\? window\.location\.search;/);

  const popstate = landing.slice(
    landing.indexOf('function subscribeToUrlChange'),
    landing.indexOf('function getUrlSearch')
  );
  assert.match(popstate, /appliedSearch = null;/, 'a real Back/Forward clears the recorded value');
  assert.match(popstate, /addEventListener\('popstate'/);

  // The recorded value must be the same query string the URL receives, so the
  // snapshot and the address bar agree while the navigation is in flight.
  assert.match(
    landing.slice(landing.indexOf('const applyFilter'), landing.indexOf('const handleQueryChange')),
    /router\.replace\(href, \{ scroll: false \}\);/
  );
});

test('search + category - an empty result set still says so instead of showing everything', () => {
  assert.deepEqual(visibleTools('Microphone', 'display'), []);
  assert.deepEqual(suggestions('Microphone', 'display'), []);
});