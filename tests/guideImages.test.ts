import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { readFileSync } from 'node:fs';

import { GUIDE_ARTICLES } from '../content/guides/index';
import {
  GUIDE_IMAGE_WIDTHS,
  guideImageFile,
  guideImageSrcSet,
  guideImageThemes,
} from '../lib/guides/images';
import { microphoneNotWorking } from '../content/guides/audio/microphone-not-working';

const component = readFileSync('components/guides/GuideFigure.tsx', 'utf8');
const view = readFileSync('components/guides/GuideArticleView.tsx', 'utf8');
const imagesLib = readFileSync('lib/guides/images.ts', 'utf8');
const globals = readFileSync('app/globals.css', 'utf8');
/** Component source with comments stripped, so a guard cannot match its own docs. */
const componentCode = component.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

/** Every figure declared anywhere in the guide corpus. */
function allFigures() {
  const out: Array<{ where: string; image: NonNullable<typeof microphoneNotWorking.featuredImage> }> = [];
  for (const guide of GUIDE_ARTICLES) {
    if (guide.featuredImage) out.push({ where: `${guide.slug} (featured)`, image: guide.featuredImage });
    guide.sections.forEach((s, i) => {
      if (s.image) out.push({ where: `${guide.slug} section ${i + 1}`, image: s.image });
    });
  }
  return out;
}

