import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ALL_TOOL_PAGES } from '../lib/tools/registry';
import { getToolContent } from '../lib/tools/content';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(repoRoot, rel), 'utf8').toLowerCase();

/**
 * Content-template regressions (site-wide content audit).
 *
 * `getToolContent` resolves per-tool prose through FLAGSHIP, then
 * CONTENT_BY_SLUG, then TEMPLATE_BY_CATEGORY. When a tool ships without its
 * own entry it silently inherits its category template — which previously
 * put keyboard advice on the gamepad page, controller advice on all six
 * supporting diagnostics, and browser-benchmark copy on the network pages.
 * These tests pin the resolution so any new tool without its own content
 * fails loudly instead of publishing a sibling tool's page text.
 */

/** Flattens a ToolContent object into one lowercase string for assertions. */
function contentText(content: ReturnType<typeof getToolContent>): string {
  const parts: string[] = [content.aboutTitle, ...content.about, ...content.tips];
  for (const p of content.problems) parts.push(p.problem, p.fix);
  for (const f of content.faqs) parts.push(f.q, f.a);
  return parts.join(' ').toLowerCase();
}

const contentBySlug = new Map(ALL_TOOL_PAGES.map((tool) => [tool.slug, contentText(getToolContent(tool))]));

test('every tool resolves to distinct content, not a category-template copy', () => {
  const byText = new Map<string, string[]>();
  for (const tool of ALL_TOOL_PAGES) {
    const text = contentBySlug.get(tool.slug)!;
    byText.set(text, [...(byText.get(text) ?? []), tool.slug]);
  }
  const duplicated = [...byText.entries()].filter(([, slugs]) => slugs.length > 1);
  assert.deepEqual(
    duplicated,
    [],
    `tools sharing identical content text (template leakage): ${duplicated.map(([, s]) => s.join(', ')).join('; ')}`,
  );
});

test('input-devices: each page describes its own device, not sibling devices', () => {
  // Vendor-software and keyboard-only advice must not leak into any sibling page.
  for (const slug of ['mouse-test', 'gamepad-test', 'touchscreen-test', 'click-speed-test', 'reaction-time-test']) {
    const text = contentBySlug.get(slug)!;
    for (const phrase of ['synapse', 'armoury crate', 'smc reset', 'mechanical keyboard', 'bypasses drivers']) {
      assert.ok(!text.includes(phrase), `${slug} must not contain keyboard-template phrase "${phrase}"`);
    }
  }
  // Switch chatter is keyboard AND mouse functionality — forbidden everywhere
  // except those two pages.
  for (const slug of ['gamepad-test', 'touchscreen-test', 'click-speed-test', 'reaction-time-test']) {
    assert.ok(!contentBySlug.get(slug)!.includes('switch chatter'), `${slug} must not contain "switch chatter"`);
  }
  // Mouse advice must not leak into the keyboard page.
  const keyboard = contentBySlug.get('keyboard-test')!;
  for (const phrase of ['dpi or polling rate', 'wheel movement', 'the middle button']) {
    assert.ok(!keyboard.includes(phrase), `keyboard-test must not contain mouse-template phrase "${phrase}"`);
  }
  // Gamepad page must talk about gamepads, not keyboards.
  const gamepad = contentBySlug.get('gamepad-test')!;
  assert.ok(gamepad.includes('gamepad api'), 'gamepad-test should mention the Gamepad API');
  for (const phrase of ['rollover', 'ghosting', 'key press']) {
    assert.ok(!gamepad.includes(phrase), `gamepad-test must not contain keyboard-template phrase "${phrase}"`);
  }
});

test('supporting tools: no sensor/controller template text remains', () => {
  const supporting = [
    'permission-diagnostics',
    'browser-compatibility',
    'codec-support',
    'webrtc-test',
    'browser-system-info',
    'devicetry-storage-inspector',
  ];
  for (const slug of supporting) {
    const text = contentBySlug.get(slug)!;
    for (const phrase of ['accelerometer', 'vibration motor', 'survived a drop', 'potentiometer', 'stick drifts without input', 'ios ask for permission differently']) {
      assert.ok(!text.includes(phrase), `${slug} must not contain sensor/controller-template phrase "${phrase}"`);
    }
  }
  // Per-tool functionality anchors — each page must describe its own job.
  assert.ok(contentBySlug.get('permission-diagnostics')!.includes('navigator.permissions.query'));
  assert.ok(contentBySlug.get('browser-compatibility')!.includes('matrix'));
  assert.ok(contentBySlug.get('codec-support')!.includes('mediarecorder.istypesupported'));
  assert.ok(contentBySlug.get('webrtc-test')!.includes('rtcpeerconnection'));
  assert.ok(contentBySlug.get('browser-system-info')!.includes('user-agent'));
  assert.ok(contentBySlug.get('devicetry-storage-inspector')!.includes('localstorage'));
});

