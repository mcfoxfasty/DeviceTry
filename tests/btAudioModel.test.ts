import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bluetoothHeadphonesNoSoundWindows11 as guide } from '../content/guides/audio/bluetooth-headphones-no-sound-windows-11';
import { GUIDE_ARTICLES } from '../content/guides/index';

/**
 * Regression guard for a factual correction.
 *
 * The first version of this article described the Windows 10 endpoint model —
 * separate "Stereo" and "Hands-Free" entries — and told readers that seeing two
 * entries identified the fault. Microsoft's Bluetooth Classic audio
 * documentation states that Windows 11 UNIFIES the A2DP and HFP endpoints into
 * a single output and input, and selects the profile automatically. The old
 * guidance was therefore wrong for the article's stated audience, and it read
 * as authoritative while being wrong.
 *
 * These assertions are about which model the article is allowed to describe.
 * Source: https://learn.microsoft.com/en-us/windows-hardware/drivers/bluetooth/bluetooth-classic-audio
 */

const body = [
  ...guide.sections.flatMap((s) => [...(s.paragraphs ?? []), ...(s.bullets ?? []), ...(s.steps ?? [])]),
  ...guide.faqs.flatMap((f) => [f.q, f.a]),
  guide.intro,
].join('\n');

/**
 * Prescriptive content only. An FAQ QUESTION is allowed to name a
 * misconception in order to refute it ("Does that prove the hardware is
 * fine?"), and a guard that scans questions flags the very sentences doing the
 * correcting. Advice is what must be free of the claim.
 */
const advice = [
  ...guide.sections.flatMap((s) => [...(s.paragraphs ?? []), ...(s.bullets ?? []), ...(s.steps ?? [])]),
  ...guide.faqs.map((f) => f.a),
  guide.intro,
].join('\n');

test('bluetooth guide: the Windows 11 unified-endpoint model is stated', () => {
  assert.match(advice, /unified/i, 'states that Windows 11 unifies the A2DP and HFP endpoints');
  assert.match(advice, /Windows 10/, 'names Windows 10 as the version with separate endpoints');
});

test('bluetooth guide: any two-endpoint description is attributed to a version', () => {
  // The Windows 10 split is real and worth mentioning to a reader who sees it.
  // What must never happen is it appearing unqualified, as the current
  // Windows 11 interface. So every sentence that describes separate entries has
  // to say which version it belongs to.
  const sentences = advice.split(/(?<=[.?!])\s+/);
  // The claim under test is specifically "Windows presents two competing
  // entries for one headset". Matching only on Stereo + Hands-Free would also
  // catch sentences that merely describe the two PROFILES (A2DP for stereo
  // playback, HFP for mono capture), which is correct and unrelated.
  const describesTwoEntries = (s: string) =>
    /Hands[- ]?Free/i.test(s) &&
    /\bentries?\b|\bendpoints?\b/i.test(s) &&
    /\bseparate\b|\btwo\b|\bboth\b/i.test(s);

  const mentions = sentences.filter(describesTwoEntries);
  assert.ok(mentions.length > 0, 'the Windows 10 model is still explained, not hidden');
  for (const s of mentions) {
    assert.match(
      s,
      /Windows 1[01]|legacy|older|not the normal|different/i,
      `a sentence describing separate Stereo/Hands-Free entries must attribute it to a version: "${s.trim().slice(0, 90)}"`
    );
  }
});

test('bluetooth guide: the two-endpoint model is not presented as a Windows 11 diagnostic', () => {
  // Patterns tolerate an inserted word ("two SEPARATE entries"), because the
  // original error used several phrasings and a guard that only catches one
  // of them is not a guard.
  //
  // Version attribution is NOT re-checked here: the guard above already
  // requires every two-entry sentence to name its version, and duplicating it
  // here only produced false positives on correctly-qualified Windows 10 text.
  for (const bad of [
    /see (?:both |two )?(?:separate |competing )?entries?[^.]{0,60}?(?:this is|that is) your cause/i,
    /two (?:separate )?entries[^.]{0,30}(?:is|are) the cause/i,
    /disable the hands[- ]free entry/i,
  ]) {
    assert.doesNotMatch(advice, bad, `must not assert the two-endpoint model as a Windows 11 cause: ${bad}`);
  }
});

test('bluetooth guide: hands-free profile is not equated with silence', () => {
  assert.doesNotMatch(
    advice,
    /hands[- ]free[^.]{0,60}(?:means|equals) (?:no )?silence/i,
    'HFP changes bandwidth and channel count; it does not itself silence playback'
  );
  assert.match(
    advice,
    /mono/i,
    'describes the hands-free profile as mono rather than as silence'
  );
});

