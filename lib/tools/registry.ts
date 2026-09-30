import { ToolDefinition, ToolCategory } from './types';

export type { ToolDefinition, ToolCategory } from './types';

/**
 * Phase 9 final primary catalog — exactly 15 tools.
 * Supporting diagnostics (permission-diagnostics, browser-compatibility,
 * codec-support, webrtc-test, browser-system-info,
 * devicetry-storage-inspector) live in SUPPORTING_REGISTRY below: they get
 * pages under /test/ but are not primary catalog cards.
 */
/**
 * Share-ability policy per tool (post-deployment correction C).
 * 'score'  — numeric-score tool: the result score (CPS, ms) may be shared.
 * 'summary' — every other tool: only a generic Pass/Warning/Needs-attention
 *             sentence may be shared; never measurements, media, IPs, keys,
 *             clipboard content, or device identifiers.
 * Adding a tool defaults it to the restrictive 'summary' policy.
 */
const SHARE_POLICY: Record<string, 'score' | 'summary'> = {
  'reaction-time-test': 'score',
  'click-speed-test': 'score',
};

/** True when this tool's numeric result may be included in a share message. */
export function sharePolicyForTool(tool: Pick<ToolDefinition, 'id'>): 'score' | 'summary' {
  return SHARE_POLICY[tool.id] ?? 'summary';
}
export const TOOLS_REGISTRY: ToolDefinition[] = [
  {
    id: 'microphone-test',
    slug: 'microphone-test',
    category: 'audio-video' as ToolCategory,
    categoryLabel: 'Audio & Video',
    title: 'Microphone Test',
    shortDesc: 'Live input level meter with pitch detection and voice recorder tabs.',
    supportHint: 'Requires microphone permission',
    keywords: ['mic test', 'microphone test', 'audio input', 'test mic online', 'pitch detector', 'voice recorder'],
    iconType: 'microphone',
    requiredApis: ['navigator.mediaDevices.getUserMedia', 'AudioContext'],
    componentName: 'MicrophoneTester',
    tabId: 'level',
    relatedToolIds: ['voice-recorder', 'speakers-test', 'webcam-test'],
    supportLinks: [
      { label: 'Microphone permission help', href: '/test/permission-diagnostics' },
      { label: 'Microphone not working — troubleshooting guide', href: '/guides/microphone-not-working' },
    ],
    instructions: [
      'Click Start Test to grant microphone permission.',
      'Speak into your microphone and observe the live relative input level and waveform.',
      'Open the Pitch tab to detect musical pitch, or the Recorder tab to record and replay a 5-second sample.',
    ],
    limitations: [
      'Digital meter readings reflect browser input gain, not calibrated acoustic sound pressure (SPL).',
      'Noise suppression applied by your operating system or browser may alter waveforms.',
    ],
    troubleshooting: [
      'If permission is blocked, click the lock icon in your browser address bar and allow microphone access.',
      'Check that your headset or external mic is selected in the device dropdown.',
    ],
  },
  {
    id: 'webcam-test',
    slug: 'webcam-test',
    category: 'audio-video' as ToolCategory,
    categoryLabel: 'Audio & Video',
    title: 'Webcam Test',
    shortDesc: 'Inspect live camera stream, delivered resolution and frame rate — with a mirror mode.',
    supportHint: 'Requires camera permission',
    keywords: ['webcam test', 'camera test', 'test camera online', 'online mirror', 'webcam mirror'],
    iconType: 'webcam',
    requiredApis: ['navigator.mediaDevices.getUserMedia'],
    componentName: 'WebcamTester',
    tabId: 'test',
    relatedToolIds: ['microphone-test', 'speakers-test', 'screen-test'],
    supportLinks: [
      { label: 'Camera permission help', href: '/test/permission-diagnostics' },
      { label: 'Webcam not working — troubleshooting guide', href: '/guides/webcam-not-working' },
    ],
    instructions: [
      'Click Start Test to request camera access.',
      'View the stream properties, delivered resolution, and observed frame cadence.',
      'Switch to the Mirror tab for a full-screen, flipped preview you can use while grooming or framing a shot.',
    ],
    limitations: [
      'Delivered resolution depends on browser WebRTC constraints and hardware driver limits.',
      'Observed FPS measures video frame delivery rate, not display refresh rate.',
    ],
    troubleshooting: [
      'Ensure no other application (Zoom, Teams, OBS) is exclusively holding the camera lock.',
      'Unplug and reconnect external USB webcams if no stream appears.',
    ],
  },
  {
    id: 'speakers-test',
    slug: 'speakers-test',
    category: 'audio-video' as ToolCategory,
    categoryLabel: 'Audio & Video',
    title: 'Speaker & Headphone Test',
    shortDesc: 'Verify stereo separation by playing a 440 Hz tone to the left, right, and centre channels, then confirming what you hear.',
    supportHint: 'Requires Web Audio API',
    keywords: ['speaker test', 'sound test', 'audio test', 'left right audio test', 'stereo test', 'bass test'],
    iconType: 'headphones',
    requiredApis: ['AudioContext'],
    componentName: 'SpeakersTester',
    relatedToolIds: ['tone-generator', 'microphone-test', 'voice-recorder'],
    supportLinks: [
      { label: 'One side silent? Read the guide', href: '/guides/one-headphone-side-not-working' },
    ],
    instructions: [
      'Set your system volume to a moderate level — the tone is generated at a modest level, but the loudness you hear is set by your system volume and amplifier.',
      'Play the left, right, and centre tones in turn and confirm each channel you actually hear.',
      'Only channels you both played and confirmed count toward the verdict, so play all three.',
    ],
    limitations: [
      'The tone is generated at a modest level but there is no volume limiting — the loudness you hear depends on your system volume and amplifier, so keep levels moderate.',
      'Audible output verification relies on human listening confirmation — playing a tone alone proves nothing.',
      'Bluetooth headphones with mono hands-free profiles may mix both channels together.',
      'This is a channel separation check on a single 440 Hz tone. It does not measure loudness, sound quality, or frequency response.',
    ],
    troubleshooting: [
      'Make sure your physical mute switch or volume knob is not turned down.',
      'Check your operating system sound output device.',
    ],
  },
  {
    id: 'voice-recorder',
    slug: 'voice-recorder',
    category: 'audio-video' as ToolCategory,
    categoryLabel: 'Audio & Video',
    title: 'Online Voice Recorder',
    shortDesc: 'Record audio locally with pause/resume, playback, and download — nothing uploaded.',
    supportHint: 'Requires microphone permission',
    keywords: ['voice recorder', 'audio recorder', 'record mic online', 'voice memo'],
    iconType: 'microphone',
    requiredApis: ['navigator.mediaDevices.getUserMedia', 'AudioContext'],
    componentName: 'VoiceRecorderTester',
    relatedToolIds: ['microphone-test', 'speakers-test', 'tone-generator'],
    supportLinks: [
      { label: 'Recording sounds too quiet?', href: '/guides/microphone-too-quiet' },
    ],
    instructions: [
      'Click Start Recording to begin capturing audio; allow the microphone permission when prompted.',
      'Use Pause/Resume as needed, then click Stop when finished. A single take is capped at 5 minutes.',
      'Play back your recording and click Download to save a genuine WAV file to your device.',
    ],
    limitations: [
      'Recordings are stored purely in browser memory and capped at 5 minutes.',
      'The download is always a genuine WAV (audio/wav) — samples are captured as raw PCM and encoded to WAVE locally before download.',
    ],
    troubleshooting: [
      'If the audio is silent, verify the correct microphone is selected as the system default input.',
      'Check that microphone permissions are allowed for this site in the browser, then reload.',
    ],
  },
  {
    id: 'tone-generator',
    slug: 'tone-generator',
    category: 'audio-video' as ToolCategory,
    categoryLabel: 'Audio & Video',
    title: 'Tone Generator',
    shortDesc: 'Play reference tones at any frequency with sine, square, sawtooth, and triangle waves.',
    supportHint: 'Requires Web Audio API',
    keywords: ['tone generator', 'frequency generator', 'sine wave', 'test tone', 'bass tone'],
    iconType: 'headphones',
    requiredApis: ['AudioContext'],
    componentName: 'ToneGeneratorTester',
    relatedToolIds: ['speakers-test', 'voice-recorder', 'microphone-test'],
    instructions: [
      'Choose a frequency and waveform, then press Play.',
      'Adjust volume gradually — start low to protect your ears and speakers.',
      'Use the preset frequencies to check channel response across the audible range.',
    ],
    limitations: [
      'Sustained high volumes can damage hearing and speakers; keep levels moderate.',
      'Output frequency response depends on your playback hardware, not the generator.',
    ],
    troubleshooting: [
      'No sound? Check that the correct output device is selected and volume is up.',
      'Bluetooth devices may filter very low or very high frequencies.',
    ],
  },
  {
    id: 'keyboard-test',
    slug: 'keyboard-test',
    category: 'input-devices' as ToolCategory,
    categoryLabel: 'Input & Gaming',
    title: 'Keyboard Test',
    shortDesc: 'Press every key to verify registration, key rollover, and ghosting visually.',
    supportHint: 'Works with any keyboard layout',
    keywords: ['keyboard test', 'key test', 'keyboard tester', 'rollover test', 'ghosting test'],
    iconType: 'keyboard',
    requiredApis: ['Keyboard Events'],
    componentName: 'KeyboardTester',
    relatedToolIds: ['mouse-test', 'gamepad-test', 'click-speed-test'],
    supportLinks: [
      { label: 'Keys not registering? Read the guide', href: '/guides/keyboard-keys-not-registering' },
    ],
    instructions: [
      'Click the test area and press each physical key on your keyboard.',
      'Highlighted keys have registered; keys that stay dark are not being received.',
      'Hold multiple keys together to check rollover behavior.',
    ],
    limitations: [
      'Multimedia and Fn-only keys may be captured by the operating system before the browser.',
      'On some laptops the embedded controller filters certain key combinations.',
    ],
    troubleshooting: [
      'Test in another browser to rule out extension interference.',
      'Wireless keyboards: replace the battery and re-pair the dongle.',
    ],
  },
  {
    id: 'mouse-test',
    slug: 'mouse-test',
    category: 'input-devices' as ToolCategory,
    categoryLabel: 'Input & Gaming',
    title: 'Mouse Test',
    shortDesc: 'Verify left, right, and middle buttons, scroll wheel, and tracking accuracy.',
    supportHint: 'Works with touchpads and mice',
    keywords: ['mouse test', 'mouse tester', 'button test', 'scroll test', 'double click test'],
    iconType: 'mouse',
    requiredApis: ['Pointer Events'],
    componentName: 'MouseTester',
    relatedToolIds: ['keyboard-test', 'click-speed-test', 'gamepad-test'],
    supportLinks: [
      { label: 'Unwanted double-clicking? Read the guide', href: '/guides/mouse-double-clicking' },
    ],
    instructions: [
      'Click inside the test area with each mouse button and watch each one register.',
      'Scroll to verify the wheel direction and detents.',
      'Move the cursor around to confirm smooth tracking without jumps.',
    ],
    limitations: [
      'Browsers suppress the context menu inside the test area; this is expected.',
      'DPI and pointer acceleration are OS-level settings and are not measured here.',
    ],
    troubleshooting: [
      'A chattering button registering double clicks points to switch wear — see the guide.',
      'Try a different USB port or replace wireless batteries first.',
    ],
  },
  {
    id: 'gamepad-test',
    slug: 'gamepad-test',
    category: 'input-devices' as ToolCategory,
    categoryLabel: 'Input & Gaming',
    title: 'Gamepad Test',
    shortDesc: 'Press every controller button, move both sticks, and run a neutral drift check.',
    supportHint: 'Press any button to connect',
    keywords: ['gamepad test', 'controller test', 'gamepad tester', 'stick drift test', 'joystick test'],
    iconType: 'gamepad',
    requiredApis: ['Gamepad API'],
    componentName: 'GamepadTester',
    relatedToolIds: ['keyboard-test', 'mouse-test', 'touchscreen-test'],
    supportLinks: [
      { label: 'Stick drift? Read the guide', href: '/guides/controller-stick-drift' },
    ],
    instructions: [
      'Connect your controller by USB or Bluetooth and press any button.',
      'Watch each button and stick axis register in real time.',
      'Run the Neutral Drift Check with the sticks untouched for 2.5 seconds.',
    ],
    limitations: [
      'Connection alone does not verify every button — press each control to observe it.',
      'The drift threshold is this tool\u2019s approximate heuristic, not a manufacturer certification.',
    ],
    troubleshooting: [
      'Controller not detected? Press a button while the page is focused to wake the browser API.',
      'Some controllers need xpad/xone drivers on Linux or Steam Input to appear.',
    ],
  },
  {
    id: 'touchscreen-test',
    slug: 'touchscreen-test',
    category: 'input-devices' as ToolCategory,
    categoryLabel: 'Input & Gaming',
    title: 'Touchscreen Test',
    shortDesc: 'Touch each coverage tile and test multi-touch — mouse input never counts.',
    supportHint: 'Requires a touch-capable display',
    keywords: ['touchscreen test', 'touch test', 'multi touch test', 'touch screen checker'],
    iconType: 'touch',
    requiredApis: ['Pointer Events'],
    componentName: 'TouchscreenTester',
    tabId: 'touch',
    relatedToolIds: ['gamepad-test', 'mouse-test', 'screen-test'],
    instructions: [
      'Drag your finger across every tile until the full grid registers coverage.',
      'Open the Multi-Touch tab and place as many fingers as possible to observe simultaneous touches.',
      'Mouse clicks are tracked separately and never count as touch verification.',
    ],
    limitations: [
      'A single covered tile does not prove the whole screen works — cover every tile.',
      'Pen input is reported separately from finger touches.',
    ],
    troubleshooting: [
      'Clean the screen; some protectors reduce sensitivity at edges.',
      'If no touches register, verify the touch driver in Device Manager or System Settings.',
    ],
  },
  {
    id: 'click-speed-test',
    slug: 'click-speed-test',
    category: 'input-devices' as ToolCategory,
    categoryLabel: 'Input & Gaming',
    title: 'CPS & Spacebar Test',
    shortDesc: 'Measure clicks or spacebar presses per second over a bounded 5/10/30-second run.',
    supportHint: 'Bounded timed runs',
    keywords: ['cps test', 'click speed test', 'clicks per second', 'spacebar test', 'click counter'],
    iconType: 'mouse',
    requiredApis: ['Pointer Events', 'Keyboard Events'],
    componentName: 'ClickSpeedTester',
    relatedToolIds: ['reaction-time-test', 'mouse-test', 'keyboard-test'],
    instructions: [
      'Choose 5, 10, or 30 seconds, then start clicking (or pressing spacebar) when the timer begins.',
      'Your first click starts the run; the counter stops automatically at the end.',
      'Use Restart to run again — results are honest counts, no rankings or percentiles.',
    ],
    limitations: [
      'Results depend on your input device and browser timing; they are not universal skill ratings.',
      'Freeform (unbounded) counting is intentionally not offered — runs are bounded.',
    ],
    troubleshooting: [
      'Inconsistent counts? Disable browser features that throttle background timers.',
      'A mouse registering double inputs per click has a worn switch — see the mouse guide.',
    ],
  },
  {
    id: 'reaction-time-test',
    slug: 'reaction-time-test',
    category: 'input-devices' as ToolCategory,
    categoryLabel: 'Input & Gaming',
    title: 'Reaction Time Test',
    shortDesc: 'Measure visual response time over five attempts with a randomized wait.',
    supportHint: 'Five attempts per session',
    keywords: ['reaction time test', 'reaction tester', 'reflex test', 'response time'],
    iconType: 'gauge',
    requiredApis: ['performance.now()', 'Pointer Events'],
    componentName: 'ReactionTimeTester',
    relatedToolIds: ['click-speed-test', 'mouse-test', 'gamepad-test'],
    instructions: [
      'Press Start, wait for the panel to turn green, then click, tap, or press any key immediately.',
      'Clicking too early invalidates that attempt — wait for the green signal.',
      'Complete five valid attempts; the tool shows each time, your best, and the median.',
    ],
    limitations: [
      'Screen refresh latency, input-device latency, and browser scheduling all affect results.',
      'This is a browser-timing measurement — not a medical or cognitive assessment.',
    ],
    troubleshooting: [
      'Extremely inconsistent values usually mean background throttling or a busy CPU.',
      'Use a wired mouse and a fullscreen window for the most repeatable conditions.',
    ],
  },
  {
    id: 'screen-test',
    slug: 'screen-test',
    category: 'display' as ToolCategory,
    categoryLabel: 'Display & Screen',
    title: 'Screen Test',
    shortDesc: 'Dead-pixel, solid-pattern, and display-information checks in one tool.',
    supportHint: 'Fullscreen recommended',
    keywords: ['screen test', 'dead pixel test', 'display test', 'pixel checker', 'screen info'],
    iconType: 'monitor',
    requiredApis: ['Fullscreen API'],
    componentName: 'ScreenTestHub',
    tabId: 'dead-pixel',
    relatedToolIds: ['refresh-rate-test', 'webcam-test', 'touchscreen-test'],
    supportLinks: [
      { label: 'How to check for dead pixels', href: '/guides/checking-screen-dead-pixels' },
    ],
    instructions: [
      'Open the Dead Pixel tab and step through each solid color at fullscreen, looking for dots.',
      'Use the Patterns tab for gradients and grids that expose uniformity and banding.',
      'The Screen Info tab reports your display\u2019s browser-visible resolution and orientation.',
    ],
    limitations: [
      'A browser cannot read the physical panel; manufacturer specs may differ from what is reported.',
      'One clean pass over one color does not guarantee a flawless panel — check every color.',
    ],
    troubleshooting: [
      'Mark persistent bright/dark dots across colors as genuine pixel defects.',
      'Images that disappear on the next frame are likely software, not hardware.',
    ],
  },
  {
    id: 'refresh-rate-test',
    slug: 'refresh-rate-test',
    category: 'display' as ToolCategory,
    categoryLabel: 'Display & Screen',
    title: 'Refresh Rate Test',
    shortDesc: 'Measure browser frame timing to estimate your display\u2019s rendering cadence.',
    supportHint: 'Browser rendering timing',
    keywords: ['refresh rate test', 'hz test', 'fps test', 'display refresh checker'],
    iconType: 'gauge',
    requiredApis: ['requestAnimationFrame'],
    componentName: 'RefreshRateTester',
    relatedToolIds: ['screen-test', 'webcam-test', 'internet-speed-test'],
    instructions: [
      'Watch the live measurement stabilize over a few seconds.',
      'Compare the estimate against the HZ your monitor is configured for in OS settings.',
      'Close heavy background tabs; other work lowers the measured cadence.',
    ],
    limitations: [
      'This measures browser-rendering timing via requestAnimationFrame — it is not certification of the panel\u2019s specification or of gaming performance.',
      'A laptop on battery saver may be limited below its panel capability.',
    ],
    troubleshooting: [
      'Low reading? Check the OS display settings for the configured refresh rate.',
      'V-Sync or dynamic refresh features can make readings bounce between values.',
    ],
  },
  {
    id: 'internet-speed-test',
    slug: 'internet-speed-test',
    category: 'network' as ToolCategory,
    categoryLabel: 'Network',
    title: 'Internet Speed Test',
    shortDesc: 'Real download, upload, and latency measurements via the Cloudflare measurement network.',
    // Header copy only: the standing disclosure under the tester already
    // states the same thing, so the header goes straight from the title to
    // the "transfers real data" note. shortDesc stays as the page's meta
    // description and its card text in the catalog.
    hideHeaderDescription: true,
    supportHint: 'Transfers real data on start',
    keywords: ['internet speed test', 'speed test', 'bandwidth test', 'wifi speed test', 'download speed'],
    iconType: 'gauge',
    requiredApis: ['Fetch API', 'PerformanceResourceTiming'],
    componentName: 'InternetSpeedTester',
    relatedToolIds: ['what-is-my-ip', 'refresh-rate-test', 'webcam-test'],
    supportLinks: [
      { label: 'Low result? What it means', href: '/guides/low-internet-speed-result' },
    ],
    instructions: [
      'Press Start — the test immediately transfers real data, which can consume significant mobile data.',
      'Watch download, upload, and latency stream in as each phase completes.',
      'Stay on this tab during the run; background throttling distorts measurements.',
    ],
    limitations: [
      'Results reflect the connection to the selected measurement network at that moment — other networks may differ.',
      'Latency here is HTTP round-trip timing to the measurement endpoint, not ICMP ping.',
      'Measurements are collected by the provider on completion for aggregated internet-quality insights.',
    ],
    troubleshooting: [
      'A surprisingly low result often means Wi-Fi interference — test near the router or on cable.',
      'Stop downloads, streaming, and cloud backups before running the test.',
    ],
  },
  {
    id: 'what-is-my-ip',
    slug: 'what-is-my-ip',
    category: 'network' as ToolCategory,
    categoryLabel: 'Network',
    title: "What's My IP",
    shortDesc: 'Show the public IP address your connection presents, with one-click copy.',
    supportHint: 'Tiny lookup request',
    keywords: ['what is my ip', 'my ip address', 'ip lookup', 'public ip', 'ipv4 ipv6'],
    iconType: 'gauge',
    requiredApis: ['Fetch API'],
    componentName: 'WhatsMyIpTester',
    relatedToolIds: ['internet-speed-test', 'refresh-rate-test', 'screen-test'],
    instructions: [
      'Press Show My IP to send one small request to the lookup endpoint.',
      'Copy the result with the copy button if you need it elsewhere.',
      'IPv4 and IPv6 are identified where the connection makes that reliable.',
    ],
    limitations: [
      'The result may be a VPN or proxy address rather than your home connection.',
      'No location, ISP, or identity information is looked up or shown.',
    ],
    troubleshooting: [
      'A request that never completes may be blocked by an extension or corporate proxy.',
      'VPN users: this shows the VPN exit address by design.',
    ],
  },
];

