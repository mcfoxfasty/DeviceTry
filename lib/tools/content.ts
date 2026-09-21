import { ToolDefinition } from './types';

export interface ToolFaq {
  q: string;
  a: string;
}

export interface ToolOsGuide {
  os: string;
  steps: string[];
}

export interface ToolContent {
  /** H2 + prose paragraphs rendered below the tester */
  aboutTitle: string;
  about: string[];
  /** "How to get accurate results" bullets */
  tipsTitle: string;
  tips: string[];
  /** "Common problems and fixes" — pairs */
  problemsTitle: string;
  problems: { problem: string; fix: string }[];
  /** Per-OS settings walkthroughs (omit when irrelevant) */
  osGuidesTitle: string;
  osGuides?: ToolOsGuide[];
  /** Expandable Q&A; also emitted as FAQPage JSON-LD */
  faqTitle: string;
  faqs: ToolFaq[];
}

const osGuidesTitleDefault = 'Allow access in your system settings';

/* ============================ Flagship: Microphone ============================ */

const microphoneContent: ToolContent = {
  aboutTitle: 'Why test your microphone online?',
  about: [
    'Your microphone is the one component every video call, voice note, podcast, and online interview depends on — and it fails more often than you think. Operating system updates silently reset privacy permissions, conferencing apps grab exclusive input locks, and USB headsets lose their default-device status after a reboot. A 60-second online microphone test tells you instantly whether your voice actually reaches the computer, how strong the input level is, and whether background noise is drowning you out.',
    'This tester uses the same standardized browser APIs (getUserMedia and the Web Audio Analyser) that Zoom, Google Meet, and Microsoft Teams use internally. That means what you see here is a faithful preview of what those apps will hear. No software installation, no drivers, no account — the audio never leaves your browser, and the meter, waveform, and optional recording all run locally in memory.',
  ],
  tipsTitle: 'How to get an accurate result',
  tips: [
    'Speak at the distance you would actually sit from the mic during a call — about 15–25 cm (6–10 inches) for a headset boom.',
    'Watch the meter while silent for a few seconds first: a resting level above -40 dB usually means an aggressive gain or noisy preamp.',
    'If the level barely moves, raise the input volume in your system sound settings (70–90% is a good target).',
    'Use headphones if you are testing near speakers — otherwise your mic picks up their output and can feed back.',
    'Record a short sample and play it back: meters show volume, but only playback reveals distortion, crackle, or hiss.',
    'Disable browser noise suppression temporarily if you want to judge the raw signal your mic produces.',
  ],
  problemsTitle: 'Common microphone problems and fixes',
  problems: [
    {
      problem: 'The meter shows nothing when I speak',
      fix: 'The wrong device may be selected. Open your system sound settings and confirm the input device matches your headset or webcam mic, then reload this page and re-allow permission.',
    },
    {
      problem: 'The level is very low even when I speak loudly',
      fix: 'Raise the microphone input level in system settings (Windows: Settings → System → Sound → Input; macOS: System Settings → Sound → Input). Also disable "automatic gain control" in your conferencing app, which can fight the browser.',
    },
    {
      problem: 'Other people hear robotic or distorted audio',
      fix: 'Distortion usually means the input level is clipping. Keep peaks below -6 dB on the meter, and close apps that may be processing audio in the background (noise removers, virtual cables, voice changers).',
    },
    {
      problem: 'Microphone works here but not in Zoom/Teams',
      fix: 'Conferencing apps can hold an exclusive lock or select a different input. Fully quit the app (check the system tray), then reopen it — or the reverse: quit the app before testing here for a clean measurement.',
    },
    {
      problem: 'A constant hiss or hum is always present',
      fix: 'Hiss at high gain is normal for cheap analog mics. A 50/60 Hz hum points to electrical interference — try a different USB port, move cables away from power bricks, or use the mic on another device to isolate the cause.',
    },
  ],
  osGuidesTitle: osGuidesTitleDefault,
  osGuides: [
    {
      os: 'Windows 10 & 11',
      steps: [
        'Open Settings → Privacy & security → Microphone.',
        'Enable "Microphone access" and "Let apps access your microphone".',
        'Under "Let desktop apps access…", make sure your browser is allowed.',
        'Check Settings → System → Sound → Input to select the right device and set the input volume.',
      ],
    },
    {
      os: 'macOS',
      steps: [
        'Open System Settings → Privacy & Security → Microphone.',
        'Enable the toggle next to your browser (Chrome, Safari, Firefox…).',
        'Check System Settings → Sound → Input and select your microphone; watch the input level respond as you speak.',
      ],
    },
    {
      os: 'Linux (PulseAudio / PipeWire)',
      steps: [
        'Open your audio settings (pavucontrol or GNOME/KDE sound settings).',
        'On the Input Devices tab, confirm your mic is not muted and set a sensible base volume.',
        'On the Recording tab, verify your browser appears and receives signal while testing.',
      ],
    },
  ],
  faqTitle: 'Microphone test FAQ',
  faqs: [
    {
      q: 'Is this online microphone test really free?',
      a: 'Yes — completely. There is no registration, no watermark, no recording limit, and no upload. The test runs entirely in your browser using standard Web APIs.',
    },
    {
      q: 'Can I test a Bluetooth headset or AirPods?',
      a: 'Yes. Pair them first and select them as the system input device before reloading the page. Note that most Bluetooth headsets switch to a lower-quality codec while the microphone is active — that is a headset limitation, not a browser one.',
    },
    {
      q: 'Why does the recording sound worse than the live meter?',
      a: 'Playback passes through your output chain (sound card, speakers/headphones), and echo cancellation or noise suppression may process the recording. Test with headphones to separate mic quality from playback quality.',
    },
    {
      q: 'How many microphones can I test?',
      a: 'As many as your system exposes — internal laptop mics, USB webcams with built-in mics, headset booms, and audio interfaces. Switch the system default input device and reload to test the next one.',
    },
    {
      q: 'Does the test work on iPhone and Android?',
      a: 'Yes. On iOS, Safari will prompt for microphone permission the first time; on Android, Chrome behaves the same as desktop. Built-in phone mics usually have aggressive noise suppression, so expect a cleaner but more processed waveform.',
    },
    {
      q: 'What is a healthy input level for voice calls?',
      a: 'Aim for speech peaks between -12 dB and -6 dB with silence resting near -50 dB or lower. That gives apps enough signal without clipping, which is what causes distorted, "hot" audio.',
    },
  ],
};