test('bluetooth guide: profile switching is described as automatic', () => {
  assert.match(advice, /resampl/i, 'mentions that Windows resamples to the active profile');
  assert.match(
    advice,
    /Communications category/i,
    'names the documented trigger for profile selection'
  );
});

test('bluetooth guide: no unmeasured superlative about cause frequency', () => {
  assert.doesNotMatch(
    advice,
    /the (?:single )?most common cause/i,
    'article has no measurement of cause frequency and must not claim one'
  );
});

test('bluetooth guide: cross-device testing is not treated as a hardware verdict', () => {
  assert.doesNotMatch(
    advice,
    /hardware is (?:fine|not the problem)/i,
    'working on another machine is evidence, not certification'
  );
  assert.doesNotMatch(
    advice,
    /rules out a hardware fault|proves the (?:headset|hardware) is/i,
    'no test is allowed to certify a component'
  );
});

test('bluetooth guide: the volume mixer is an actual step, not a mention', () => {
  const mixerStep = guide.sections.some((s) =>
    (s.steps ?? []).some((step) => /volume mixer/i.test(step))
  );
  assert.ok(mixerStep, 'a numbered step operates the volume mixer');
});

test('bluetooth guide: no generic headset reset or Windows reinstall advice', () => {
  assert.doesNotMatch(
    advice,
    /hold[^.]{0,60}until the indicator/i,
    'model-specific reset procedures must not be replaced with a generic routine'
  );
  // Catches an actual RECOMMENDATION to reinstall, not a mention of the option
  // while explaining why it is not advised.
  assert.doesNotMatch(
    advice,
    /(?:you should|we recommend|try|consider|go ahead and)\s+(?:to\s+)?(?:re)?install/i,
    'reinstalling the OS is not supported by anything these checks establish'
  );
});

test('bluetooth guide: the obsolete two-endpoint figure is gone', () => {
  const srcs = [guide.featuredImage, ...guide.sections.map((s) => s.image)]
    .filter((i): i is NonNullable<typeof i> => Boolean(i))
    .map((i) => i.src);
  assert.ok(
    !srcs.some((s) => s.includes('-endpoints')),
    'the misleading two-endpoint diagram must not be referenced'
  );
  assert.ok(
    srcs.some((s) => s.includes('-profile')),
    'the replacement profile-selection diagram is referenced'
  );
});

test('bluetooth guide: every diagram alt names itself a diagram', () => {
  // With no visible badge on a figure, the alt prefix is the only signal that
  // the image is drawn artwork rather than a photograph of the reader's desk.
  for (const s of guide.sections) {
    if (s.image) {
      assert.match(s.image.alt, /^Diagram\./, `${s.h2}: diagram alt names itself a diagram`);
    }
  }
});

test('bluetooth guide: contextual links sit inside the steps, not only in the cards', () => {
  const links = guide.sections.flatMap((s) => s.stepLinks ?? []);
  assert.ok(links.length > 0, 'at least one contextual link is attached to a step');
  for (const l of links) {
    const steps = guide.sections.find((s) => (s.stepLinks ?? []).includes(l))!.steps ?? [];
    assert.ok(l.stepIndex < steps.length, `link "${l.label}" points at a step that exists`);
  }
  // The two tools Step 1 actually calls for must be reachable there.
  const step1Hrefs = links.map((l) => l.href);
  assert.ok(step1Hrefs.includes('/test/speakers-test'), 'Step 1 links the Speaker & Headphone Test');
  assert.ok(step1Hrefs.includes('/test/tone-generator'), 'Step 1 links the Tone Generator');
});

test('bluetooth guide: related entries all serve a reader action', () => {
  // Trimmed from seven to four: the browser-info and microphone-permission
  // guides and the buying guide were topical adjacency, not next actions.
  assert.deepEqual(guide.relatedToolSlugs, ['speakers-test', 'tone-generator', 'microphone-test']);
  assert.deepEqual(guide.relatedGuideSlugs, ['one-headphone-side-not-working']);
});

test('bluetooth guide: has a table of contents', () => {
  assert.equal(guide.showToc, true);
  assert.ok(guide.sections.length >= 3, 'a TOC needs enough headings to be worth it');
});

test('bluetooth guide: the hero alt matches the inspected image', () => {
  assert.equal(
    guide.featuredImage?.alt,
    'Black over-ear headphones on a desk beside an open laptop with a blue wallpaper.'
  );
  assert.equal(guide.featuredImage?.kind, 'photo');
});

