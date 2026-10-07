/**
 * The generated foot of an article: FAQs, related checks, related reading.
 *
 * These are the rules that make an automatically appended section trustworthy,
 * and each one is here because getting it wrong ships something worse than an
 * empty section:
 *
 *  - an FAQ answer must come from the article or from the tool registry, never
 *    from nothing, so a reader cannot be told something the site does not say;
 *  - a recommendation needs a real signal behind it (a shared tag, a shared
 *    subject word, a shared category) and is dropped rather than padded when it
 *    does not have one;
 *  - an article never recommends itself, and no list is longer than its cap.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_ANSWER_LENGTH,
  MAX_CHECKS,
  MAX_DERIVED_FAQS,
  MAX_FAQS,
  MAX_RELATED,
  buildArticleFooter,
  categoryFaqsFor,
  clampAnswer,
  isQuestionHeading,
  relatedArticlesForPost,
  relatedChecksForPost,
  subjectWords,
} from '../lib/blog/footers';
import { buildPostJsonLd } from '../lib/blog/seo';
import type { BlogPost } from '../lib/blog/content';
import type { PublishedArticleRef } from '../lib/articles/registry';

/** A CMS article that satisfies the reader, so each test varies one thing. */
function post(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    slug: 'sample-article',
    title: 'Keyboard Keys Not Registering',
    content: 'The opening paragraph.',
    seoTitle: null,
    seoDescription: null,
    coverImage: '/uploads/cover.png',
    coverImageAlt: 'A cover image',
    publishedAt: '2026-10-06',
    author: 'DeviceTry team',
    category: 'input-gaming',
    status: 'published',
    tags: ['keyboard', 'troubleshooting'],
    canonicalUrl: null,
    ...overrides,
  };
}

function ref(overrides: Partial<PublishedArticleRef> = {}): PublishedArticleRef {
  return {
    slug: 'other-article',
    source: 'cms',
    title: 'Another Article',
    category: 'input-gaming',
    publishedAt: '2026-09-01',
    description: 'A description.',
    coverImage: '',
    coverImageAlt: '',
    type: 'how-to',
    tags: [],
    ...overrides,
  };
}

// ------------------------------------------------------------------ subjects

test('footer subjects - matching collapses plurals and ignores filler words', () => {
  assert.deepEqual(subjectWords('Keyboard Keys Not Registering'), ['keyboard', 'key', 'registering']);
  assert.deepEqual(subjectWords('microphones and The Speaker'), ['microphone', 'speaker']);
  assert.deepEqual(subjectWords('glass'), ['glass'], 'a word ending in “ss” is not a plural');
  assert.deepEqual(subjectWords('???'), [], 'punctuation alone is not a subject');
});

test('footer answers - a long answer is clamped at a word boundary and says so', () => {
  const words = Array.from({ length: 120 }, (_, index) => `word${index}`).join(' ');
  const clamped = clampAnswer(words);
  assert.ok(clamped.length <= MAX_ANSWER_LENGTH);
  assert.ok(clamped.endsWith('…'), 'a clamp is visible');
  assert.doesNotMatch(clamped, /word119/, 'the tail is cut, not spilled');
  assert.equal(clampAnswer('  Short and complete.  '), 'Short and complete.');
});

test('footer questions - a heading is a question when it asks one', () => {
  assert.equal(isQuestionHeading('Does the tester measure loudness?'), true);
  assert.equal(isQuestionHeading('How to tell a hardware fault'), true);
  assert.equal(isQuestionHeading('The five-minute test'), false);
  assert.equal(isQuestionHeading('When it is genuinely the software'), true, 'a "when" heading is a question in prose form');
});

// ----------------------------------------------------------------------- FAQ