/* ============================ Category templates ============================ */

function audioCameraContent(tool: ToolDefinition): ToolContent {
  return {
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} runs entirely inside your browser using standard media and audio APIs — the same building blocks that video conferencing platforms rely on. Nothing is installed, nothing is uploaded, and the moment you close the tab every media stream is destroyed.`,
      `Running a quick check before an important call, a recording session, or a hardware purchase catches silent failures early: blocked permissions, wrong default devices, weak input levels, or degraded capture quality that you would otherwise only discover in the middle of a meeting.`,
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Close other apps that may be holding the camera or microphone exclusively before starting.',
      'Prefer headphones over speakers so audio routing stays clean and feedback-free.',
      'If a permission prompt appears, click Allow — access stays local to your device.',
      'Repeat the test after changing any system setting to confirm the fix took effect.',
      'Use the latest version of Chrome, Edge, Firefox, or Safari for the fullest API support.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'Permission prompt never appears',
        fix: 'Access may be blocked globally. Check your browser site settings (lock icon in the address bar) and your OS privacy settings, then reload.',
      },
      {
        problem: 'Device works elsewhere but not here',
        fix: 'Another app might hold an exclusive lock. Quit conferencing and voice apps completely (check the system tray), then reload this page.',
      },
      {
        problem: 'Quality seems poor or unstable',
        fix: 'Wireless devices drop quality under load or low battery. Test a wired connection to isolate whether the device or the radio link is the problem.',
      },
    ],
    osGuidesTitle: osGuidesTitleDefault,
    osGuides: [
      {
        os: 'Windows',
        steps: [
          'Open Settings → Privacy & security → Camera / Microphone.',
          'Allow access for apps and desktop apps — your browser needs the desktop-app toggle.',
        ],
      },
      {
        os: 'macOS',
        steps: [
          'Open System Settings → Privacy & Security → Camera / Microphone.',
          'Enable the toggle next to your browser, then relaunch the browser if it does not ask again.',
        ],
      },
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        q: `Is the ${tool.title} free to use?`,
        a: 'Yes. Every tester on DeviceTry is free, unlimited, and requires no account. Your media never leaves the browser.',
      },
      {
        q: 'Which browsers are supported?',
        a: 'Any modern browser with WebRTC and Web Audio support — current versions of Chrome, Edge, Firefox, Opera, and Safari all work.',
      },
      {
        q: 'Why is my device not detected at all?',
        a: 'Check the physical connection first (try another USB port), then confirm the device is enabled as the system default. Operating systems silently disable unused cameras and microphones to save power.',
      },
    ],
  };
}

function keyboardMouseContent(tool: ToolDefinition): ToolContent {
  return {
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} reads raw input events directly in your browser and visualizes exactly what your computer receives. Because it bypasses drivers and vendor software, it is the cleanest way to answer a simple question: does this key, button, or wheel actually work — and does it work consistently?`,
      'It is equally useful for troubleshooting worn hardware and for verifying new gear: mechanical keyboard rollover, mouse switch chatter, and double-click faults show up here within seconds, with no software installation and nothing leaving your machine.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Test every key or button in a steady rhythm rather than one fast sweep — intermittent faults appear under repetition.',
      'If a key only registers sometimes, clean around its switch; debris is the number-one cause of single-key failure.',
      'For multi-key tests, hold combinations as you would while gaming to reveal rollover limits.',
      'Compare against a second keyboard or mouse if you have one — it immediately isolates hardware from software.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'Some keys or buttons do not register',
        fix: 'Clean the switch area with compressed air. If cleaning does not help, the switch is likely worn — the visual result here is your evidence for a warranty claim.',
      },
      {
        problem: 'A key registers twice on one press',
        fix: 'That is switch chatter, a classic failing-switch symptom on both keyboards and mouse buttons. If it appears consistently across reloads, the hardware needs replacement.',
      },
      {
        problem: 'Input feels delayed',
        fix: 'Wireless interference or power saving causes most latency. Try a wired connection or a different USB port — preferably one directly on the computer, not a hub.',
      },
    ],
    osGuidesTitle: 'Notes for specific systems',
    osGuides: [
      {
        os: 'Windows',
        steps: [
          'Update or remove vendor utility software ( Armoury Crate, Razer Synapse, Logi Options+) when diagnosing — it can remap or filter keys.',
          'Check Device Manager for HID-compliant device warnings if input fails completely.',
        ],
      },
      {
        os: 'macOS',
        steps: [
          'Check System Settings → Keyboard → Input Sources if certain characters behave unexpectedly.',
          'Reset the SMC on older Macs when entire key clusters go dead — it controls USB power.',
        ],
      },
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        q: 'Can this test damage my keyboard or mouse?',
        a: 'No. The tester only listens to standard input events your OS already produces — it never sends anything back to the device.',
      },
      {
        q: 'Does it detect stuck or ghosting keys?',
        a: 'Yes. Every key press is drawn on screen, so stuck keys stay highlighted and ghosting (missing keys during multi-key presses) is immediately visible.',
      },
      {
        q: 'Can I use this to test a new keyboard before the return window closes?',
        a: 'That is exactly what it is for. Walk through every key, test rollover with your typical gaming or typing combinations, and keep a screenshot as a record.',
      },
    ],
  };
}