test('network tools: no benchmark-template text; real network behavior disclosed', () => {
  const speed = contentBySlug.get('internet-speed-test')!;
  const ip = contentBySlug.get('what-is-my-ip')!;
  for (const [slug, text] of [['internet-speed-test', speed], ['what-is-my-ip', ip]] as const) {
    for (const phrase of ['gpu driver', 'thermal throttling', 'benchmark numbers', 'rendering pipeline']) {
      assert.ok(!text.includes(phrase), `${slug} must not contain benchmark-template phrase "${phrase}"`);
    }
  }
  assert.ok(speed.includes('speed.cloudflare.com'), 'speed test must disclose the Cloudflare measurement network');
  assert.ok(speed.includes('http round-trip'), 'speed test must disclose latency = HTTP RTT, not ICMP');
  assert.ok(ip.includes('one small request'), 'IP tool must disclose its single lookup request');
});

test('refresh-rate: rAF cadence, no dead-pixel template text', () => {
  const text = contentBySlug.get('refresh-rate-test')!;
  for (const phrase of ['a pixel stays black', 'backlight bleed', 'dead pixels', 'tv and external monitors']) {
    assert.ok(!text.includes(phrase), `refresh-rate-test must not contain screen-test phrase "${phrase}"`);
  }
  assert.ok(text.includes('requestanimationframe'), 'refresh-rate page must state it measures rAF cadence');
});

test('touchscreen: honest coverage language from the verdict gates', () => {
  const text = contentBySlug.get('touchscreen-test')!;
  // Aligned with coverageVerdict / multitouchVerdict in lib/testing/sensorGates.ts:
  // coverage is an observation over the 10×10 grid, not every-pixel certification;
  // the multi-touch number is observed, never the device maximum; mouse never counts.
  assert.ok(text.includes('10×10'), 'coverage grid must be described as 10×10');
  assert.ok(text.includes('dead spot smaller than one tile'), 'must state the sub-tile caveat');
  assert.ok(text.includes('not a certification'), 'coverage pass must be framed as observation, not certification');
  assert.ok(text.includes('highest number of simultaneous contacts actually observed'), 'touch count must be observed-only');
  assert.ok(!text.includes('maximum supported touch count is'), 'must never claim to show the device maximum');
  assert.ok(text.includes('mouse') && text.includes('never count'), 'mouse exclusion must be explained');
});

/**
 * The three non-flagship audio tools used to share one template with the
 * camera/microphone tools, so the tone generator and the voice recorder were
 * told about camera permissions, input levels, and media streams they never
 * touch. Each now has its own content; these pins fail if that shared text
 * ever creeps back onto an output-only page.
 */
test('audio tools: no shared camera/microphone template text leaks onto output-only pages', () => {
  const sharedTemplatePhrases = [
    'camera / microphone',
    'camera or microphone',
    'holding the camera',
    'every media stream is destroyed',
    'weak input levels',
    'why is my device not detected at all',
  ];
  for (const slug of ['speakers-test', 'tone-generator', 'voice-recorder']) {
    const text = contentBySlug.get(slug)!;
    for (const phrase of sharedTemplatePhrases) {
      assert.ok(!text.includes(phrase), `${slug} must not contain shared audio-template phrase "${phrase}"`);
    }
  }
  // Output-only tools must not claim to capture anything.
  for (const slug of ['speakers-test', 'tone-generator']) {
    assert.ok(
      !contentBySlug.get(slug)!.includes('microphone permission'),
      `${slug} is output-only and must not discuss a microphone permission`,
    );
  }
  // The voice recorder is the one audio tool that captures, so it is the one
  // allowed to mention a microphone permission and an OS microphone guide.
  const recorder = contentBySlug.get('voice-recorder')!;
  assert.ok(recorder.includes('raw pcm') && recorder.includes('wave'), 'recorder must describe raw PCM capture encoded to WAVE');
  assert.ok(recorder.includes('five minutes'), 'recorder must state the 5-minute capture cap');
});