/**
 * Supporting diagnostics: real pages, kept out of the primary catalog.
 * They are linked contextually from tool pages and help content.
 */
export const SUPPORTING_REGISTRY: ToolDefinition[] = [
  {
    id: 'permission-diagnostics',
    slug: 'permission-diagnostics',
    category: 'supporting' as ToolCategory,
    categoryLabel: 'Supporting',
    title: 'Permission Diagnostics',
    shortDesc: 'Read the permission states this browser reports for your site — and see exactly which ones it could not read.',
    supportHint: 'Read-only — never requests a permission',
    keywords: ['microphone permission', 'camera permission', 'camera blocked', 'mic blocked', 'permission status'],
    iconType: 'shield',
    requiredApis: ['Permissions API'],
    componentName: 'PermissionDiagnosticsTester',
    relatedToolIds: [],
    instructions: [
      'Open the page and read the Reported state column — it distinguishes Granted, Denied, Prompt, Not queryable and Query error.',
      'Treat a row marked Prompt as undecided, not as granted: nothing has been allowed yet.',
      'When a permission is blocked, change it in your browser\'s site settings (the address-bar icon) and press Re-query states.',
    ],
    limitations: [
      'A permission name this browser does not implement stays unknown; iOS Safari in particular exposes very few names, so a missing row there says nothing about the real state.',
      'A reported state is a browser bookkeeping value. It does not prove that a microphone or camera delivers sound or video — only a hardware test can show that.',
    ],
    troubleshooting: [
      'Chromium browsers: click the lock/tune icon left of the address bar, set the permission to Allow, then re-query. Firefox: use the padlock (or the Permissions entry in the page menu). Safari: the aA menu \u2192 Website Settings, then reload.',
      'If the whole page reports the Permissions API as unavailable, decide the permission in the failing tool\'s own prompt instead — the outcome of that prompt is the real state.',
    ],
  },
  {
    id: 'browser-compatibility',
    slug: 'browser-compatibility',
    category: 'supporting' as ToolCategory,
    categoryLabel: 'Supporting',
    title: 'Browser Compatibility',
    shortDesc: 'See which web APIs this browser actually exposes, including APIs it ships switched off.',
    supportHint: 'Passive read-only checks',
    keywords: ['browser compatibility', 'api support', 'browser capabilities'],
    iconType: 'shield',
    requiredApis: [],
    componentName: 'BrowserCompatibilityTester',
    relatedToolIds: [],
    instructions: [
      'Scan the matrix, or search for an API by name — the search matches the API name, its category, and the property the row reads.',
      'Use the category buttons to narrow the matrix; the selected category is marked as pressed.',
      'Read the What was read column when a row surprises you: it states the exact value the probe looked at.',
    ],
    limitations: [
      'Available means the API is present and usable. "Exposed, off" means the browser ships it but reports it switched off \u2014 a different situation from missing, and not fixable by updating.',
      'No row requests a permission or captures anything, so presence never proves a piece of hardware works.',
    ],
    troubleshooting: [
      'Update your browser if a required API is missing. If a row reports "Exposed, off", check the browser or operating-system setting that disables it rather than the browser version.',
    ],
  },
  {
    id: 'codec-support',
    slug: 'codec-support',
    category: 'supporting' as ToolCategory,
    categoryLabel: 'Supporting',
    title: 'Codec Support',
    shortDesc: 'See what this browser reports about recording containers and playback codecs \u2014 with \"maybe\" kept as \"maybe\".',
    supportHint: 'MediaRecorder.isTypeSupported + canPlayType',
    keywords: ['codec support', 'h264', 'video codec', 'codec check'],
    iconType: 'shield',
    requiredApis: ['MediaRecorder', 'HTMLMediaElement.canPlayType'],
    componentName: 'CodecSupportTester',
    relatedToolIds: [],
    instructions: [
      'Run the capability probe and read the Raw answer column \u2014 each row shows the literal value the browser returned.',
      'Treat a Maybe row as uncertain, not as supported: canPlayType returns confidence strings, not booleans.',
      'Check the How this was read column to see which API answered each row.',
    ],
    limitations: [
      'Both probes report the browser\'s own capability tables. Nothing here records, decodes, negotiates or hardware-accelerates media, and no row predicts call quality.',
      'A missing optional format is normal \u2014 browser builds ship different codec sets. This page\'s Voice Recorder is unaffected because it encodes WAV itself.',
    ],
    troubleshooting: [
      'If a format is reported missing and a specific app needs it, try a different browser build \u2014 some Chromium builds on Linux ship without proprietary codecs.',
    ],
  },
  {
    id: 'webrtc-test',
    slug: 'webrtc-test',
    category: 'supporting' as ToolCategory,
    categoryLabel: 'Supporting',
    title: 'WebRTC Capability Test',
    shortDesc: 'Run a real local peer-to-peer loopback and confirm echoed messages actually came back — no leak testing.',
    supportHint: 'Local loopback only \u2014 no STUN or TURN server',
    keywords: ['webrtc test', 'webrtc support', 'video call diagnostic'],
    iconType: 'shield',
    requiredApis: ['RTCPeerConnection'],
    componentName: 'WebRTCTester',
    relatedToolIds: [],
    instructions: [
      'Run the loopback: two peers are created in this tab, negotiate locally, and exchange five identified messages that the second peer echoes back.',
      'Check the Echo Replies figure \u2014 only unique, correctly matched replies count. Duplicates and unrelated messages are reported separately and never counted.',
      'Compare Handshake (time to \"connected\") with Echo RTT (the median round trip of those replies); they are separate measurements.',
    ],
    limitations: [
      'This is a local capability test. It is not a leak test and does not evaluate VPN or DNS behavior.',
      'A pass covers this browser only: no microphone or camera is captured, and no request leaves the page \u2014 so it is not evidence that a call connects across the internet.',
    ],
    troubleshooting: ['Strict privacy extensions may block peer connections; disable them to retest.'],
  },
  {
    id: 'browser-system-info',
    slug: 'browser-system-info',
    category: 'supporting' as ToolCategory,
    categoryLabel: 'Supporting',
    title: 'Browser & System Info',
    shortDesc: 'A labelled snapshot of what this browser exposes \u2014 screen, viewport, pixel ratio, and user-agent estimates.',
    supportHint: 'Read-only informational snapshot',
    keywords: ['browser info', 'system info', 'user agent', 'screen resolution'],
    iconType: 'shield',
    requiredApis: [],
    componentName: 'BrowserSystemInfoTester',
    relatedToolIds: [],
    instructions: [
      'Review the values with their sources: screen dimensions, viewport dimensions and device pixel ratio are three separate readings, and each row states what it is.',
      'Read engine, OS and architecture as estimates parsed from the user-agent string \u2014 a spoofing extension can rewrite every one of them.',
      'Press Re-read after resizing the window or changing display scaling to see the viewport and pixel ratio update.',
    ],
    limitations: [
      'This is an informational snapshot, not a diagnostic: it reports values and cannot pass or fail any hardware.',
      'Browsers expose only partial device information. The panel\'s true physical resolution is not knowable from a web page, and memory and core counts are capped or bucketed.',
    ],
    troubleshooting: ['Values vary by browser privacy settings and OS scaling — that is expected, not an error.'],
  },
  {
    id: 'devicetry-storage-inspector',
    slug: 'devicetry-storage-inspector',
    category: 'supporting' as ToolCategory,
    categoryLabel: 'Supporting',
    title: 'DeviceTry Storage Inspector',
    shortDesc: "Inventory every localStorage key DeviceTry owns, export it, and clear it with a verified result.",
    supportHint: 'This origin\'s localStorage keys only',
    keywords: ['clear data', 'local storage', 'privacy controls', 'delete history'],
    iconType: 'shield',
    requiredApis: ['localStorage'],
    componentName: 'PrivacyStorageInspectorTester',
    relatedToolIds: [],
    instructions: [
      'Read the owned-key table: each DeviceTry key is listed with what it holds, its size, and whether it is currently stored.',
      'Individual test results and saved guided inspections are counted separately, so you can see which is using space.',
      'Export Backup whenever either count is above zero \u2014 it downloads a versioned JSON file of exactly the data listed here.',
      'Clear Owned Data asks for confirmation, removes only the registered keys, and re-reads the store to verify each one is gone.',
    ],
    limitations: [
      'Clearing cannot be undone.',
      'Only DeviceTry\'s own localStorage keys are removed. Cookies, IndexedDB, Cache Storage, service-worker caches and other origins are not touched, and the cookie figure shown is only what document.cookie can see.',
    ],
    troubleshooting: [
      'If the page says storage is unavailable rather than empty, your browser is blocking site data for this origin \u2014 allow it in the address-bar settings and reload.',
      'If a deletion reports a partial failure, reload and try again; the table shows which key survived.',
    ],
  },
];

/** Every renderable tool page (primary + supporting). */
export const ALL_TOOL_PAGES: ToolDefinition[] = [...TOOLS_REGISTRY, ...SUPPORTING_REGISTRY];

export function findToolBySlug(slug: string): ToolDefinition | undefined {
  return ALL_TOOL_PAGES.find((tool) => tool.slug === slug);
}