function screenContent(tool: ToolDefinition): ToolContent {
  return {
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} uses your browser to render test patterns, measure timing, or read display capabilities directly from the graphics pipeline. It works identically on laptops, external monitors, and even TVs driving a browser, making it the fastest way to evaluate any screen without installing anything.`,
      'Use it before accepting a new display delivery, after a drop or pressure damage, when shopping second-hand, or whenever text looks fuzzy and you need to determine whether the panel, the cable, or a system scaling setting is at fault.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Set the display to its native resolution before testing — scaled resolutions mask pixel-level faults.',
      'Clean the screen first; dust and fingerprints read as false dead pixels at close inspection.',
      'Inspect from straight ahead and then from a slight angle — some panel defects only appear off-axis.',
      'For pattern tests, enable fullscreen mode and step back about half a meter for the whole-panel view.',
      'Run the test on both dark and bright room lighting to reveal contrast and backlight differences.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'A pixel stays black on every color',
        fix: 'That is a dead pixel. A pixel stuck on one color is "stuck" — sometimes fixed by rapidly cycling colors, but persistent faults are panel hardware defects covered by most manufacturer pixel policies.',
      },
      {
        problem: 'Edges of the screen look brighter or cloudier',
        fix: 'That is backlight bleed, common on LCD panels. Minor bleed is normal; severe glow visible in normal content justifies an exchange within the return window.',
      },
      {
        problem: 'Framerate readings look lower than expected',
        fix: 'Browsers cap rendering to the display refresh rate and pause when idle. Enable high-performance power mode and check that your monitor is actually configured for its rated refresh rate in system settings.',
      },
    ],
    osGuidesTitle: 'Before you test',
    osGuides: [
      {
        os: 'Any system',
        steps: [
          'Set resolution and refresh rate to the panel’s maximum in system display settings.',
          'Disable Night Light / f.lux / True Tone — color filters change what patterns look like.',
          'Use a fullscreen browser window (F11) to hide interface chrome from the tested area.',
        ],
      },
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        q: 'Can a screen test fix dead pixels?',
        a: 'No software can repair a physically dead pixel. Rapid color cycling occasionally revives stuck subpixels, but persistent defects are hardware — the value of the test is documenting them while your return or warranty window is open.',
      },
      {
        q: 'How small a defect can this detect?',
        a: 'Single-pixel faults are visible on pattern tests when viewed at normal distance. Zoom in for subpixel-level inspection; every rendered pixel corresponds to exactly one physical pixel at native resolution.',
      },
      {
        q: 'Does it work on TVs and external monitors?',
        a: 'Yes — anything the browser can render to. Just remember TVs often apply motion smoothing and overscan that you should disable first for pixel-accurate results.',
      },
    ],
  };
}

function sensorsControllersContent(tool: ToolDefinition): ToolContent {
  return {
    osGuidesTitle: osGuidesTitleDefault,
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} reads sensor or controller data straight from your device’s hardware through standard web APIs, visualizing the raw live signal so you can confirm the hardware actually responds. No companion app, no pairing utilities, no drivers.`,
      'Typical uses include verifying a used phone or controller before buying, checking whether an accelerometer, vibration motor, or gamepad survived a drop, and confirming that a wireless controller is properly connected and drift-free before a gaming session.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Grant any permission prompts the tester requests — sensor access is gated by the browser for privacy.',
      'On iPhones, motion and orientation sensors need an explicit permission tap on first use; the tester will show the button.',
      'For controllers, press any button once to wake the connection before reading the axes.',
      'Rest the device on a flat surface first to see the sensor’s neutral reading, then move it deliberately.',
      'Keep Bluetooth controllers near the computer while testing to rule out radio dropouts.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'No sensor data appears at all',
        fix: 'Confirm the browser supports the API (Chromium browsers are the most complete), disable shields or content blockers for this site, and check that no system setting restricts motion sensor access.',
      },
      {
        problem: 'Values seem frozen or implausible',
        fix: 'Sensors idle aggressively on mobile to save power. Move the device, tap the screen, or press a controller button to wake the hardware stream, then re-read the values.',
      },
      {
        problem: 'A controller stick drifts without input',
        fix: 'Small drift under 2–3% is normal analog tolerance. Larger constant drift means a worn potentiometer — clean around the stick base first; if it persists, the module needs replacement.',
      },
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        q: 'Does this work with any controller brand?',
        a: 'Xbox, PlayStation, Switch Pro, and generic PC controllers all expose the standard Gamepad API. Vendor-exclusive features (rumble patterns, audio) depend on browser support, not this tester.',
      },
      {
        q: 'Why does iOS ask for permission differently?',
        a: 'Apple requires an explicit user gesture to enable motion sensors. The tester shows a dedicated enable button for this — it is a platform rule, not a bug.',
      },
      {
        q: 'Is any of this data uploaded?',
        a: 'No. Sensor readings render locally and vanish when you close the tab.',
      },
    ],
  };
}