test('audio tools: each page describes its own function', () => {
  const speakers = contentBySlug.get('speakers-test')!;
  assert.ok(speakers.includes('440'), 'speakers page must state the 440 Hz tone it actually plays');
  assert.ok(speakers.includes('confirm'), 'speakers page must explain user-confirmed channel verdicts');
  assert.ok(!speakers.includes('bass'), 'speakers page must not advertise a bass check the tool does not have');

  const tone = contentBySlug.get('tone-generator')!;
  for (const wave of ['sine', 'triangle', 'square', 'sawtooth']) {
    assert.ok(tone.includes(wave), `tone-generator page must list the ${wave} waveform`);
  }
  assert.ok(tone.includes('12,000') || tone.includes('12000'), 'tone-generator page must state its 20 Hz–12 kHz range');
  assert.ok(tone.includes('measures nothing'), 'tone-generator page must state it plays sound and measures nothing');

  const recorder = contentBySlug.get('voice-recorder')!;
  assert.ok(recorder.includes('wav'), 'recorder page must state the WAV export');
  assert.ok(!recorder.includes('mediarecorder'), 'recorder page must not claim it depends on MediaRecorder');
});

test('microphone: guidance never implies the meter is calibrated', () => {
  const text = contentBySlug.get('microphone-test')!;
  // MicrophoneTester derives the meter from an uncalibrated relative RMS
  // value (Math.min(100, rms * 280)), so absolute dB targets are meaningless.
  for (const phrase of ['-12 dB', '-6 db', '-50 dB', '-40 db', '50/60 hz']) {
    assert.ok(!text.includes(phrase), `microphone-test must not use absolute threshold "${phrase}" on a relative meter`);
  }
  assert.ok(text.includes('relative'), 'microphone page must state the meter is relative, not calibrated');
  assert.ok(text.includes('not comparable between devices'), 'readings must be stated as non-comparable across devices');
  // The browser capture path is standard, but call apps layer their own
  // processing on top — the page must not claim to be the apps' signal path.
  assert.ok(
    !text.includes('the signal path here is the one those apps use'),
    'microphone page must not claim its signal path is the one call apps use',
  );
  assert.ok(
    text.includes('noise suppression') && text.includes('automatic gain control'),
    'microphone page must explain that call apps apply their own processing',
  );
});

test('webcam: no lens-cover mechanism error and no guaranteed call-app parity', () => {
  const text = contentBySlug.get('webcam-test')!;
  assert.ok(
    !text.includes('if the feed freezes or the frame counter stops'),
    'the lens-cover tip claimed a frozen frame counter proves the sensor works — covering the lens cannot do that',
  );
  assert.ok(
    !text.includes('truthful rehearsal') && !text.includes('it will perform well there'),
    'webcam page must not promise identical results inside call apps',
  );
  assert.ok(text.includes('close preview'), 'webcam page should frame the parity as a preview, not a guarantee');
  // A low or falling frame rate has several possible causes; the page reports
  // the number and must not diagnose which one applies.
  assert.ok(
    !text.includes('that is usb bandwidth contention or thermal throttling'),
    'webcam page must not present USB bandwidth and heat as the certain diagnosis',
  );
  assert.ok(
    !text.includes('usually means usb bandwidth trouble'),
    'webcam page tip must not assert a cause from the frame-rate number alone',
  );
  assert.ok(text.includes('cannot distinguish them'), 'webcam page must state the causes are indistinguishable from the reading');
  for (const cause of ['usb bandwidth', 'heat', 'power saving', 'background load']) {
    assert.ok(text.includes(cause), `webcam page should list ${cause} as a possible cause`);
  }
});