test('guide figures - a theme pair prints as its light variant', () => {
  // Every diagram ships a light and a dark raster and swaps them with `dark:`
  // classes, which the class-based dark mode resolves from the `.dark` class on
  // <html>. The print stylesheet forces the page white, but that class survives
  // printing — so without an explicit rule, a reader who prints from dark mode
  // gets the dark raster as a black rectangle on paper. This was found by
  // reading a printed PDF, and nothing on screen would ever reveal it.
  const printBlock = globals.slice(globals.lastIndexOf('@media print'));
  assert.match(
    printBlock,
    /img\.dark\\:block\s*\{[^}]*display:\s*none\s*!important/,
    'print hides the dark raster of a theme pair'
  );
  assert.match(
    printBlock,
    /img\.dark\\:hidden\s*\{[^}]*display:\s*block\s*!important/,
    'print shows the light raster of a theme pair'
  );
  // The selectors must stay scoped to <img>: `dark:hidden` is also the class on
  // the theme-toggle icon, and a bare `.dark\:hidden` rule would reveal it in
  // print for no reason.
  assert.doesNotMatch(
    printBlock,
    /^\s*\.dark\\:hidden\s*\{/m,
    'the rule is scoped to img so a non-image use of the class is untouched'
  );
});

test('guide figures - the file behind every declared image actually exists', () => {
  const figures = allFigures();
  assert.ok(figures.length > 0, 'at least one guide declares a figure');

  for (const { where, image } of figures) {
    assert.match(image.src, /^\/guides\/[a-z0-9-]+$/, `${where}: src is a clean base path with no extension or size suffix`);

    // A photograph is theme-agnostic and ships one file per width; a diagram
    // bakes its colours in and ships a light and a dark raster.
    const themes = guideImageThemes(image.kind);
    assert.ok(themes.length > 0, `${where}: resolves to at least one variant`);

    for (const theme of themes) {
      for (const w of GUIDE_IMAGE_WIDTHS) {
        const file = `public${guideImageFile(image.src, theme, w)}`;
        assert.ok(existsSync(file), `${where}: missing ${file}`);
        assert.ok(statSync(file).size > 1000, `${where}: ${file} is suspiciously small`);
      }
    }
  }
});

test('guide: the first check certifies this page, not the microphone', () => {
  // A meter on one page proves exactly one thing: an audio signal reached
  // THIS page, with THIS device, under THIS permission. Saying "your
  // microphone and its permission are fine" over-claims, and it contradicts
  // the article's own FAQ ("Conferencing apps choose their own input device,
  // independent of the system default") and its summary table.
  //
  // The wording is pinned in both the prose and the diagram alt, so a future
  // edit that "simplifies" either back into a blanket certification fails.
  const g = microphoneNotWorking;
  const opening = g.sections[0].paragraphs![0];
  const decisionAlt = g.sections[0].image!.alt;
  const both = `${opening} ${decisionAlt}`;

  // The claim, in both places.
  for (const [where, text] of [['prose', opening], ['alt', decisionAlt]] as const) {
    assert.match(text, /audio signal has reached this browser test/i, `${where} states what the test actually proves`);
  }

  // No blanket certification of the microphone or of "its permission".
  assert.doesNotMatch(
    both,
    /your microphone and its permission are fine/i,
    'the old over-claiming sentence is gone'
  );
  assert.doesNotMatch(
    both,
    /\bthe microphone and (its|the) permission (is|are) fine\b/i,
    'nothing claims the microphone and its permission are simply "fine"'
  );

  // The limitation is spelled out, not implied.
  for (const [where, text] of [['prose', opening], ['alt', decisionAlt]] as const) {
    assert.match(text, /another app|different input/i, `${where} names the other app as a separate case`);
  }
});

test('guide figures - an optimised derivative is far smaller than its source', () => {
  // The whole point of pre-rasterising: a full-resolution source must never be
  // what reaches a visitor. Anything in /public is served verbatim, so this
  // is the guard that a source image can never be referenced directly.
  const hero = microphoneNotWorking.featuredImage!;
  assert.equal(hero.kind, 'photo');

  const source = 'public/uploads/DCCE0AD3-B271-4689-8835-691D7EFABF11.png';
  assert.ok(existsSync(source), 'the supplied source photo is present');
  const sourceKb = statSync(source).size / 1024;
  const servedKb = GUIDE_IMAGE_WIDTHS.map(
    (w) => statSync(`public${guideImageFile(hero.src, null, w)}`).size / 1024
  );

  for (const [i, kb] of servedKb.entries()) {
    assert.ok(
      kb < sourceKb / 10,
      `width ${GUIDE_IMAGE_WIDTHS[i]} is ${kb.toFixed(0)}KB, over 10x smaller than the ${sourceKb.toFixed(0)}KB source`
    );
  }
  // A photograph is allowed to be heavier per pixel than a flat diagram, but
  // the desktop entry still has to be small enough to sit in a lead image.
  assert.ok(servedKb[1] < 60, `the 768px entry is ${servedKb[1].toFixed(0)}KB`);
});

test('guide figures - alt text is real, specific, and not a filename', () => {
  for (const { where, image } of allFigures()) {
    assert.ok(image.alt.length > 60, `${where}: alt text is too short to describe the figure`);
    assert.ok(image.alt.length < 700, `${where}: alt text is a wall of text, not a description`);
    // Alt text must not be "image of microphone.png" or a bare slug.
    assert.doesNotMatch(image.alt, /\.webp|\.png|\.svg|\/guides\//, `${where}: alt text names a file, not the content`);
    // Figures are diagrams, so the description should say what the figure shows.
    assert.match(image.alt, /[.!?]\s|[a-z]/, `${where}: alt text is empty`);
  }
});

test('guide figures - the renderer reserves the box, serves a srcset, and lazy-loads', () => {
  // CLS guard: without intrinsic width/height the article reflows as each
  // figure arrives, which is the single largest layout-shift source on a
  // long article.
  assert.match(component, /width=\{image\.width\}/, 'the figure declares its intrinsic width');
  assert.match(component, /height=\{image\.height\}/, 'and its intrinsic height');

  // Responsive: one srcset per theme variant, and a sizes that reflects the
  // real article column.
  assert.match(component, /srcSet=\{guideImageSrcSet\(image\.src, theme\)\}/, 'a srcset is emitted per theme');
  assert.match(component, /sizes=\{GUIDE_IMAGE_SIZES\}/, 'with a sizes attribute');
  assert.equal(
    guideImageSrcSet('/guides/example', 'dark'),
    GUIDE_IMAGE_WIDTHS.map((w) => `/guides/example-dark-${w}.webp ${w}w`).join(', '),
    'the srcset builder names the themed files'
  );

  // Only the lead figure is high priority — but neither theme variant may be
  // `loading="eager"`. An eager image is picked up by the preload scanner
  // before the stylesheet applies, so the browser would download the hidden
  // variant too: measured, 4 image requests per view instead of 3.
  assert.match(componentCode, /fetchPriority=\{priority \? 'high' : 'auto'\}/, 'the lead figure is raised in priority');
  assert.doesNotMatch(componentCode, /loading="eager"/, 'no variant is eager, or the hidden theme would still be downloaded');
  assert.match(componentCode, /loading="lazy"/, 'both variants use native lazy loading');

  // The hidden variant must be display:none so only the active one is
  // fetched and only the active one is announced. A photo has no hidden
  // variant at all: it resolves to a single theme-agnostic file.
  assert.match(component, /dark:hidden/, 'the light variant is hidden in dark mode');
  assert.match(component, /hidden dark:block/, 'and the dark variant is shown instead');
  assert.deepEqual(guideImageThemes('photo'), [null], 'a photograph ships one file set, not two');
  assert.deepEqual(guideImageThemes('diagram'), ['light', 'dark'], 'a diagram ships both themes');
  assert.deepEqual(guideImageThemes(undefined), ['light', 'dark'], 'an omitted kind is a diagram');
  assert.equal(guideImageFile('/g/x', null, 768), '/g/x-768.webp', 'a photo file has no theme segment');
  assert.equal(guideImageFile('/g/x', 'dark', 768), '/g/x-dark-768.webp', 'a diagram file does');

  // Pointer/keyboard never reach a figure: it is an <img>, not a control.
  assert.doesNotMatch(component, /onClick|href=/, 'a figure is not interactive');
});

test('guide figures - the template renders them additively and is theme-correct', () => {
  assert.match(view, /<GuideFigure image=\{guide\.featuredImage\} priority \/>/, 'the lead figure renders under the header');
  assert.match(view, /\{section\.image && <GuideFigure image=\{section\.image\} \/>\}/, 'a section figure renders from its section');

  // An article with no images must render exactly as it did before the
  // schema change: both call sites are behind a truthiness guard.
  const withoutImages = GUIDE_ARTICLES.filter((g) => !g.featuredImage && !g.sections.some((s) => s.image));
  assert.ok(
    withoutImages.length > 0,
    'most guides declare no image at all, so this must be a purely additive schema change'
  );
});

test('guide figures - a drawn diagram is never presented as a photograph', () => {
  // Every figure declares what kind of image it is. The distinction is what
  // lets a reader tell a supplied photograph from drawn artwork, and it drives
  // the one-file-vs-two decision in lib/guides/images.
  for (const { where, image } of allFigures()) {
    assert.ok(image.kind, `${where}: declares whether it is a diagram or a photo`);
  }

  // The corpus holds real photographs and drawn diagrams, so the check is
  // that they are correctly distinguished rather than that only one kind
  // exists. Counts are pinned so a figure cannot be added or dropped silently.
  const photos = allFigures().filter((f) => f.image.kind === 'photo');
  const diagrams = allFigures().filter((f) => f.image.kind === 'diagram');
  assert.equal(photos.length, 2, 'two supplied photographs (microphone + Bluetooth articles)');
  assert.equal(diagrams.length, 5, 'five drawn diagrams, all still inside their articles');

  assert.match(imagesLib, /kind \?\? 'diagram'/, 'an omitted kind defaults to diagram, the truthful default');

  for (const { where, image } of diagrams) {
    assert.match(image.alt, /^Diagram\./, `${where}: every diagram alt text names itself as a diagram`);
  }
  // A photograph must NOT claim to be a diagram.
  for (const { where, image } of photos) {
    assert.doesNotMatch(image.alt, /^Diagram\./, `${where}: a photograph is not described as a diagram`);
  }
});

test('guide figures - nothing is drawn on top of a figure', () => {
  // A "Diagram" chip was tried and removed: at 320-375px it sat over the
  // diagram's own title and obscured the first thing a reader needs. The
  // diagrams are dense at phone width, so any overlay competes with the
  // artwork. The alt text carries the distinction instead, which costs a
  // sighted reader nothing.
  //
  // This guards the whole <figure>, not just the chip that was removed: no
  // absolutely positioned child, no visible label, no overlay of any kind.
  assert.doesNotMatch(componentCode, /absolute/, 'the figure positions nothing on top of its image');
  assert.doesNotMatch(componentCode, />\s*Diagram\s*</, 'no visible Diagram label is rendered');
  assert.doesNotMatch(componentCode, /<span[^>]*>\s*Diagram/, 'and no chip element is emitted');

  // The <figure> holds images and, optionally, a caption — nothing else.
  const body = componentCode.slice(componentCode.indexOf('return ('), componentCode.lastIndexOf('};\n}'));
  const children = [...body.matchAll(/<(\w+)/g)].map((m) => m[1]);
  for (const tag of children) {
    assert.ok(
      ['figure', 'img', 'figcaption'].includes(tag),
      `only figure/img/figcaption may render inside a figure (found <${tag}>)`
    );
  }

  // A caption sits BELOW the image in normal flow, never over it.
  assert.doesNotMatch(componentCode, /className="[^"]*\brelative\b/, 'the figure is not a positioning context for an overlay');
});

test('guide photo - the alt text stays inside what the frame actually shows', () => {
  // Written against the supplied file. The temptation when describing a
  // microphone photo is to name the control the hand is touching — a gain
  // knob, a mute switch, a volume dial. That detail is not legible enough in
  // the supplied file to assert, and an alt text that guesses puts a false
  // claim in front of a screen-reader user. The guard below keeps the text on
  // what can actually be seen.
  const hero = microphoneNotWorking.featuredImage!;
  assert.equal(hero.kind, 'photo');
  assert.ok(hero.alt.length > 60, 'the alt text actually describes the picture');

  // The scene, in the order a sighted reader meets it.
  for (const subject of [
    /desktop USB microphone/i,
    /hand/i,
    /laptop/i,
    /over-ear headphones/i,
    /wooden desk/i,
  ]) {
    assert.match(hero.alt, subject, `the alt text mentions ${subject}`);
  }

  // No invented hardware detail. Word boundaries matter: a bare /gain/ also
  // matches "aGAINST".
  assert.doesNotMatch(
    hero.alt,
    /\b(gain|knob|dial|button|volume|mute)\b/i,
    'the alt text does not name a control it cannot confirm'
  );

  // The no-fabrication rules still apply to a supplied photo.
  assert.doesNotMatch(hero.alt, /screenshot/i, 'a photograph is not called a screenshot');
  assert.doesNotMatch(hero.alt, /\b(macbook|im thinkpad|logitech|razer|blue yeti|hyperx)\b/i,
    'no brand or model is named');
  assert.doesNotMatch(hero.alt, /\b-?\d+(\.\d+)?\s*(dB|decibel|ms|milliseconds?)\b/,
    'no measurement is stated');
});

test('guide figures - a figure never claims a screenshot, a reading, or a device', () => {
  // The whole point of the diagrams is that they are original illustrations.
  // A fabricated browser window, a fabricated level-meter value, or a named
  // device would be an invented claim about what the reader saw.
  for (const { where, image } of allFigures()) {
    const text = `${image.alt} ${image.caption ?? ''}`;
    assert.doesNotMatch(text, /screenshot/i, `${where}: never claims to be a screenshot`);
    assert.doesNotMatch(
      text,
      /\b(-?\d+(\.\d+)?\s*(dB|decibel|ms|milliseconds?|%|percent))\b/,
      `${where}: states no measurement or reading`
    );
    assert.doesNotMatch(
      text,
      /\b(macbook|im thinkpad|surface pro|macbook air|dell|logitech|bose|sony|razer)\b/i,
      `${where}: names no specific device or vendor`
    );
  }
});

test('guide figures - the illustrated article keeps its text, links, metadata and FAQ', () => {
  // The microphone article gained three images and lost nothing: this pins
  // the prose, the related links, the dates, the metadata and the Q&A that a
  // careless edit to a content file would quietly drop.
  const g = microphoneNotWorking;
  assert.equal(g.slug, 'microphone-not-working');
  assert.equal(g.title, 'Microphone Not Working? A Complete Troubleshooting Guide');
  assert.match(g.description, /Step-by-step fixes for a microphone/);
  assert.equal(g.category, 'audio');
  assert.equal(g.type, 'troubleshooting');
  assert.deepEqual(g.relatedToolSlugs, ['microphone-test', 'voice-recorder', 'speakers-test']);
  assert.deepEqual(g.relatedGuideSlugs, ['microphone-too-quiet']);
  assert.equal(g.published, true);
  assert.equal(g.hasAffiliateLinks, false);
  assert.equal(g.publishedAt.toISOString().slice(0, 10), '2026-08-14');
  assert.equal(g.updatedAt.toISOString().slice(0, 10), '2026-09-29');

  assert.equal(g.sections.length, 6, 'all six sections survive');
  assert.equal(
    g.sections[0].h2,
    'First: confirm whether the mic reaches the browser at all'
  );
  assert.equal(g.sections[0].steps!.length, 3, 'its three steps survive');
  assert.equal(g.sections[1].steps!.length, 4, 'the permission section keeps its four steps');
  assert.equal(g.sections[1].bullets!.length, 3, 'and its three bullets');
  assert.equal(g.sections[3].bullets!.length, 4, 'the hardware section keeps its four bullets');
  assert.equal(g.faqs.length, 4, 'all four FAQ entries survive');
  assert.match(g.faqs[0].q, /Why does my microphone work in the browser test but not in Zoom or Teams\?/);

  // Exactly one featured figure and at most one per section, as specified.
  assert.ok(g.featuredImage, 'the lead figure is present');
  const illustrated = g.sections.filter((s) => s.image);
  assert.equal(illustrated.length, 3, 'three diagrams inside the article, beside the steps they explain');
  assert.equal(illustrated[0].image!.src, '/guides/microphone-not-working-signal-arrives');
  assert.equal(illustrated[1].image!.src, '/guides/microphone-not-working-permission-layers');
  assert.equal(illustrated[2].image!.src, '/guides/microphone-not-working-signal-path');
  // The signal-path diagram used to head the article; it now lives in the
  // closing summary section, leaving the photograph as the lead figure.
  assert.equal(g.sections[illustrated[2].image ? 5 : 0].image!.src, '/guides/microphone-not-working-signal-path');
  assert.equal(g.featuredImage!.src, '/guides/microphone-not-working-hero');
  // Intrinsic size must match the source photo so the box is reserved exactly.
  assert.equal(g.featuredImage!.width, 1672);
  assert.equal(g.featuredImage!.height, 941);
});