function musicContent(tool: ToolDefinition): ToolContent {
  return {
    osGuidesTitle: osGuidesTitleDefault,
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} uses high-precision Web Audio analysis to give you a reference-quality measurement or reference signal in the browser — accurate enough for instrument practice, audio setup checks, and quick ear training.`,
      'It works entirely offline once loaded and respects your audio hardware: nothing is recorded, nothing is transmitted, and every generated or analyzed sound exists only for the moment it plays.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Use headphones for the cleanest signal path — laptop speakers color both playback and pickup.',
      'Keep background noise down; analysis tools read the whole room, not just your instrument.',
      'Give the tester a steady, sustained input (a held note, a stable tone) for the most accurate reading.',
      'If readings jump around, lower your input gain slightly — clipping corrupts pitch and frequency analysis.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'The detected note or pitch is unstable',
        fix: 'Feed the tester a cleaner signal: play closer to the microphone, sustain the note, and reduce room noise. Fast vibrato or plucked notes naturally fluctuate — judge the stable middle of the sound.',
      },
      {
        problem: 'No sound is produced at all',
        fix: 'Browsers block audio until you interact with the page — click any button first. Then check your system output device and volume.',
      },
      {
        problem: 'Readings differ from my hardware tuner',
        fix: 'Small differences are normal: microphone placement, room acoustics, and analysis window size all influence measurement. Use the same reference (A=440 Hz) on both devices when comparing.',
      },
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        q: 'Can I tune instruments with this?',
        a: 'Yes — the analysis is sample-accurate for standard tuning ranges. Use a direct line-in or a close microphone for the most stable needle.',
      },
      {
        q: 'Does the tone generator damage speakers?',
        a: 'Sustained high-volume sine waves stress drivers, especially tweeters. Keep volumes moderate and avoid long full-power sweeps on laptop or phone speakers.',
      },
      {
        q: 'Can I use it for ear training?',
        a: 'Absolutely — generate reference intervals and test yourself. It is a favorite use among music students.',
      },
    ],
  };
}

function browserPerfContent(tool: ToolDefinition): ToolContent {
  return {
    osGuidesTitle: osGuidesTitleDefault,
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} interrogates your browser’s runtime — rendering pipeline, storage, codecs, network stack, or JavaScript engine — and reports exactly what your current setup supports and how it performs. It is the fastest way to answer "is it my hardware, my browser, or my settings?" without opening developer tools.`,
      'Because the whole diagnostic runs locally, results reflect your real environment: your actual GPU driver, your extensions, your privacy settings, and your network conditions — not a sanitized cloud benchmark.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Close other tabs and apps before benchmark-style tests so your machine has full resources.',
      'Disable content blockers for this page — they can skew feature-detection and storage results.',
      'Run the test twice and compare: consistent numbers mean a stable environment.',
      'Note that private/incognito windows restrict storage APIs and will change some results.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'A feature shows as unsupported',
        fix: 'Feature support depends on browser engine and version, plus privacy settings. Update your browser first; if it persists, check flags and site permissions — some APIs require secure HTTPS contexts.',
      },
      {
        problem: 'Scores vary a lot between runs',
        fix: 'Background activity — updates, sync, thermal throttling — introduces noise. Close everything, plug in the power adapter on laptops, and test on a cool machine.',
      },
      {
        problem: 'Storage or clipboard reads as blocked',
        fix: 'Private windows, hardened privacy settings, and extensions block these by design. Test in a normal window with default settings, then reintroduce extensions one by one to find the culprit.',
      },
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        q: 'Why do benchmark numbers differ from other websites?',
        a: 'Every benchmark measures different operations with different weighting. Treat results as relative: compare runs on the same machine and browser, not across different tools.',
      },
      {
        q: 'Does testing affect my data or storage?',
        a: 'No. Storage checks only read availability and types — they never inspect or modify your actual site data, and everything runs in your local session.',
      },
      {
        q: 'Can I use this to compare two computers?',
        a: 'Yes, for browser-level performance. Keep in mind the browser version, extensions, and OS power mode matter as much as the hardware.',
      },
    ],
  };
}