test('screen-test: no frame-rate troubleshooting on a pattern test', () => {
  const text = contentBySlug.get('screen-test')!;
  for (const phrase of ['framerate readings', 'high-performance power mode', 'rated refresh rate']) {
    assert.ok(!text.includes(phrase), `screen-test must not carry frame-rate troubleshooting ("${phrase}")`);
  }
  // The screen tester renders patterns; it does not measure frame rate.
  assert.ok(!text.includes('measure timing'), 'screen-test must not claim it measures render timing');
  assert.ok(text.includes('night light') || text.includes('true tone'), 'screen-test should troubleshoot color filters instead');
  // One rendered pixel is only one physical pixel under the right settings.
  assert.ok(
    !text.includes('every rendered pixel corresponds to exactly one physical pixel'),
    'screen-test must not claim a strict 1:1 rendered-to-physical pixel mapping',
  );
  assert.ok(text.includes('browser zoom'), 'screen-test must name browser zoom as a factor');
  assert.ok(text.includes('overscan') || text.includes('scaling'), 'screen-test must name OS scaling / display settings as factors');
  // Neither the visibility of a single-pixel fault nor the one-to-one mapping
  // may be presented as guaranteed: both depend on scaling, settings, and
  // how close the user actually looks.
  assert.ok(
    !text.includes('single-pixel faults are visible'),
    'screen-test must not guarantee a single-pixel fault is visible at normal distance',
  );
  assert.ok(
    !text.includes('if you want the mapping to be reliable'),
    'screen-test must not present 100% zoom + native resolution as making the pixel mapping reliable',
  );
  assert.ok(
    !text.includes('to be pixel-accurate results'),
    'screen-test must not promise pixel-accurate results from a settings change',
  );
  assert.ok(text.includes('solid colour fields'), 'screen-test should say solid colours help reveal pixel defects');
  assert.ok(text.includes('inspect up close'), 'screen-test should advise inspecting the screen up close');
  assert.ok(text.includes('section by section'), 'screen-test should advise inspecting solid colour fields section by section');
  // Browser zoom redraws the pattern larger; it does not enlarge a defective
  // panel pixel, and it disturbs rendered-to-physical pixel mapping. It must
  // never be offered as a way to inspect or separate physical pixels.
  for (const phrase of [
    'browser zoom lets you magnify',
    'use browser zoom when you need to separate',
    'zoom the browser to separate a single pixel',
  ]) {
    assert.ok(!text.includes(phrase), `screen-test must not present browser zoom as a physical-pixel magnifier ("${phrase}")`);
  }
  assert.ok(
    text.includes('does not enlarge the panel') || text.includes('not the panel'),
    'screen-test should explain that zoom enlarges the rendered pattern, not the panel',
  );
  // The separate pixel-mapping FAQ must survive.
  assert.ok(
    text.includes('does one rendered pixel equal one physical pixel') && text.includes('not reliably'),
    'screen-test must keep the separate pixel-mapping FAQ',
  );
  assert.ok(
    text.includes('does not guarantee a one-to-one mapping') || text.includes('does not guarantee that a rendered pixel lines up'),
    'screen-test must state 100% zoom + native resolution does not guarantee a 1:1 mapping',
  );
});

test('system-info: does not claim to show everything a website can read', () => {
  const text = contentBySlug.get('browser-system-info')!;
  assert.ok(
    !text.includes('complete extent of what any web page can read'),
    'system-info page must not claim to be the complete set of web-readable data',
  );
  assert.ok(text.includes('representative sample'), 'system-info page must present itself as a sample of web-visible data');
});

test('codec-support: no claim that the Voice Recorder falls back to another container', () => {
  const text = contentBySlug.get('codec-support')!;
  assert.ok(
    !text.includes('voice recorder falls back'),
    'codec-support must not say the Voice Recorder switches recording containers',
  );
  assert.ok(
    text.includes('voice recorder is unaffected') || text.includes('never depends on mediarecorder'),
    'codec-support must state the Voice Recorder is unaffected because it does not use MediaRecorder',
  );
});

test('static pages: unsupported methodology claims stay removed', () => {
  const about = read('app/about/page.tsx');
  for (const phrase of [
    'rms vocal decibels',
    '100% confidence',
    'battery health',
    'render framerates',
  ]) {
    assert.ok(!about.includes(phrase), `app/about must not claim "${phrase}"`);
  }
  // The inspection guide is seven named checks, not the whole device API surface.
  for (const file of [
    'components/inspection/GuidedInspectionFlow.tsx',
    'components/LandingClient.tsx',
  ]) {
    const source = read(file);
    assert.ok(
      !source.includes('all available browser device apis'),
      `${file} must not claim the inspection covers every device API`,
    );
  }
  // The Brio 500 has no 1080p60 mode (Logitech: 1080p/30, 720p/60).
  for (const file of ['content/guides/buying/webcams-for-low-light-calls.ts', 'lib/products/registry.ts']) {
    assert.ok(!read(file).includes('1080p60 capture'), `${file} must not claim the Brio 500 captures 1080p60`);
  }
});