/* ------------------------------------------------------------------ *
 * Second review round: inline sourcing, symptom coverage, and the
 * removal of claims the evidence does not support.
 *
 * The first round fixed a factual error. This round removes the habits
 * that produced it: a citation parked in a list the reader skips, an
 * explanation opening before the cheap checks, and a diagnosis stated
 * with more confidence than the observation supports.
 * ------------------------------------------------------------------ */

const allProseLinks = guide.sections.flatMap((s) => s.proseLinks ?? []);

test('bluetooth guide: sourcing is inline in the prose, not a standalone list', () => {
  const external = allProseLinks.filter((l) => !l.href.startsWith('/'));
  assert.ok(
    external.length >= 6,
    `every claim that rests on a document carries that document beside it, not in a list (found ${external.length} inline external links)`
  );
  const hrefs = external.map((l) => l.href);
  assert.ok(
    hrefs.some((h) => h.includes('bluetooth-classic-audio')),
    'the endpoint and codec model cites the Microsoft Learn Bluetooth Classic audio page'
  );
  assert.ok(
    hrefs.some((h) => h.includes('configuring-bluetooth-le-audio-quality-settings')),
    'the microphone-active format control cites the Microsoft LE Audio page'
  );
  assert.ok(
    hrefs.some((h) => h.includes('update-bluetooth-drivers-in-windows')),
    'the driver step cites the Microsoft Bluetooth driver page'
  );
  for (const s of guide.sections) {
    assert.equal(
      (s as { references?: unknown }).references,
      undefined,
      `${s.h2}: the per-section Sources list is gone; citations live in proseLinks`
    );
  }
});

test('bluetooth guide: contextual internal links sit in the prose, not only in the cards', () => {
  const internal = allProseLinks.filter((l) => l.href.startsWith('/'));
  const hrefs = internal.map((l) => l.href);
  assert.ok(
    hrefs.includes('/guides/microphone-not-working'),
    'the microphone branch links the microphone guide where the reader is'
  );
  assert.ok(
    hrefs.includes('/guides/one-headphone-side-not-working'),
    'the one-sided case is handed off to the guide that covers it'
  );
  // The tool links stay on the steps: those are the actions a reader takes.
  assert.ok(
    guide.sections.some((s) => (s.stepLinks ?? []).length > 0),
    'the tools are still linked at the step that calls for them'
  );
});

test('bluetooth guide: other guides link here, so the article is not orphaned', () => {
  const incoming = GUIDE_ARTICLES.filter(
    (other) =>
      other.slug !== guide.slug &&
      other.sections.some((s) =>
        [...(s.proseLinks ?? []), ...(s.stepLinks ?? [])].some((l) =>
          l.href.includes(`/guides/${guide.slug}`)
        )
      )
  );
  assert.ok(
    incoming.length >= 2,
    `at least two other guides carry a contextual link to this one (found ${incoming.length})`
  );
});

test('bluetooth guide: the cheap checks come before the profile model', () => {
  // The search intent is "my headset is silent, fix it", so output selection
  // and app routing lead. The profile model is what the later steps act on, so
  // it follows them rather than opening the article.
  const at = (needle: string) => guide.sections.findIndex((s) => s.h2.includes(needle));
  const step1 = at('Step 1 —');
  const step2 = at('Step 2 —');
  const step3 = at('Step 3 —');
  const model = at('What Windows 11 is deciding');
  assert.ok(step1 === 0 && step2 === 1 && step3 === 2, 'steps 1 to 3 lead the article');
  assert.ok(model > step3, 'the endpoint and profile model comes after the first three checks');
  assert.match(guide.sections[1].h2, /volume mixer/i, 'step 2 is the per-application routing check');
  assert.match(guide.sections[2].h2, /output device/i, 'step 3 is the output selection check');
});

test('bluetooth guide: the three symptom branches each have a section and a table route', () => {
  const table = guide.sections.find((s) => s.table)?.table;
  assert.ok(table, 'the symptom table is still present');
  const rows = table!.rows.flat().join(' | ');

  const branches: Array<[string, RegExp, RegExp]> = [
    [
      'works after a restart, fails after reconnecting',
      /works after a restart but fails again/i,
      /works after a restart/i,
    ],
    [
      'works on a phone, silent on this PC',
      /works on your phone but not on this PC/i,
      /on a phone/i,
    ],
    [
      'started after an update, driver, or firmware change',
      /started after a Windows, driver, or firmware update/i,
      /after an update/i,
    ],
  ];
  for (const [label, heading, row] of branches) {
    const section = guide.sections.find((s) => heading.test(s.h2));
    assert.ok(section, `a section covers "${label}"`);
    assert.ok(
      (section!.paragraphs ?? []).length > 0,
      `the branch for "${label}" explains itself, it is not a bare heading`
    );
    assert.ok(row.test(rows), `the symptom table routes a reader with "${label}" to the branch`);
  }
});