test('footer FAQ - the article answers itself, using its own words', () => {
  const article = post({
    content: [
      'An opening paragraph that is not under any heading.',
      '',
      '## Does the tester measure loudness?',
      '',
      'No. The meter reflects the gain your browser is given, not a calibrated sound',
      'pressure level, so two machines can show different numbers for the same room.',
      '',
      '## The five-minute test',
      '',
      'This heading states a subject rather than asking anything, and must not become',
      'a question with a stolen answer underneath it.',
    ].join('\n'),
  });

  const { faqs } = buildArticleFooter(article, { candidates: [] });
  const derived = faqs.find((faq) => faq.q === 'Does the tester measure loudness?');
  assert.ok(derived, 'the article’s own question is asked back');
  assert.match(derived.a, /reflects the gain your browser is given/);
  assert.doesNotMatch(derived.a, /##/, 'markdown syntax never reaches an answer');
  assert.equal(
    faqs.some((faq) => faq.q.includes('five-minute test')),
    false,
    'a heading that is not a question is not asked'
  );
});

test('footer FAQ - a question its own section does not answer is dropped', () => {
  const article = post({
    content: ['## Why does this happen?', '', '### A sub-heading that answers nothing', '', 'Short.'].join('\n'),
  });
  const derived = buildArticleFooter(article, { candidates: [] }).faqs.filter((faq) =>
    faq.q.startsWith('Why')
  );
  assert.deepEqual(derived, [], 'an empty pair is worse than no pair');
});

test('footer FAQ - category questions are answered from the tool registry', () => {
  const article = post({ title: 'How to test the performance of a microphone', category: 'audio', tags: [] });
  const checks = relatedChecksForPost(article);
  assert.ok(checks.length > 0, 'an audio article matches an audio tool');

  const faqs = categoryFaqsFor(checks, MAX_FAQS);
  assert.equal(faqs.length, checks.length);
  for (const faq of faqs) {
    // The question names the tool, so two checks cannot produce one question.
    assert.match(faq.q, /^What does the .+ measure\?$/);
    assert.ok(faq.a.length > 0);
    assert.doesNotMatch(faq.a, /undefined/, 'an answer is never assembled from a missing field');
  }
  // Every generated answer is traceable to a string the registry publishes.
  const mic = faqs.find((faq) => faq.q.includes('Microphone'));
  assert.ok(mic, 'the microphone tester is among the answers');
  assert.match(mic.a, /runs entirely in the browser/, 'the answer says how it runs');
});

test('footer FAQ - the article keeps its own questions first, and the list is capped', () => {
  const questions = Array.from(
    { length: MAX_DERIVED_FAQS + 3 },
    (_, index) => `## Does it work in case ${index}?\n\nThe answer to case ${index} is written out at enough length to be a real answer.`
  );
  const article = post({ title: 'How to test the performance of a microphone', category: 'audio', content: questions.join('\n\n') });

  const { faqs } = buildArticleFooter(article, { candidates: [] });
  assert.ok(faqs.length <= MAX_FAQS, `the section never exceeds ${MAX_FAQS} entries`);
  assert.ok(
    faqs.length >= MAX_DERIVED_FAQS,
    'the article’s own questions are never squeezed out by generated ones'
  );
  // The article's own questions come first, in the order it wrote them; the
  // generated category questions only fill what is left.
  assert.match(faqs[0].q, /^Does it work in case 0\?$/, 'the article answers itself first');
  assert.deepEqual(
    faqs.slice(0, MAX_DERIVED_FAQS).map((faq) => faq.q),
    Array.from({ length: MAX_DERIVED_FAQS }, (_, index) => `Does it work in case ${index}?`)
  );
  assert.equal(
    faqs.slice(MAX_DERIVED_FAQS).every((faq) => /^What does the .+ measure\?$/.test(faq.q)),
    true,
    'anything after the article’s own questions is a generated one'
  );
});

// ------------------------------------------------------------- related checks

test('footer checks - a keyboard article is sent to the keyboard tester, not a microphone', () => {
  const checks = relatedChecksForPost(post());
  assert.ok(checks.length > 0);
  assert.equal(checks[0].slug, 'keyboard-test', 'the strongest match leads');
  assert.equal(checks[0].href, '/test/keyboard-test', 'the card links the tool route');
  assert.equal(
    checks.some((check) => check.slug === 'microphone-test'),
    false,
    'an unrelated device class is not recommended'
  );
  assert.ok(checks.length <= MAX_CHECKS, `at most ${MAX_CHECKS} tools`);
  for (const check of checks) {
    assert.ok(check.title.length > 0 && check.description.length > 0, 'a card has its own copy');
    assert.ok(check.reason.length > 0, 'a card says why');
  }
});

test('footer checks - an article about nothing in the catalog gets no checks', () => {
  const checks = relatedChecksForPost(
    post({ title: 'How to choose a desk lamp', category: 'how-to', tags: ['lamp', 'furniture'] })
  );
  assert.deepEqual(checks, [], 'a recommendation with no signal behind it is dropped');
});

test('footer checks - a tag outranks a word that merely appears in the title', () => {
  const checks = relatedChecksForPost(post({ title: 'A quiet office', tags: ['microphone'] , category: 'how-to' }));
  assert.equal(checks[0]?.slug, 'microphone-test');
  assert.match(checks[0]?.reason ?? '', /Tagged/, 'the reason names the tag');
});

// ----------------------------------------------------------- related articles

test('footer related - a shared tag is the reason, and the article never recommends itself', () => {
  const candidates: PublishedArticleRef[] = [
    ref({ slug: 'sample-article', title: 'Keyboard Keys Not Registering', tags: ['keyboard'] }),
    ref({ slug: 'keyboard-guide', title: 'A keyboard guide', tags: ['keyboard'] }),
    ref({ slug: 'unrelated', title: 'Choosing a desk', category: 'how-to', tags: ['furniture'] }),
  ];

  const related = relatedArticlesForPost(post(), candidates);
  assert.deepEqual(related.map((article) => article.slug), ['keyboard-guide']);
  assert.match(related[0].reason, /^Also about keyboard\.$/);
  assert.equal(related[0].href, '/guides/keyboard-guide');
  assert.equal(related[0].source, 'cms');
});

test('footer related - a shared category alone is enough, and the list is capped', () => {
  const candidates = Array.from({ length: MAX_RELATED + 4 }, (_, index) =>
    ref({
      slug: `sibling-${index}`,
      title: `Sibling ${index}`,
      category: 'input-gaming',
      tags: [],
      // Descending by index, so "newest first" has an answer that is not an
      // accident of the sort implementation.
      publishedAt: `2026-09-${String(20 - index).padStart(2, '0')}`,
    })
  );
  const related = relatedArticlesForPost(post({ tags: [] }), candidates);
  assert.equal(related.length, MAX_RELATED);
  assert.match(related[0].reason, /same category/);
  assert.deepEqual(
    related.map((article) => article.slug),
    ['sibling-0', 'sibling-1', 'sibling-2'],
    'among equal scores the newest article leads'
  );
});

test('footer related - an imported guide and a CMS article compete on the same terms', () => {
  const candidates: PublishedArticleRef[] = [
    ref({ slug: 'hand-written', source: 'guide', title: 'Keyboard faults, step by step', category: 'display', tags: [] }),
  ];
  const related = relatedArticlesForPost(post(), candidates);
  assert.equal(related.length, 1);
  assert.equal(related[0].source, 'guide');
  assert.equal(related[0].href, '/guides/hand-written');
});

// ------------------------------------------------------------------- assembly

test('footer assembly - all three sections come from one call, and empty ones stay empty', () => {
  const full = buildArticleFooter(post(), { candidates: [ref({ tags: ['keyboard'] })] });
  assert.ok(full.faqs.length > 0);
  assert.ok(full.checks.length > 0);
  assert.ok(full.related.length > 0);

  const bare = buildArticleFooter(
    post({ title: 'A quiet office', category: 'how-to', tags: [], content: 'One paragraph.' }),
    { candidates: [ref({ title: 'Nothing in common', category: 'network', tags: ['router'] })] }
  );
  assert.deepEqual(bare, { faqs: [], checks: [], related: [] });
});

test('footer FAQ - the FAQPage graph describes exactly the questions the page renders', () => {
  const article = post({ title: 'How to test the performance of a microphone', category: 'audio', tags: [] });
  const { faqs } = buildArticleFooter(article, { candidates: [] });
  assert.ok(faqs.length > 0, 'this article generates an answer to something');

  const graph = buildPostJsonLd(article, { faqs })['@graph'] as Array<Record<string, unknown>>;
  const faqNode = graph.find((node) => node['@type'] === 'FAQPage');
  assert.ok(faqNode, 'a rendered FAQ section emits a FAQPage node');

  const questions = (faqNode.mainEntity as Array<Record<string, unknown>>).map((entry) => entry.name);
  assert.deepEqual(questions, faqs.map((faq) => faq.q), 'the graph asks what the reader can see');
  const first = (faqNode.mainEntity as Array<Record<string, unknown>>)[0];
  assert.equal(
    (first.acceptedAnswer as Record<string, unknown>).text,
    faqs[0].a,
    'and answers it in the same words'
  );

  // A page with no FAQ section claims none. An empty FAQPage is a claim about
  // content that is not there.
  assert.equal(
    (buildPostJsonLd(article)['@graph'] as Array<Record<string, unknown>>).some(
      (node) => node['@type'] === 'FAQPage'
    ),
    false
  );
  assert.equal(
    (buildPostJsonLd(article, { faqs: [] })['@graph'] as Array<Record<string, unknown>>).some(
      (node) => node['@type'] === 'FAQPage'
    ),
    false
  );
});