/**
 * Round-2 review fixes: claims that survived the first audit because they
 * read as hedged but were still asserting more than the tool measures.
 */
test('mic/speaker/gamepad: no over-claims the measurements cannot support', () => {
  const mic = contentBySlug.get('microphone-test')!;
  assert.ok(
    mic.includes('room echo') && mic.includes('wind noise'),
    'mic page must state that playback reveals room echo and wind noise',
  );

  const speakers = contentBySlug.get('speakers-test')!;
  for (const phrase of ['playback is capped at a deliberately safe gain level', 'so this tool will never be loud', 'fixed, safe gain']) {
    assert.ok(!speakers.includes(phrase), `speakers page must not guarantee a safe audible volume ("${phrase}")`);
  }
  assert.ok(
    speakers.includes('not a volume limiter') || speakers.includes('loudness you hear'),
    'speakers page must state loudness depends on the user’s system volume',
  );

  const gamepad = contentBySlug.get('gamepad-test')!;
  assert.ok(
    !gamepad.includes('a large constant offset means a worn potentiometer'),
    'an axis offset alone must not be presented as proof of potentiometer wear',
  );
  assert.ok(gamepad.includes('does not identify the cause'), 'gamepad page must say an offset does not identify its cause');
});

test('permission-diagnostics: reads states, never requests one', () => {
  // PermissionDiagnosticsTester only calls navigator.permissions.query(); it
  // must not render the "your browser will ask for access" panel.
  const view = read('components/ToolDetailView.tsx');
  assert.ok(
    !view.includes("tool.supporthint.tolowercase().includes('permission')"),
    'the permission card must not be triggered by the badge wording alone',
  );
  assert.ok(
    view.includes("tool.requiredapis.includes('navigator.mediadevices.getusermedia')"),
    'the permission card must be gated on an actual getUserMedia request',
  );
  const registry = read('lib/tools/registry.ts');
  assert.ok(
    !registry.includes("supporthint: 'permissions api'"),
    'permission-diagnostics badge must not read as a permission request',
  );
});

test('codec-support: badge names the APIs the probe actually calls', () => {
  // CodecSupportTester uses MediaRecorder.isTypeSupported() and
  // HTMLMediaElement.canPlayType() — it never touches MediaCapabilities.
  const registry = read('lib/tools/registry.ts');
  const probe = read('components/tests/CodecSupportTester.tsx');
  assert.ok(probe.includes('mediarecorder.istypesupported'), 'probe uses MediaRecorder.isTypeSupported');
  assert.ok(probe.includes('canplaytype'), 'probe uses canPlayType');
  const block = registry.slice(registry.indexOf("id: 'codec-support'"), registry.indexOf("id: 'webrtc-test'"));
  assert.ok(
    !block.includes('mediacapabilities'),
    'codec-support must not advertise the MediaCapabilities API it never calls',
  );
  assert.ok(block.includes('mediarecorder'), 'codec-support badge should name MediaRecorder');
});

test('contact: a real address, and no claim the form sends anything', () => {
  const contact = read('app/contact/page.tsx');
  assert.ok(contact.includes('contact@devicetry.com'), 'contact page must publish the address');
  assert.ok(contact.includes('mailto:contact@devicetry.com'), 'contact page must link the address as a mailto');
  assert.ok(
    contact.includes('submitted or sent automatically'),
    'contact page must state the message is not sent automatically',
  );
  // /privacy previously claimed the site ran no message inbox at all, which
  // contradicts publishing an address.
  const privacy = read('app/privacy/page.tsx');
  assert.ok(
    !privacy.includes('does not operate a message inbox'),
    'privacy page must not deny a contact method the site now publishes',
  );
  assert.ok(privacy.includes('contact@devicetry.com'), 'privacy page must name the same contact address');
});

test('inspection page: title and intro are rendered once', () => {
  const flow = read('components/inspection/GuidedInspectionFlow.tsx');
  assert.ok(
    !flow.includes('t.inspection.title'),
    'the flow must not re-render the page H1 already shown by app/inspection/page.tsx',
  );
  assert.ok(!flow.includes('t.inspection.subtitle'), 'the flow must not repeat the page intro');
  // The checklists and history must survive the header removal.
  assert.ok(flow.includes('preset_suites'), 'preset checklists must remain');
  assert.ok(read('app/inspection/page.tsx').includes('localhistorylist'), 'history section must remain');
});