test('bluetooth guide: no check is presented as proof of a cause', () => {
  // The review named five specific overclaims. Rather than blacklist one
  // phrasing, every sentence that reasons about proof has to carry its own
  // limit, which is the habit the article is actually teaching.
  const sentences = advice.split(/(?<=[.?!])\s+/);
  const claims = sentences.filter((s) => /\bproves?\b|\bproof\b|exactly one/i.test(s));
  assert.ok(claims.length > 0, 'the article does discuss what a test can establish');
  for (const s of claims) {
    assert.match(
      s,
      /\b(not|never|no|cannot|rather than|instead of|without)\b/i,
      `a sentence about proof must state its own limit: "${s.trim().slice(0, 100)}"`
    );
  }
  for (const bad of [
    /green (?:led|light)/i,
    /exactly one broken link/i,
    /the most effective/i,
    /proves? (?:that )?the (?:fault|cause|problem) is/i,
  ]) {
    assert.doesNotMatch(advice, bad, `unsupported certainty: ${bad}`);
  }
});

test('bluetooth guide: an update is investigated, never uninstalled on timing alone', () => {
  assert.doesNotMatch(
    advice,
    /(?:uninstall|remove|roll back)\s+(?:the\s+|that\s+)?(?:latest\s+|recent\s+)?windows\s+update/i,
    'removing the Windows update is not supported by the observation that the fault followed it'
  );
  assert.match(advice, /Roll Back Driver/i, 'a driver rollback is offered as the targeted, reversible action');
  assert.match(advice, /Update history/i, 'the reader is told how to identify which update arrived');
  // A reader may reasonably ask the question outright, so the QUESTION is
  // allowed to name uninstalling; the answer must be the one that refuses it.
  const uninstallSentences = body
    .split(/(?<=[.?!])\s+/)
    .filter((s) => /uninstall/i.test(s));
  assert.ok(uninstallSentences.length > 0, 'the update question is addressed somewhere in the article');
  for (const s of uninstallSentences) {
    const isQuestion = s.trim().endsWith('?');
    assert.ok(
      isQuestion || /\b(not|never|no|rather than|instead of|instead)\b/i.test(s),
      `only a question may raise uninstalling an update as an option: "${s.trim().slice(0, 100)}"`
    );
  }
});

test('bluetooth guide: the device dialog and the per-app mixer are not conflated', () => {
  assert.match(advice, /Volume mixer/i, 'the per-application view is covered');
  assert.match(advice, /mmsys\.cpl/i, 'the per-device classic dialog is covered');
  assert.match(advice, /Enhancements/i, 'a left-on device effect is checked, not just the level');
  assert.match(advice, /per application/i, 'the two dialogs are distinguished by what they show');
  assert.doesNotMatch(
    advice,
    /mmsys\.cpl[^.]{0,90}per[- ]app/i,
    'the classic Sound dialog is a per-device view, not a per-application one'
  );
});

test('bluetooth guide: the affected application is retested with its own audio', () => {
  assert.ok(
    guide.sections.some((s) =>
      (s.steps ?? []).some((step) => /from (?:that|the) application itself/i.test(step))
    ),
    'a numbered step replays audio in the app that was silent, not in a test tool'
  );
});

test('bluetooth guide: the LE Audio control states its own conditions', () => {
  assert.match(advice, /24H2 or newer/i, 'the version requirement is stated');
  assert.match(
    advice,
    /does not support stereo playback while the microphone is active/i,
    'an absent control is explained rather than treated as broken'
  );
  assert.match(
    advice,
    /format when microphone is active/i,
    'the control is named as Windows names it'
  );
});

test('bluetooth guide: the format value is a documented starting point, not a law', () => {
  assert.match(advice, /2 channels, 16 bit, 48000 Hz/, "Microsoft's own value is quoted");
  assert.match(
    advice,
    /documented starting point rather than a universal requirement/i,
    'the value is framed as guidance, because it is'
  );
});

test('bluetooth guide: the hero alt describes only what the frame shows', () => {
  const alt = guide.featuredImage?.alt ?? '';
  // A photograph of headphones on a desk cannot show that they are paired or
  // that sound is failing. The caption carries the point; the alt must not.
  assert.doesNotMatch(
    alt,
    /connected|pair|silent|no sound|bluetooth (?:led|indicator)|blue light/i,
    `the hero alt must not infer connection state from the picture: "${alt}"`
  );
});