/* ============================ Flagship overrides ============================ */

const FLAGSHIP: Record<string, ToolContent> = {
  'microphone-test': microphoneContent,
  webcam: {} as ToolContent, // replaced below (defined explicitly)
};

// Webcam flagship (explicit, detailed)
const webcamContent: ToolContent = {
  aboutTitle: 'Why test your webcam online?',
  about: [
    'Camera failures are famously silent: the permission got revoked by an OS update, another app is holding the camera, or the built-in webcam simply died after a firmware update. This webcam test shows your live video feed within seconds, along with the resolution and frame rate your camera is actually delivering — numbers most conferencing apps hide from you.',
    'Because the tester uses the same getUserMedia pipeline as Zoom, Meet, and Teams, it is a truthful rehearsal for your next call: if your camera performs well here, it will perform well there. Everything stays local — frames are processed in browser memory and destroyed when you close the tab.',
  ],
  tipsTitle: 'How to get an accurate result',
  tips: [
    'Test in the lighting you actually use for calls — webcam sensors change behavior dramatically between bright and dim rooms.',
    'Check the reported resolution against the camera’s spec: 1080p webcams often default to 720p until you set it in the conferencing app.',
    'Watch the frame rate while waving a hand; stutter below 20 fps usually means USB bandwidth trouble, not a broken camera.',
    'Cover the lens with your hand — if the feed freezes or the frame counter stops, the sensor is responsive and working.',
    'If you use an external webcam, test both it and the built-in one to know which fallback you have in emergencies.',
  ],
  problemsTitle: 'Common webcam problems and fixes',
  problems: [
    {
      problem: 'Black screen but permission is granted',
      fix: 'Another app is usually holding the camera. Quit Zoom/Teams/Snap Camera entirely (check the system tray and Task Manager), then reload this page.',
    },
    {
      problem: 'Video is very dark or washed out',
      fix: 'Webcams auto-expose to the whole scene. Face a window or lamp instead of sitting in front of it, and disable "auto low-light correction" in your conferencing app if highlights look blown.',
    },
    {
      problem: 'The image is blurry',
      fix: 'Fixed-focus webcams have a sweet spot around 50–80 cm. Manual-focus lenses have a ring on the barrel — adjust it slowly until your face sharpens. Also clean the lens; laptop cameras collect fingerprints.',
    },
    {
      problem: 'Frame rate drops after a minute',
      fix: 'That is USB bandwidth contention or thermal throttling. Move the camera to a different USB port (prefer USB 3.0, directly on the machine), and unplug other high-bandwidth devices like capture cards.',
    },
    {
      problem: 'Camera works here but not in my meeting app',
      fix: 'The app may be pointed at a different device (a virtual camera that no longer exists, for example). Check the camera picker inside the app and remove stale virtual camera drivers.',
    },
  ],
  osGuidesTitle: osGuidesTitleDefault,
  osGuides: [
    {
      os: 'Windows 10 & 11',
      steps: [
        'Open Settings → Privacy & security → Camera.',
        'Enable "Camera access" and "Let apps access your camera".',
        'Under "Let desktop apps access…", allow your browser.',
        'For external webcams, check Device Manager if the device is missing entirely.',
      ],
    },
    {
      os: 'macOS',
      steps: [
        'Open System Settings → Privacy & Security → Camera.',
        'Enable the toggle next to your browser.',
        'If the camera stays off after allowing, quit and relaunch the browser — macOS only applies the change on restart.',
      ],
    },
  ],
  faqTitle: 'Webcam test FAQ',
  faqs: [
    {
      q: 'Is my camera feed uploaded anywhere?',
      a: 'Never. Frames are processed in your browser’s memory only. There is no server component — you can disconnect from the network and the test keeps working.',
    },
    {
      q: 'How do I know the real resolution and FPS?',
      a: 'The stats panel under the live feed shows the actual delivered video track settings. Compare them with your camera’s spec sheet: many cameras advertise 1080p but negotiate 720p by default.',
    },
    {
      q: 'Can I take a snapshot to check image quality?',
      a: 'Yes — use the capture button to freeze a frame and inspect it at full size. It stays in your browser until you dismiss it.',
    },
    {
      q: 'Why does my webcam look grainy at night?',
      a: 'Small sensors boost ISO in low light, which introduces noise. More light is always the answer — a lamp behind your screen transforms budget webcam quality.',
    },
    {
      q: 'Can I test an iPhone as a webcam?',
      a: 'If it appears as a system camera (e.g., Apple’s Continuity Camera on Mac), it will show up here exactly like any other webcam.',
    },
  ],
};

FLAGSHIP['webcam-test'] = webcamContent;
delete FLAGSHIP.webcam;

/* ============================ Resolution ============================ */

const TEMPLATE_BY_CATEGORY: Record<ToolDefinition['category'], (tool: ToolDefinition) => ToolContent> = {
  'audio-video': audioCameraContent,
  'input-devices': keyboardMouseContent,
  display: screenContent,
  network: browserPerfContent,
  supporting: sensorsControllersContent,
};

export function getToolContent(tool: ToolDefinition): ToolContent {
  const flagship = FLAGSHIP[tool.id];
  if (flagship) return flagship;
  return TEMPLATE_BY_CATEGORY[tool.category](tool);
}