test('guides: related tool links stay on-topic', () => {
  const guide = (p: string) => read(p);
  // The three the review flagged, plus the other cross-device mismatches.
  assert.ok(!guide('content/guides/audio/one-headphone-side-not-working.ts').includes("'internet-speed-test'"), 'headphone guide must not link the network speed test');
  assert.ok(!guide('content/guides/audio/microphone-too-quiet.ts').includes("'tone-generator'"), 'quiet-mic guide must not link the output-only tone generator');
  assert.ok(!guide('content/guides/input-gaming/controller-stick-drift.ts').includes("'touchscreen-test'"), 'controller guide must not link the touchscreen test');
  assert.ok(!guide('content/guides/buying/webcams-for-low-light-calls.ts').includes("'screen-test'"), 'webcam buying guide must not link the display pattern test');
  assert.ok(!guide('content/guides/video/webcam-not-working.ts').includes("'screen-test'"), 'webcam troubleshooting guide must not link the display pattern test');
  assert.ok(!guide('content/guides/input-gaming/keyboard-keys-not-registering.ts').includes("'mouse-test'"), 'keyboard guide must not link the mouse test');
  assert.ok(!guide('content/guides/input-gaming/mouse-double-clicking.ts').includes("'keyboard-test'"), 'mouse guide must not link the keyboard test');
  // Replacements must be relevant, not just fewer links.
  assert.ok(guide('content/guides/audio/microphone-too-quiet.ts').includes("'speakers-test'"), 'quiet-mic guide should link the speaker test it recommends itself');
});

test('guides: related guide links stay on-topic', () => {
  const guide = (p: string) => read(p);
  // A microphone guide under a headphones/speakers troubleshooting article is
  // the same cross-device filler the tool links were cleaned of.
  const headphone = guide('content/guides/audio/one-headphone-side-not-working.ts');
  assert.ok(
    !headphone.includes("'microphone-not-working'"),
    'headphone guide must not recommend a microphone guide',
  );
  assert.ok(
    headphone.includes("'budget-headphones'"),
    'headphone guide should recommend the headphone buying guide instead',
  );
  // ...and the link must not be a one-way stub: the pair is reciprocal.
  assert.ok(
    guide('content/guides/buying/budget-headphones.ts').includes("'one-headphone-side-not-working'"),
    'the headphone buying guide must link back to the one-side troubleshooting guide',
  );
  assert.ok(
    !guide('content/guides/audio/microphone-not-working.ts').includes("'one-headphone-side-not-working'"),
    'microphone guide must not recommend a headphone guide',
  );
  assert.ok(
    !guide('content/guides/buying/budget-headphones.ts').includes("'microphones-for-meetings'"),
    'headphone buying guide must not recommend a microphone buying guide',
  );
});

test('tables: no result table clips its columns on a phone', () => {
  // `overflow-hidden` on a table wrapper silently clips any column that does
  // not fit, losing values with no way to reach them.
  const tables = [
    'components/tests/BrowserCompatibilityTester.tsx',
    'components/tests/BrowserSystemInfoTester.tsx',
    'components/tests/CodecSupportTester.tsx',
    'components/tests/JavascriptBenchmarkTester.tsx',
    'components/tests/PermissionDiagnosticsTester.tsx',
    'components/tests/PrivacyStorageInspectorTester.tsx',
    'components/guides/GuideArticleView.tsx',
    'components/inspection/GuidedInspectionFlow.tsx',
  ];
  for (const file of tables) {
    const src = read(file);
    assert.ok(src.includes('scrollabletable'), `${file} must use the shared ScrollableTable wrapper`);
    const idx = src.indexOf('<table');
    const before = src.slice(Math.max(0, idx - 400), idx);
    assert.ok(
      !before.includes('overflow-hidden'),
      `${file} still wraps its table in overflow-hidden, which clips columns on mobile`,
    );
  }
  // The wrapper itself must be an accessible, keyboard-reachable scroll region.
  const wrapper = read('components/ui/ScrollableTable.tsx');
  assert.ok(wrapper.includes('role="region"') && wrapper.includes('tabindex={0}'), 'scroll region must be focusable for keyboard users');
  assert.ok(wrapper.includes('aria-label'), 'scroll region must carry an accessible name');
  assert.ok(wrapper.includes('overflow-x-auto'), 'wrapper must scroll rather than clip');
});