/* ------------------------------------------------------------------ *
 * Third round: the endpoint diagram, and the microphone-active FAQ.
 *
 * Found by reading a printed PDF, where three things showed up that a
 * DOM-level check had missed: a headline that conflated the output and
 * input endpoints, a label running outside the box drawn around it, and
 * a fifth of the canvas sitting empty under the content.
 *
 * The picture itself is a raster, so a test cannot see those defects. It
 * CAN pin the two things a rebuild has to get right — what the diagram
 * says, and the aspect ratio its pixels were laid out for — and it can
 * pin the copy that had to change with them.
 * ------------------------------------------------------------------ */

const profileSection = guide.sections.find((s) => s.image?.src.endsWith('-profile'))!;
const profileImage = profileSection.image!;

test('bluetooth guide: the endpoint diagram is scoped to a Classic headset with HFP', () => {
  // "One output, one input" is the unification. "One headset, one
  // endpoint" was not wrong about the count and still misled, because
  // an endpoint is either an output or an input, and HFP-capable
  // headsets get one of each.
  const { alt, caption } = { alt: profileImage.alt, caption: profileImage.caption! };
  for (const [where, text] of [['alt', alt], ['caption', caption]] as const) {
    assert.match(text, /one output, one input/i, `${where} states one output and one input`);
    assert.doesNotMatch(
      text,
      /one (?:bluetooth )?headset, one endpoint/i,
      `${where} does not reduce a paired endpoint to a single "one headset, one endpoint"`
    );
  }
  // The unification is not universal: an A2DP-only accessory gets an output
  // endpoint alone, so a diagram that omits the scope over-claims.
  for (const [where, text] of [['alt', alt], ['caption', caption]] as const) {
    assert.match(
      text,
      /bluetooth classic/i,
      `${where} names the technology the diagram is about`
    );
    assert.match(
      text,
      /hands-free/i,
      `${where} states the HFP support the endpoint pair depends on`
    );
  }
});

test('bluetooth guide: the diagram alt describes every element the reader cannot see', () => {
  // With no badge on a figure, the alt is the only description a non-visual
  // reader gets, so each drawn element has to be named — including the pill,
  // which is the one that used to overflow its own box.
  for (const phrase of [
    /one output, one input/i,
    /pill/i,
    /switching is automatic/i,
    /A2DP/i,
    /Hands-Free Profile/i,
    /Communications-category stream/i,
    /stereo, high quality/i,
    /mono, call grade/i,
    /resamples audio/i,
    /Windows 10/i,
  ]) {
    assert.match(profileImage.alt, phrase, `alt text omits ${phrase}`);
  }
});

test('bluetooth guide: the figure box matches the rebuilt diagram canvas', () => {
  // The profile diagram is laid out by measurement, not by hand: the canvas
  // height is whatever the content needs. These two numbers come out of that
  // builder, and they are the ratio the browser reserves before the bytes
  // arrive. A future rebuild at a different height must update the schema, or
  // the reserved box distorts the diagram and the page shifts.
  assert.equal(profileImage.width, 640, 'the diagram canvas is 640 units wide');
  assert.equal(profileImage.height, 464, 'the diagram canvas is 464 units tall');
  assert.ok(
    Math.abs(profileImage.width / profileImage.height - 1.3793) < 0.001,
    'the declared aspect ratio matches the rasterised asset'
  );
});

test('bluetooth guide: the microphone-active FAQ separates a quality drop from silence', () => {
  const faq = guide.faqs.find((f) => /microphone turns on/i.test(f.q));
  assert.ok(faq, 'the microphone-while-playing symptom has a FAQ of its own');
  const a = faq!.a;
  assert.match(
    a,
    /lower-quality profile when the microphone opens is expected/i,
    'a drop to a lower-quality profile is named as expected behaviour'
  );
  assert.match(a, /mono call-grade audio/i, 'and named for what it actually is');
  assert.match(
    a,
    /complete silence is not normal profile behaviour/i,
    'and silence is explicitly separated from that expected change'
  );
  assert.match(
    a,
    /narrower and quieter, not absent/i,
    'the difference is described in the terms a reader can hear'
  );
  // The consequence still points somewhere: a reader told "this is not normal"
  // needs the next step, or the correction is just a dead end.
  assert.match(a, /step 4 and then step 5/i, 'and still routes the reader onward');
});
