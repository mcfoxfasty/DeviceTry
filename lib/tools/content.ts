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
  /**
   * Per-OS settings walkthroughs (omit when irrelevant; the title renders
   * only alongside guides, and the default heading is applied when guides
   * are present without a title).
   */
  osGuidesTitle?: string;
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
    'This tester captures the microphone through the same standardized browser APIs (getUserMedia and the Web Audio Analyser) that any web app relies on. That makes it a clean read of what the hardware is delivering — but not a promise about what a given app will send. Zoom, Google Meet, and Microsoft Teams each layer on their own processing: noise suppression, echo cancellation, automatic gain control, and per-app device and level settings, and they may select a different input entirely. A healthy reading here means the signal reaches the browser cleanly; how a specific call app then treats it is that app’s own behaviour. No software installation, no drivers, no account — the audio never leaves your browser, and the meter, waveform, and optional recording all run locally in memory.',
  ],
  tipsTitle: 'How to get an accurate result',
  tips: [
    'Speak at the distance you would actually sit from the mic during a call — about 15–25 cm (6–10 inches) for a headset boom.',
    'Watch the meter while silent for a few seconds first, then speak normally. The gap between the two readings is your usable signal — a meter that never drops back toward zero while the room is quiet usually means aggressive gain or a noisy preamp.',
    'If the level barely moves when you speak, raise the input volume in your system sound settings until speech sits well up the meter without ever pinning it at 100%.',
    'Use headphones if you are testing near speakers — otherwise your mic picks up their output and can feed back.',
    'Record a short sample and play it back: the meter only shows level, whereas playback is the only way to hear distortion, crackle or hiss, room echo, and wind noise on the mic itself.',
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
      fix: 'Distortion usually means the input level is clipping. Pull the gain down until speech peaks stop hitting the top of the meter, and close apps that may be processing audio in the background (noise removers, virtual cables, voice changers).',
    },
    {
      problem: 'Microphone works here but not in Zoom/Teams',
      fix: 'Conferencing apps can hold an exclusive lock or select a different input. Fully quit the app (check the system tray), then reopen it — or the reverse: quit the app before testing here for a clean measurement.',
    },
    {
      problem: 'A constant hiss or hum is always present',
      fix: 'Hiss at high gain is normal for cheap analog mics. A steady low rumble that never goes away is often electrical interference rather than the room — try a different USB port, move cables away from power bricks, or use the mic on another device to isolate the cause.',
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
      a: 'The meter is relative, not calibrated — it shows how strong the signal is right now, not a sound pressure level, so there is no single correct number and readings are not comparable between devices. Use the shape instead: silence should rest low, normal speech should swing well up the meter, and peaks should never sit pinned at 100%, which is what clipping sounds like.',
    },
    {
      q: 'Can I compare this reading against a professional sound level meter?',
      a: 'No. The meter is an uncalibrated relative RMS level derived from whatever gain your operating system and input hardware are already applying. A higher number means a stronger signal at the browser, not a louder room or a better microphone.',
    },
  ],
};

/* ============================ Category templates ============================ */

/**
 * Speaker channel isolation. The tool plays a 440 Hz sine tone hard-panned
 * left, centre and right, then records the user's own confirmation, so the
 * copy must describe a listening task — never capture, permissions or
 * input levels.
 */
function speakersContent(tool: ToolDefinition): ToolContent {
  return {
    aboutTitle: `About the ${tool.title}`,
    about: [
      'A dead speaker channel is the audio fault people live with longest: music still plays, so nobody notices the left side of their headphones is silent until a video call. This test isolates the channels in three seconds each.',
      'It plays a short 440 Hz sine tone — concert A, chosen because it sits where most speakers reproduce most accurately — panned fully left, fully right, and to centre. You listen, then tell the tool what you actually heard. A tone playing proves nothing on its own, so the verdict is only ever built from channels you both played and confirmed; a channel you skipped is never counted as passing.',
      'The tone is generated by the Web Audio API inside your browser, at a modest level that stops automatically after three seconds. It is not a volume limiter: the loudness you hear is whatever your system volume and amplifier make of it, so keep your own levels moderate.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Set your system volume to a moderate level first. The tone is generated at a fixed, deliberately modest level, so start there and raise your system volume only as far as you are comfortable with.',
      'Play all three channels. The verdict can only report on channels you actually played and confirmed.',
      'Test the headphones or speakers you care about, not a spare pair you are keeping in a drawer.',
      'Confirm each channel while it is still fresh rather than marking several at the end.',
      'Prefer a wired connection or a stereo Bluetooth codec. Mono hands-free profiles deliberately mix both channels together, so a Bluetooth headset can hide the fault you are looking for.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'Only one side produces sound',
        fix: 'Confirm the fault in a second app — play a stereo track in your system music player. If the silence follows you, swap the headphones or move the speakers and test again; if it does not, the browser output path is the difference to investigate.',
      },
      {
        problem: 'The tone is too quiet to hear',
        fix: 'Check the correct output device is selected in your sound settings, then raise the system volume yourself. The tone is generated at a fixed, deliberately modest level, but the level you actually hear depends entirely on your system volume, amplifier, and speakers — turn them up too far and the tone is as loud as you made it.',
      },
      {
        problem: 'Left, centre and right all sound identical',
        fix: 'That usually means the system is downmixing to mono — a mono Bluetooth profile, a mono output device, or an app-level mixer. Test with a wired stereo output, where the panning is genuinely separated.',
      },
      {
        problem: 'No sound at all',
        fix: 'Check the physical mute switch or volume knob first, then confirm the browser is routed to the output device you think it is. Reload the page to reset the audio context.',
      },
    ],
    faqTitle: `${tool.title} FAQ`,
    faqs: [
      {
        q: 'Is this a speaker quality or volume test?',
        a: 'Neither. It is a channel separation test. The tool can show you that a side is silent; it cannot rate sound quality, measure loudness, or tell you how good your speakers are.',
      },
      {
        q: 'Why does the tone stop after a few seconds?',
        a: 'Each tone self-terminates after three seconds so it does not run on unattended. That is a duration limit, not a volume limit — the loudness depends on your system volume and amplifier. Press the channel button again to replay it as many times as you like.',
      },
      {
        q: 'Why is 440 Hz used?',
        a: 'It is concert A, a reference pitch in the middle of the range most speakers reproduce most accurately, which makes a weak or disconnected side easier to hear than a very low or very high tone would.',
      },
      {
        q: 'Can I use it to test my microphone?',
        a: 'No — this tool only plays audio. Use the Microphone Test for input level and a live waveform, or the Voice Recorder to capture and download a clip.',
      },
      {
        q: 'Is the audio recorded or uploaded?',
        a: 'Never. The tone is synthesised locally and discarded when it stops. Nothing leaves the browser, and the tool can be used offline once the page has loaded.',
      },
    ],
  };
}

/**
 * Reference tone playback. The tool only drives the Web Audio output graph —
 * no microphone, no camera, no captured media of any kind.
 */
function toneGeneratorContent(tool: ToolDefinition): ToolContent {
  return {
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} synthesises a steady tone at any frequency you choose and sends it straight to your speakers or headphones. It is the fastest way to hear a specific part of the audible spectrum — the low rumble that reveals a loose floor, the top end that reveals dull drivers — without any music, video, or software to install.`,
      'You pick a frequency from 20 Hz to 12,000 Hz, choose a waveform — sine, triangle, square or sawtooth — set the output gain, and press play. The tone is generated by an oscillator in the Web Audio graph and stops the moment you press stop, so it is a deliberate output-only tool: it plays sound and measures nothing.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Start with the gain low and raise it gradually. Sustained high volume through a tone is the fastest way to fatigue your ears or overdrive small speakers.',
      'Use the preset frequencies to sweep the range in order — 60 Hz, 120 Hz, 261.63 Hz, 440 Hz, 1,000 Hz and 4,000 Hz — and note where the response drops away.',
      'Sine is the cleanest reference tone. The square and sawtooth waves add harmonics that are useful for spotting intermodulation but are harsher on sustained listening.',
      'Expect small speakers to lose the extremes: below roughly 60 Hz and above roughly 12 kHz a laptop or monitor simply has no output there. That is a limit of the hardware, not a fault.',
      'Do not use this while recording from the same machine — a speaker tone loops straight back into the microphone and will be captured as a loud, distorted loop.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'No sound is produced',
        fix: 'Check the output device selected in your system sound settings and that the volume is up, then reload the page — the Web Audio context is created fresh on each play.',
      },
      {
        problem: 'The tone is audible but thin or distorted',
        fix: 'Lower the output gain before adjusting anything else; distortion at high gain is normal. If it persists at a moderate level, test on a different output device to separate the tone from the hardware.',
      },
      {
        problem: 'Very low or very high frequencies seem missing',
        fix: 'That is usually the reproduction limit of small speakers and cheap Bluetooth codecs, which roll off the extremes aggressively. Confirm the tone is really being generated by trying a mid-range frequency such as 1,000 Hz.',
      },
      {
        problem: 'The tone cuts out when the tab loses focus',
        fix: 'Browsers are allowed to silence an audio context that is running while its page is backgrounded. Keep the tab in the foreground and press play again if it stops responding.',
      },
    ],
    faqTitle: `${tool.title} FAQ`,
    faqs: [
      {
        q: 'What is the difference between the waveforms?',
        a: 'Sine is a single pure frequency and the cleanest reference. Triangle is a pure tone with gentler harmonics. Square and sawtooth contain strong harmonics, so they sound brighter and harsher but reveal more about how a driver handles a rich signal.',
      },
      {
        q: 'Can this measure my speakers?',
        a: 'No. It generates and plays a tone; it records nothing and calculates nothing. Use it to hear a frequency, then use the Speaker & Headphone Test to check channel separation, or the Microphone Test for input.',
      },
      {
        q: 'Why is the maximum frequency 12,000 Hz?',
        a: 'It is the top of the range most audio hardware and codecs reproduce meaningfully. Frequencies above it are inaudible on ordinary speakers, so generating them would not tell you anything useful.',
      },
      {
        q: 'Is any audio recorded or uploaded?',
        a: 'Never. The oscillator runs entirely in your browser and is disconnected as soon as you stop the tone. Nothing is captured, stored, or sent anywhere.',
      },
    ],
  };
}

/**
 * Voice recording. This is the one audio tool that captures a media stream,
 * so it is also the only one that needs a microphone permission and a
 * microphone OS guide — the copy must not drift back to camera wording.
 */
function voiceRecorderContent(tool: ToolDefinition): ToolContent {
  return {
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} captures your microphone and gives you a real file to keep. Press record, speak, stop when you are done, then play it back, save it, or download it. Recordings live in the browser tab's memory and disappear when you close it — unless you download them yourself.`,
      'The capture path is deliberately simple: samples are pulled straight from the Web Audio graph as raw PCM, and the finished recording is encoded into a genuine WAVE file in your browser. The download is therefore always a real .wav file at audio/wav, on every engine, rather than a compressed stream in whatever container the browser happened to prefer. Clips are capped at five minutes, and pause and resume work mid-take.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Allow the microphone permission when the browser asks. Nothing can be recorded without it, and the prompt appears the first time you start.',
      'Speak at the distance you would actually use — a few inches from a headset boom is closer than arm’s length from a laptop mic.',
      'Use headphones while recording if speakers are nearby, or your recording will pick the room up as well as you.',
      'Listen back before you download. Playback reveals hiss, crackle and clipping that the act of recording will not show you.',
      'Download the clip as soon as it is recorded — the file only exists in this tab, so closing the tab discards it.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'The permission prompt never appears',
        fix: 'Access may be blocked for this site. Open the lock or tune icon in the address bar, set microphone access to Allow, then reload the page.',
      },
      {
        problem: 'The recording is silent',
        fix: 'Check that the correct microphone is the system default input — a headset can still be selected after you unplugged it. Reload so the tool re-requests the current default, and watch the level meter while recording.',
      },
      {
        problem: 'The clip stops at five minutes',
        fix: 'That is a hard cap on capture length. Split a long recording into separate takes and stitch them in an audio editor afterwards.',
      },
      {
        problem: 'The playback sounds worse than it did live',
        fix: 'Playback passes through your output chain, and the room may bleed back into the recording. Re-record with headphones to separate the microphone from the speakers.',
      },
      {
        problem: 'The download will not play in an older app',
        fix: 'The file is an uncompressed WAVE, which is deliberately the most compatible format there is. If a tool refuses it, check that your download did not gain a .txt or other extension in transit.',
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
          'Check Settings → System → Sound → Input to pick the microphone you want to record from.',
        ],
      },
      {
        os: 'macOS',
        steps: [
          'Open System Settings → Privacy & Security → Microphone.',
          'Enable the toggle next to your browser, then relaunch the browser if it does not ask again.',
          'Select the input device under System Settings → Sound → Input.',
        ],
      },
    ],
    faqTitle: `${tool.title} FAQ`,
    faqs: [
      {
        q: 'Where are my recordings stored?',
        a: 'In the memory of this browser tab. Nothing is uploaded and nothing is written to disk unless you download the file yourself, so closing the tab discards the recording.',
      },
      {
        q: 'What format do I get?',
        a: 'A genuine WAVE file — samples are captured as raw PCM and encoded to WAVE in your browser, so the download is always a real .wav at audio/wav regardless of what container formats the browser supports for other recording apps.',
      },
      {
        q: 'How long can a recording be?',
        a: 'Five minutes. The cap is applied during capture, so anything past it is not recorded rather than trimmed afterwards.',
      },
      {
        q: 'Can I record more than one person at once?',
        a: 'Yes — it captures whatever the selected microphone hears, so a meeting around one laptop mic records everyone in range. The Microphone Test is better for judging whether your own voice is clear.',
      },
      {
        q: 'Is there a recording limit for free use?',
        a: 'No account, no watermark, and no trial limit. The only cap is the five-minute length of a single take.',
      },
    ],
  };
}

/**
 * Neutral fallback for the `audio-video` category — reached only if a future
 * audio tool ships without its own per-slug content. Deliberately describes
 * output playback only, so it can never reintroduce the camera-permission
 * and input-level text that the old shared template put on every page.
 */
function audioOutputContent(tool: ToolDefinition): ToolContent {
  return {
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} runs entirely inside your browser using the Web Audio API. Nothing is installed, nothing is uploaded, and the sound it produces is synthesised locally and discarded when you stop it.`,
      'Because playback is generated rather than loaded, a broken output path shows up immediately: no sound at all, sound from the wrong device, or sound that is distorted and clipping.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Set your system volume to a moderate level before starting.',
      'Check that the correct output device is selected in your system sound settings.',
      'Use headphones when you are checking a speaker setup, so ambient room sound does not confuse you.',
      'Reload the page after changing any system audio setting to confirm the change took effect.',
      'Keep levels moderate — sustained high volume is damaging to both hearing and small speakers.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'No sound is produced',
        fix: 'Check the physical mute switch or volume knob, confirm the browser is routed to the output device you expect, and reload the page to reset the audio context.',
      },
      {
        problem: 'Sound comes from the wrong device',
        fix: 'The operating system is routing audio somewhere unexpected. Set the default output in your system sound settings, then reload this page.',
      },
      {
        problem: 'The sound distorts at higher volume',
        fix: 'That is clipping, not a fault in this tool. Lower the system volume until the distortion disappears.',
      },
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        q: `Is the ${tool.title} free to use?`,
        a: 'Yes. Every tester on DeviceTry is free, unlimited, and requires no account. Your audio never leaves the browser.',
      },
      {
        q: 'Which browsers are supported?',
        a: 'Any modern browser with Web Audio support — current versions of Chrome, Edge, Firefox, Opera, and Safari all work.',
      },
      {
        q: 'Does this record anything?',
        a: 'No. The tool only plays audio it generates itself, so there is no microphone access and nothing to store or delete.',
      },
    ],
  };
}

/**
 * Keyboard-specific content. Every input tool previously shared one template,
 * so the gamepad page talked about key switches and the mouse page about key
 * rollover. Each tool below describes only what it actually measures.
 */
function keyboardContent(tool: ToolDefinition): ToolContent {
  return {
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} listens to the key events your browser receives and lights up every key it sees pressed, so you can walk the entire layout and confirm each key actually reaches the computer. If a key stays dark, the failure is somewhere between the switch and the browser — and this page narrows down where.`,
      'It is equally useful for checking a keyboard you just bought or received back from repair: run through every key, hold your usual multi-key combinations, and you will know within a minute whether anything sticks, drops, or double-fires.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Click the test area once so it has keyboard focus, then press every physical key in turn — including Shift, Ctrl, Alt, Enter, and the whole modifier row.',
      'Test in a steady rhythm rather than one fast sweep; intermittent contacts show up under repetition.',
      'Hold three, four, or five keys together the way you would while gaming or using shortcuts to see which combinations your keyboard reports simultaneously.',
      'If a key never lights up here or in any other app, try the keyboard on another computer to separate a hardware fault from a system setting.',
      'Test in a private window if keys behave oddly — a few browser extensions intercept keyboard input.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'A key never lights up',
        fix: 'Clean around the switch with compressed air — debris is the most common cause of a single dead key. If cleaning does not help, the switch or its membrane has likely failed; the dark key on this page is your evidence for a warranty claim.',
      },
      {
        problem: 'One press lights the key up twice',
        fix: 'That is switch chatter, a classic symptom of a worn or dirty switch. If it repeats consistently across a few presses, the keyboard needs repair or replacement — the record here documents it.',
      },
      {
        problem: 'A key stays lit after release',
        fix: 'Stuck-on highlighting means the browser never saw the key-up event: the key physically stuck down or the release was swallowed. Press the key again firmly; if it keeps happening, the switch mechanism is failing.',
      },
      {
        problem: 'Multimedia, Fn, or macro keys do nothing',
        fix: 'That is expected for many of them: operating systems and embedded laptop controllers capture volume, brightness, and Fn-only keys before any browser can see them. A missing media key here is not proof the key is broken.',
      },
    ],
    osGuidesTitle: 'Notes for specific systems',
    osGuides: [
      {
        os: 'Windows',
        steps: [
          'If no keys register at all, check Device Manager for warnings under "Keyboards" and "Human Interface Devices".',
          'Filter Keys (Settings → Accessibility → Keyboard) can ignore brief or repeated presses — turn it off while testing.',
        ],
      },
      {
        os: 'macOS',
        steps: [
          'Check System Settings → Keyboard → Input Sources if specific characters produce the wrong symbols — that is a layout setting, not a hardware fault.',
          'Slow Keys and Sticky Keys (System Settings → Accessibility → Keyboard) change how presses register; disable them for a clean test.',
        ],
      },
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        q: 'Can this test damage my keyboard?',
        a: 'No. The tester only listens to the events your operating system already produces when you type — it never sends anything to the keyboard.',
      },
      {
        q: 'Does it detect stuck keys?',
        a: 'Yes. Keys stay highlighted while the browser considers them held, so a key that never releases stays visibly lit and a key that never registers stays dark. Both are visible at a glance.',
      },
      {
        q: 'Can I use this to test a new keyboard before the return window closes?',
        a: 'That is exactly what it is for. Walk through every key, hold the multi-key combinations you actually use, and keep a screenshot as a record if something is wrong.',
      },
      {
        q: 'Why do some keys never register here?',
        a: 'Media, brightness, Fn-only, and macro keys are usually captured by the operating system or the laptop’s embedded controller before the browser sees anything. If they work in no app at all, then look at hardware.',
      },
      {
        q: 'Does this measure my keyboard’s rollover limit?',
        a: 'It shows which keys report together, so you can see how the combinations you actually use behave. Full n-key rollover depends on the connection type and the keyboard’s firmware — treat this page as a practical check, not a certification.',
      },
    ],
  };
}

function mouseContent(tool: ToolDefinition): ToolContent {
  return {
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} records every click, wheel movement, and pointer motion your browser receives and shows which mouse buttons actually fired. A few seconds of clicking answers the common questions: does the left button double-fire, does the wheel skip, does the cursor jump.`,
      'It works for touchpads too: taps, two-finger presses, and scroll gestures are reported as the browser sees them, which makes this a quick check before blaming an app for missed clicks.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Click with each button in turn — left, right, middle — and confirm each one registers separately.',
      'Roll the wheel slowly in both directions, then quickly, to expose skipped detents or inverted scrolling.',
      'Move the cursor in slow circles across the whole area; a stuttering or jumping trail points to a dirty sensor or a bad surface.',
      'If you suspect a worn switch, click steadily fifty times and watch whether one click ever registers as two — that is the classic failure.',
      'Test on the surface you normally use; glossy or glass surfaces confuse optical sensors and are not a mouse fault.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'One click registers as two',
        fix: 'That is switch chatter from a worn or dirty switch. See the mouse double-clicking guide on this site for the cleaning-versus-replace decision; if every double-click attempt shows two events, the switch is failing.',
      },
      {
        problem: 'A button never registers',
        fix: 'Try another USB port, or re-pair a wireless mouse with fresh batteries. If the middle button still never appears, note that some mice map it to horizontal scroll and some laptops have no middle button at all.',
      },
      {
        problem: 'The cursor jumps or stutters',
        fix: 'Clean the sensor aperture and try a matte surface. If jumping persists on another computer, the sensor is failing; if it disappears there, the original system had the problem — driver settings, power saving, or radio interference.',
      },
      {
        problem: 'The context menu interrupts the test',
        fix: 'The test area suppresses it while you click inside. If it still appears, click inside the marked area rather than near its edge, where the click may land on the page itself.',
      },
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        q: 'Can this test damage my mouse?',
        a: 'No. It only listens to the events your system already produces — clicking here is no different from clicking anywhere else.',
      },
      {
        q: 'Does this measure DPI or polling rate?',
        a: 'No. Sensitivity and polling are handled by the mouse firmware and OS settings, and the browser receives already-processed pointer movements. This page verifies which buttons and wheel events arrive, not sensor precision.',
      },
      {
        q: 'Why is my double-click not counted as one double-click?',
        a: 'The tester reports every raw button-down event, which is exactly what you want when diagnosing a failing switch: a worn switch shows two rapid events for one physical press.',
      },
      {
        q: 'Does it work with touchpads?',
        a: 'Yes — taps, presses, and scroll gestures arrive as pointer and wheel events. Some touchpad gestures (pinch zoom, three-finger swipes) are consumed by the operating system and will not appear.',
      },
    ],
  };
}

function gamepadContent(tool: ToolDefinition): ToolContent {
  return {
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} connects through the browser’s Gamepad API: press any button on a connected controller and the pad appears here with every button, stick axis, and trigger shown live. Move the sticks and watch their axes trace the full range, then run the neutral drift check to see how far from center each stick sits while untouched.`,
      'This is the fastest way to check a controller before a gaming session or a second-hand purchase: confirm every button fires, both sticks center cleanly, and the triggers sweep smoothly — without installing console or vendor software.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Connect by USB first — it is the most reliable — and press any button once so the browser detects the pad.',
      'Press every button, including the D-pad, shoulder buttons, and stick clicks (L3/R3), and watch each one register.',
      'For the drift check, leave the sticks untouched for the full duration; even small constant offsets show up.',
      'Compare both sticks: a small symmetric offset is normal analog tolerance, while a large constant offset on one side points to wear.',
      'Keep wireless controllers close to the computer and away from other 2.4 GHz traffic during the test.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'The controller is not detected',
        fix: 'The Gamepad API only reports a pad after a button press, and only while the page is focused: click the page, then press a button. On Linux, some pads need xpad/xone drivers or Steam Input enabled to appear.',
      },
      {
        problem: 'A stick shows drift without input',
        fix: 'A small offset inside the tool’s tolerance band is normal analog tolerance. A large constant offset is worth investigating, but it does not identify the cause on its own: worn potentiometers, a stick that was recalibrated while held off-centre, and debris around the base can all produce one. Clean around the stick base and recalibrate with the sticks resting, then retest — if a constant offset survives that, the stick module may need replacement, and the stick-drift guide on this site covers the repair path.',
      },
      {
        problem: 'Buttons register but triggers do not',
        fix: 'Triggers are analog axes on modern pads. If they never move, try a different USB port or browser — some browsers report analog triggers only when the pad’s mapping is recognized.',
      },
      {
        problem: 'Inputs arrive late or stutter',
        fix: 'Wireless interference or heavy CPU load delays event polling. Switch to USB, move the wireless dongle to a front port, and close background apps while testing.',
      },
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        q: 'Does this work with any controller brand?',
        a: 'Xbox, PlayStation, Switch Pro, and generic PC controllers all expose the standard Gamepad API. Vendor-exclusive extras — audio passthrough, custom profiles — are outside what a browser can see.',
      },
      {
        q: 'Why do I have to press a button first?',
        a: 'It is a privacy rule built into the Gamepad API: a pad is not reported until you interact with it, so pages cannot silently enumerate your controllers. Press any button while this page is focused.',
      },
      {
        q: 'Can I test rumble or vibration here?',
        a: 'If your browser exposes the pad’s vibration actuator, the tester enables a rumble check. Support is optional in browsers today, so a missing rumble test means your browser lacks the API — not that the pad cannot vibrate.',
      },
      {
        q: 'Does the drift check certify my stick?',
        a: 'No. The threshold is this tool’s practical heuristic for flagging drift, not a manufacturer measurement, and a flagged offset does not identify the cause. Use it to compare before and after cleaning or recalibrating, or to document a fault.',
      },
      {
        q: 'Is any data from my controller uploaded?',
        a: 'No. Button and axis readings render locally and disappear when you close the tab.',
      },
    ],
  };
}

function clickSpeedContent(tool: ToolDefinition): ToolContent {
  return {
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} counts your clicks or spacebar presses during a bounded run of 5, 10, or 30 seconds and reports the rate as clicks per second (CPS). The first input starts the timer, the counter stops automatically, and every run shows the honest total — no rankings, no percentiles, no inflated numbers.`,
      'Use it to check whether a worn mouse switch is double-firing (a suspiciously high count with an uneven rhythm), to warm up before gaming, or simply to measure your own pace against your own previous runs — results depend on your device and browser timing, not just your fingers.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Choose the 10-second run for a balanced measurement; 5 seconds rewards bursts and 30 seconds favors stamina.',
      'Click in a steady rhythm rather than all-out flailing — consistent input produces a rate you can actually reproduce.',
      'Keep your hand and wrist relaxed; tension slows you down more than a few minutes of practice helps.',
      'Run it three times and compare — a single run is noise, three runs show your real pace.',
      'If one click sometimes registers twice, that is a worn switch, not a better score; check it with the Mouse Test.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'The count seems impossibly high',
        fix: 'A failing mouse switch can double-fire on single presses and inflate the count. Open the Mouse Test and click steadily — if single presses register as two, the switch is worn and the score here is hardware noise, not skill.',
      },
      {
        problem: 'The run starts before I am ready',
        fix: 'By design, your first click or spacebar press starts the timer. Rest your finger just above the button and begin when you are set — or use Restart to reset the counter at any time.',
      },
      {
        problem: 'Spacebar presses do not register',
        fix: 'Click inside the test area first so the page has keyboard focus. If presses still vanish mid-run, another window or an OS shortcut that uses the spacebar took focus.',
      },
      {
        problem: 'Results vary a lot between runs',
        fix: 'That is normal — browser timer throttling, background tabs, and input-device timing all contribute. Close other tabs, keep this tab in the foreground, and compare three runs instead of one.',
      },
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        q: 'What is a good CPS score?',
        a: 'There is no universal benchmark: the number depends on your mouse, browser, and technique. Treat the average of your own three runs as the only comparison that matters — published "good CPS" tables ignore device and browser differences.',
      },
      {
        q: 'Why only 5, 10, and 30 seconds?',
        a: 'Bounded runs keep results comparable and prevent idle counting. Freeform unbounded counting was deliberately left out — a timer that runs indefinitely produces numbers that mean nothing.',
      },
      {
        q: 'Can I cheat the counter?',
        a: 'Macro software and double-firing switches can inflate a count, which is exactly why the tool publishes no leaderboard. Use it to measure yourself, not to chase a ranking that does not exist.',
      },
      {
        q: 'Is my score uploaded or shared?',
        a: 'Only if you choose to share it. Runs are counted locally in your browser, and results are saved to your device’s local test history — never sent anywhere automatically.',
      },
    ],
  };
}

function reactionTimeContent(tool: ToolDefinition): ToolContent {
  return {
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} shows a waiting panel that turns green after a randomized delay; your job is to respond the instant it does. Five attempts per session are measured in milliseconds from the visual change to your input, and the tool reports every time alongside your best and your median.`,
      'The randomized wait exists to stop you from anticipating — the test measures your reaction to the signal, not your rhythm. Clicking too early invalidates that attempt, so a clean session of five valid runs is the honest baseline.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Use the same input method for all five attempts — mouse click, tap, or key press — so the runs are comparable.',
      'Sit comfortably and focus on the panel; distraction inflates every number more than hardware differences do.',
      'Aim for consistency across attempts: your median describes your steady state better than a single lucky best.',
      'Compare only sessions taken under the same conditions — screen, device, and time of day all shift the numbers.',
      'Warm up with one throwaway session if the first numbers look stiff; response times settle after a few minutes.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'I keep clicking too early',
        fix: 'That is anticipation: you are timing a rhythm instead of reacting to the signal. The randomized delay exists to break that habit — wait for the color change itself, not for a feeling that it is due.',
      },
      {
        problem: 'My times are wildly inconsistent',
        fix: 'Background CPU load and browser throttling inject noise. Close other tabs and apps, keep this tab in the foreground, and run the five attempts back to back without pausing.',
      },
      {
        problem: 'My results are slower than my friend’s on the same page',
        fix: 'The number includes display latency, input-device latency, and browser scheduling on top of human reaction — a 60 Hz screen and a 240 Hz screen do not produce comparable times. Compare sessions on identical setups only.',
      },
      {
        problem: 'Keyboard attempts do not register',
        fix: 'Click the page once so it has keyboard focus before starting, and avoid OS shortcuts that use the spacebar (like page-scroll) while the test is active.',
      },
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        q: 'What is a good reaction time?',
        a: 'Visual simple-reaction times around 200–250 ms are typical for adults, but any specific number depends on your display, input device, and browser latency. Use your median across five attempts and compare it only with sessions on the same setup.',
      },
      {
        q: 'Is this a medical or cognitive assessment?',
        a: 'No. It is a browser-timing measurement of a simple visual response — useful as a rough self-check or for fun. It diagnoses nothing and says nothing about health, fitness for work, or driving ability.',
      },
      {
        q: 'Why does the panel change color at random intervals?',
        a: 'A predictable interval would let you anticipate the signal instead of reacting to it. The randomized delay keeps every attempt an honest measure of response rather than rhythm.',
      },
      {
        q: 'Can I use a keyboard or touchscreen?',
        a: 'Yes — click, tap, or press any key once the panel turns green. Stick to one method per session so the five attempts are comparable.',
      },
      {
        q: 'Where do my times go?',
        a: 'Nowhere automatically. The five times, your best, and your median are computed in your browser and saved only to your device’s local test history.',
      },
    ],
  };
}

/**
 * Touch-specific content. The touchscreen tester sits in `input-devices`,
 * whose category template is keyboard-oriented, so it gets its own per-slug
 * content describing the coverage grid and multi-touch observation exactly
 * as the tester reports them (see lib/testing/sensorGates.ts).
 */
function touchscreenContent(tool: ToolDefinition): ToolContent {
  return {
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} listens to the touch events your browser receives from the operating system and shows you exactly where the digitizer reported contact. The coverage grid divides the screen into a 10×10 field of tiles: when every tile has been swept with a finger, the tool reports full observed coverage — the digitizer answered in every region it sampled. That is an observation, not a certification: a dead spot smaller than one tile can still hide between samples. The Multi-Touch tab shows the highest number of simultaneous contacts actually observed at one moment.`,
      'It is the quickest way to find large dead zones after a drop, check a screen protector for edge sensitivity loss, or confirm a used phone or tablet accepts real multi-finger input before you pay for it. For defects smaller than one grid cell — a single dead pixel-sized touch failure — the grid is the wrong instrument; judge those visually in a drawing or note app.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Use the edge of your fingertip, not a fingernail or a stylus-capacitive glove — capacitive digitizers need conductive contact.',
      'Sweep the coverage grid slowly and overlap your strokes; a fast flick can skip a tile the hardware actually answers.',
      'Clean the screen first. Oil and dust change capacitance and can hide a working zone or fake a dead one.',
      'If you use a screen protector, test with it on — cheap or thick protectors blunt sensitivity near the edges, and that is exactly what the grid exposes.',
      'Use your bare finger. The coverage grid tracks pen input separately from finger touches, and mouse input is recorded but never counted toward a touchscreen result — a mouse click cannot light up the verdict even on a desktop that also reports pointer events.',
      'For Multi-Touch, rest several fingers on the glass at once rather than tapping in sequence — only simultaneous contacts count, and the verdict reports the highest count observed in that session.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'Some tiles never fill in (dead zones)',
        fix: 'Clean the screen and remove the protector, then retest with a slower, overlapping sweep — a missed tile looks identical to a dead one. If the same tiles stay blank on a second careful pass with a bare, clean screen, that is a strong hint of a hardware fault worth documenting while a warranty or return window is open, but confirm it in another app first. Remember the grid samples regions, so a tiny dead spot inside an otherwise-responsive tile can still slip through.',
      },
      {
        problem: 'Coverage passes but touches feel wrong in apps',
        fix: 'The grid proves response per region, not touch accuracy. Ghost touches, jitter, or a miscalibrated digitizer show up as taps landing elsewhere — restart the device first, then compare against another touch app to separate hardware from software.',
      },
      {
        problem: 'Multi-Touch never passes on the browser',
        fix: 'Place fingers on the pad before moving them — some devices report new contacts only while a gesture is active. Two or more simultaneous contacts observed at once is a pass; a low observed count does not prove the hardware limit, and browsers cap what they report anyway.',
      },
      {
        problem: 'The page scrolls instead of covering tiles',
        fix: 'The grid requests exclusive touch handling, but only inside the pad. If scrolling still wins, reload and start the drag from well inside the grid rather than its border.',
      },
    ],
    osGuidesTitle: 'Notes for specific systems',
    osGuides: [
      {
        os: 'iOS / iPadOS',
        steps: [
          'Use Safari — touch reporting in embedded browsers (Chrome on iOS) follows the same system events, but Safari is the reference.',
          'If touches do not register at all, check that Guided Access or a kiosk profile is not restricting touch to part of the screen (Settings → Accessibility).',
        ],
      },
      {
        os: 'Android',
        steps: [
          'Enable Developer options → Pointer location to cross-check where the system itself sees contact.',
          'A “Palm rejection” feature can suppress broad contact surfaces — rest fingertips, not the flat of your hand, on the glass.',
        ],
      },
      {
        os: 'Windows / Linux touch displays',
        steps: [
          'External touch monitors need their HID touch connection (USB) seated — the video cable alone does not carry touch.',
          'If touch lands on the wrong display, realign in Settings → System → Display → Touch (Windows) or your desktop’s tablet/pointer settings (Linux).',
        ],
      },
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        q: 'What does a PASSED coverage result actually prove?',
        a: 'That the digitizer reported genuine touch or pen contact in every one of the 100 grid regions during this session. It is an observation, not a certification: the tool does not test every pixel, and a dead spot smaller than one tile can still exist between samples. It also says nothing about touch accuracy or pressure sensing.',
      },
      {
        q: 'Does the Multi-Touch result show my screen’s maximum touch count?',
        a: 'No. It shows the highest number of simultaneous contacts actually observed in that session — nothing more. Browsers expose no hardware limit, so a device that passed with two fingers is not certified to accept only two, and a higher count elsewhere would not be contradicted.',
      },
      {
        q: 'Why does mouse input never count?',
        a: 'A mouse reports one contact by definition. Counting it would let any desktop claim touchscreen coverage without touching a screen, so the tester tracks it separately and never lets it contribute to a touch result.',
      },
      {
        q: 'Can a screen protector cause dead zones?',
        a: 'It can. Thick glass, poor adhesion, or air gaps at the edges raise the distance between your finger and the digitizer. Retest without the protector: if the blank tiles fill in, the protector is the cause.',
      },
      {
        q: 'Is anything about my touches uploaded?',
        a: 'No. Contact coordinates render locally and vanish when you close the tab — the test runs entirely in your browser.',
      },
    ],
  };
}

function screenContent(tool: ToolDefinition): ToolContent {
  return {
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} uses your browser to render full-screen test patterns — solid colour fields, gradients, and contrast grids — so you can look for dead pixels, stuck subpixels, backlight bleed, and uneven panels. It works on anything the browser can draw to, from a laptop panel to an external monitor or a TV, making it the fastest way to evaluate a screen without installing anything.`,
      'Use it before accepting a new display delivery, after a drop or pressure damage, when shopping second-hand, or whenever text looks fuzzy and you need to determine whether the panel, the cable, or a system scaling setting is at fault.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Set the display to its native resolution and the browser zoom to 100% before testing. This removes the most common sources of resampling — zoom, OS scaling, and overscan all shrink, stretch, or shift the pattern — but it does not make the mapping one-to-one, so treat the result as an inspection aid rather than a pixel-exact measurement.',
      'Clean the screen first; dust and fingerprints read as false dead pixels at close inspection.',
      'Inspect from straight ahead and then from a slight angle — some panel defects only appear off-axis.',
      'For pattern tests, enable fullscreen mode and step back about half a meter for the whole-panel view.',
      'Then inspect up close, section by section. A whole-panel glance from arm’s length can miss a lone stuck pixel entirely, so move your face close to the glass and work through the solid colour fields one region at a time, pausing on each. Zooming the browser is not a substitute for this: it redraws the pattern larger on screen but does not enlarge the panel itself, and it changes the mapping between rendered and physical pixels, which is the opposite of what you want when judging whether a single subpixel is stuck.',
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
        problem: 'Colors look wrong on every pattern',
        fix: 'A color filter is almost certainly active. Disable Night Light, f.lux, True Tone, Night Shift, or any hardware-accelerated color profile so the test patterns are the only thing shaping what you see.',
      },
      {
        problem: 'The panel looks even but text and edges look fuzzy',
        fix: 'Display scaling is the most common explanation, because a scaled framebuffer blurs everything the test draws. Set the resolution and scale to the panel’s native values in system display settings and run the test again — if the softness survives that, the cause is elsewhere and a single test page cannot tell you what.',
      },
    ],
    osGuidesTitle: 'Before you test',
    osGuides: [
      {
        os: 'Any system',
        steps: [
          'Set the resolution to the panel’s native value and the browser zoom to 100% — this removes the most common sources of resampling, but it does not guarantee that a rendered pixel lines up with a single physical pixel.',
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
        a: 'It depends on your display settings and on how close you look. Solid colour fields are the most useful pattern for this, because a dead or stuck pixel stands out sharply against a flat field. But whether a single-pixel fault is actually visible at normal viewing distance varies with the panel, your seating distance, and any scaling in play — treat the pattern as something that helps reveal defects, not a promise that every one of them will be obvious from your chair. Move physically closer to the screen and work through the solid colour fields section by section, pausing on each region. Note that zooming the browser does not help here: it enlarges the rendered pattern, not the panel, and it further disrupts the relationship between rendered and physical pixels.',
      },
      {
        q: 'Does one rendered pixel equal one physical pixel?',
        a: 'Not reliably. Browser zoom, operating-system scaling, and display settings such as overscan or a non-native resolution all resample what the page draws, so a dot you see may cover several panel pixels and a panel pixel may never be drawn at all. Setting the browser zoom to 100% and the resolution to the panel’s native value removes the most common sources of resampling, but it does not guarantee a one-to-one mapping: subpixel layout, compositor rounding, and panel-side scaling can still shift it. If a count of defects matters — a warranty claim, say — confirm it up close and against the manufacturer’s own procedure.',
      },
      {
        q: 'Does it work on TVs and external monitors?',
        a: 'Yes — anything the browser can render to. Just remember TVs often apply motion smoothing and overscan that you should disable first, since both distort the pattern independently of the panel itself.',
      },
    ],
  };
}

/**
 * Neutral fallback for the `supporting` category — used only if a future
 * supporting tool ships without its own per-slug content. It describes
 * browser diagnostics generically and deliberately never mentions
 * accelerometers, vibration motors, or controllers, which the previous
 * shared template did on every supporting page.
 */
function supportingDiagnosticsContent(tool: ToolDefinition): ToolContent {
  return {
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} runs read-only checks through standard browser APIs and reports what your current browser and device actually expose. It is a diagnostic, not a benchmark: it answers “does my browser support or expose this?” rather than scoring your hardware.`,
      'Results reflect this browser, its version, its privacy settings, and this device — other browsers and devices can differ. That specificity is the point: use it to compare environments, not to certify hardware.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Keep this page in a normal (non-private) window; private windows restrict several APIs.',
      'Disable content blockers for this site if results look wrong — extensions can hide APIs.',
      'Re-run after changing browser or system settings to confirm the change took effect.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'A check reports unsupported',
        fix: 'Update your browser first; API support depends on engine and version. If a needed API is still missing, check site permissions and content blockers before assuming the feature is absent.',
      },
      {
        problem: 'Results differ between browsers on the same machine',
        fix: 'That is expected. Each engine exposes a different API surface, and privacy settings change what is reported. Compare within one browser across settings, not across engines.',
      },
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        q: 'Does the diagnostic change anything on my device?',
        a: 'No. Checks are read-only queries of standard browser APIs; nothing is installed, modified, or uploaded.',
      },
      {
        q: 'Why do results differ from another site’s checker?',
        a: 'Different tools query different APIs and interpret “supported” differently. This one reports what your browser’s API surface actually exposes, which is the honest, verifiable question.',
      },
    ],
  };
}

function permissionDiagnosticsContent(tool: ToolDefinition): ToolContent {
  return {
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} queries the browser’s Permissions API (navigator.permissions.query) for the states that matter on this site — microphone, camera, clipboard read/write, notifications, geolocation, MIDI, and persistent storage — and shows each as granted, denied, or “prompt” without ever triggering a prompt itself.`,
      'A silent “denied” is the single most common reason a webcam, microphone, or notification-based test fails. This page surfaces those states in one glance, so you know what to fix before running the real hardware test.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Read the state column before changing anything: “granted” needs no action, “prompt” just means you have not decided yet, and “denied” blocks the feature until you reset it.',
      'Refresh after every change — permission states are re-read only when you ask.',
      'Note that Firefox reports only a subset of these names, so some rows can be unavailable there even though the feature works.',
      'If everything reads denied, a hardened browser profile or an enterprise policy may be enforcing it, not your own settings.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'A permission shows denied and the hardware test fails',
        fix: 'Reset it at the source: click the padlock (or sliders) icon in the address bar while on the test page, set the permission back to Allow, then reload and re-check here.',
      },
      {
        problem: 'The page says the Permissions API is unavailable',
        fix: 'Older engines and some hardened browsers do not implement navigator.permissions.query. Diagnose manually: open the target tool, trigger the feature, and answer the prompt — the outcome tells you the state.',
      },
      {
        problem: 'Everything resets after a browser update',
        fix: 'Browser updates and permission managers can clear site decisions. Re-run this page after an update, and re-allow what you actually use.',
      },
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        q: 'Will checking these permissions pop up prompts?',
        a: 'No. navigator.permissions.query only reads the current state — that is its purpose. Prompts appear only when a page actually tries to use the feature.',
      },
      {
        q: 'Why does Firefox show fewer rows?',
        a: 'Firefox implements a subset of the permission names and may not resolve all queries. A missing row there is a browser gap, not a problem with your device.',
      },
      {
        q: 'Does granting here give the site access to anything?',
        a: 'This page grants nothing and cannot. It only reports states; actual access happens inside the individual tools when you explicitly allow their prompts.',
      },
      {
        q: 'Why do microphone and camera show “denied” when other sites work?',
        a: 'Permissions are per-site. Another site being allowed says nothing about this one — check the address-bar icon while on the page that fails.',
      },
    ],
  };
}

function browserCompatibilityContent(tool: ToolDefinition): ToolContent {
  return {
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} probes your browser for the APIs this site’s testers depend on — media capture, Web Audio, WebGL, WebGPU, WebCodecs, workers, storage, input events, sensors, network transports, and more — and shows a support matrix you can search by name.`,
      'Each row answers one question: is this API present in your current browser? It is the fastest way to explain why a specific tester is unavailable here but works on another machine or browser.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Search the matrix for the API named in a tester’s requirements rather than scanning all rows.',
      'Test in the same browser profile you use the failing tool in — extensions and flags change the result.',
      'Keep the page in a normal window: private modes disable some storage and caching APIs.',
      'Re-run after a browser update; support rows can flip either way.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'A tester’s required API shows as unsupported',
        fix: 'Update your browser first. If it stays missing, check content blockers and enterprise policies — they can hide APIs — then try a different browser engine as a fallback.',
      },
      {
        problem: 'Everything shows supported but a tool still fails',
        fix: 'Presence is not permission: getUserMedia can exist and still be denied at the permission layer, and hardware features can fail at the driver layer. Follow up in the Permission Diagnostics page and the failing tool itself.',
      },
      {
        problem: 'Results differ between two computers',
        fix: 'Different browsers, versions, and privacy settings expose different API surfaces. That difference is exactly what this matrix documents — compare row by row to find the gap.',
      },
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        q: 'Does “supported” mean the feature fully works?',
        a: 'No — and the page says so. Presence of an API means the browser exposes it; a working implementation also depends on hardware, drivers, permissions, and the site itself. This matrix is the first check, not the last.',
      },
      {
        q: 'Is anything sent to a server to decide support?',
        a: 'No. Every check runs locally with feature detection (typeof and in checks against your browser’s objects). No network request is involved in producing the matrix.',
      },
      {
        q: 'Why do older browsers show so many gaps?',
        a: 'The APIs this site uses are recent. Browsers ship them at different times — updating is the single most effective fix, and often the only one.',
      },
    ],
  };
}

function codecSupportContent(tool: ToolDefinition): ToolContent {
  return {
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} reports which audio and video codecs your browser can record and play back. Recording rows use MediaRecorder.isTypeSupported to map the container formats a browser’s MediaRecorder can typically produce (WebM with VP8/VP9/AV1 and Opus, plus MP4/H.264 variants); playback rows use the HTMLMediaElement.canPlayType heuristic for common call and streaming codecs. Our own Voice Recorder does not appear in these rows: it captures raw PCM in the Web Audio graph and encodes a genuine WAV (audio/wav) itself, on every engine.`,
      'This matters in practice for other apps: an app built on MediaRecorder has to settle for whatever container its browser supports, and missing H.264 or VP8 playback support can degrade video-call quality. The page shows you that before it surprises you — our own Voice Recorder is unaffected, because it never depends on MediaRecorder.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Read the recording table to understand the format options other recording apps have in this browser, and the playback table for calls and streaming; recordings made on this site are always WAV regardless of what the table shows.',
      'A “maybe” from canPlayType is a real answer: the browser cannot confirm the codec fully, so treat it as uncertain rather than supported.',
      'Re-check after switching browsers — codec support varies more between engines than any other capability here.',
      'Codec support is about software; it says nothing about hardware acceleration or performance.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'A recording format shows unsupported',
        fix: 'Nothing is broken: an app built on MediaRecorder will simply produce its recordings in a different container. That concern applies to other apps, not to the Voice Recorder on this site — it captures raw PCM and encodes WAV itself, so its downloads are always .wav on every engine.',
      },
      {
        problem: 'H.264 shows unsupported and video calls look poor',
        fix: 'Chromium builds without proprietary codecs (some Linux distributions) cannot decode H.264. Install a codec-complete browser build, or accept the VP8/VP9-based fallback the call service negotiates.',
      },
      {
        problem: 'Support differs between two machines with the same browser',
        fix: 'Build configuration and platform codec licenses differ. Trust each machine’s own result — this page is per-browser, not per-brand.',
      },
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        q: 'Does this page download or play any media?',
        a: 'No. It queries MediaRecorder.isTypeSupported and canPlayType — both are metadata-only API calls. No media is fetched, decoded, or recorded.',
      },
      {
        q: 'Why does canPlayType return “probably” or “maybe” instead of yes?',
        a: 'The HTML standard deliberately returns confidence strings, not booleans, because real codec support depends on build flags and platform licenses. “Probably” is the strongest affirmative the API offers.',
      },
      {
        q: 'Can I add codecs to my browser?',
        a: 'Not usually. Support is compiled in per browser build. On Linux distributions that strip proprietary codecs, installing the standard branded browser build restores H.264/AAC.',
      },
      {
        q: 'Does codec support affect audio quality?',
        a: 'Indirectly. If a preferred codec is missing, calls and streamed media fall back to another one with different quality and compression characteristics — the page shows you which fallbacks exist. Recordings made on this site are unaffected because they are encoded as WAV locally.',
      },
    ],
  };
}

function webrtcContent(tool: ToolDefinition): ToolContent {
  return {
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} verifies that your browser can create an RTCPeerConnection and gather ICE candidates — the two primitives every video-call app (Meet, Teams, Zoom-in-browser, Discord) needs to establish a peer-to-peer media path. The check runs locally: it builds a connection and inspects what your own browser reports.`,
      'This is a capability test, not a leak test. It tells you whether WebRTC works at all in this browser — the right question when calls fail to connect — and it deliberately does not evaluate VPN, DNS, or IP exposure.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Run the check in the browser you actually make calls in — capability differs between engines and profiles.',
      'If the check fails, disable privacy extensions that block peer connections, then retest.',
      'Corporate networks can filter the traffic call apps need; a pass here does not guarantee the network allows it.',
      'Re-run after changing VPN or firewall settings, since both can affect the connection path.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'The check reports no peer connection possible',
        fix: 'Strict privacy extensions (and some hardened browsers) disable RTCPeerConnection entirely. Disable them for this site and retest; if it still fails, the browser build itself lacks WebRTC.',
      },
      {
        problem: 'Peer connections work but calls still fail',
        fix: 'The capability exists, so the failure is downstream: TURN/STUN reachability, network filtering, or the service’s own signalling. Check the call app’s network diagnostics next.',
      },
      {
        problem: 'Candidates mention mDNS hostnames',
        fix: 'Modern browsers hide local IP addresses behind .local mDNS names during candidate gathering — that is privacy protection working as designed, not a failure.',
      },
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        q: 'Does this test reveal my IP addresses?',
        a: 'No addresses are shown to you or collected. The test only verifies that candidate gathering succeeds; browsers increasingly mask local addresses behind mDNS names in any case.',
      },
      {
        q: 'Is this a WebRTC leak test?',
        a: 'No — by design. It checks local capability only and does not evaluate VPN or DNS behavior. Use a dedicated leak test if that is your question.',
      },
      {
        q: 'Why would a browser disable WebRTC?',
        a: 'Some privacy-focused builds and extensions disable it to prevent IP exposure in peer-to-peer connections. The trade-off is that video-call apps cannot connect — this test tells you which side of that trade-off you are on.',
      },
      {
        q: 'Does a pass guarantee my calls will work?',
        a: 'It removes one failure cause. Calls also depend on the network path, TURN relays, and the service itself — a pass here means the browser side is ready.',
      },
    ],
  };
}

function systemInfoContent(tool: ToolDefinition): ToolContent {
  return {
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} shows the device facts your browser chooses to expose: the full user-agent string, the platform string, parsed engine and operating system, language preferences, logical CPU core count, bucketed device memory, and screen properties such as resolution and pixel ratio.`,
      'Browsers increasingly reduce this detail to fight fingerprinting, so some fields can be missing or genericized — that is expected behavior, not a fault. Use the page to capture exactly what a web app on this device can see.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Compare the user-agent string with the parsed engine/OS rows — they should agree, and disagreements reveal spoofing extensions.',
      'Expect reduced values in private windows or with anti-fingerprinting tools; the browser is deliberately hiding detail.',
      'Screen values reflect the window and display the browser sees, including OS scaling — not the panel’s marketing spec.',
      'Use the copy action to capture everything for a bug report or support ticket.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'CPU cores or memory show “Not exposed”',
        fix: 'Safari and Firefox omit those APIs (hardwareConcurrency / deviceMemory) entirely or partially. Nothing is wrong — the information is simply not available to any web page in that browser.',
      },
      {
        problem: 'The user-agent does not match my actual system',
        fix: 'A spoofing extension or a browser’s “reduced user-agent” feature is rewriting it. Disable the extension to see the real string, or accept that sites will classify this browser by the spoofed value.',
      },
      {
        problem: 'Screen resolution looks wrong',
        fix: 'The browser reports CSS pixels after OS scaling, not raw panel pixels. A 4K panel at 200% scaling reports half its pixel dimensions — that is the value web content actually uses.',
      },
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        q: 'Is this the same information websites use to track me?',
        a: 'Yes, these are among the surfaces used for fingerprinting — which is why browsers keep shrinking them. This page is a representative sample, not a complete one: a site can also read canvas and font metrics, storage, and other APIs that this page deliberately never touches.',
      },
      {
        q: 'Does this show my device’s real specifications?',
        a: 'Only partially. CPU and memory values are coarse or absent, the user-agent can be reduced or spoofed, and screen values reflect scaling. Treat it as “what the browser exposes”, not a spec sheet.',
      },
      {
        q: 'Is any of this information sent anywhere?',
        a: 'No. Everything shown is read from your own browser and rendered locally; the page sends nothing.',
      },
      {
        q: 'Why does the platform string say something odd?',
        a: 'The legacy platform string is unreliable and browser-specific — modern Chrome on Windows, for example, may report “Win32” even on 64-bit systems. The parsed engine/OS rows are the dependable summary.',
      },
    ],
  };
}

function storageInspectorContent(tool: ToolDefinition): ToolContent {
  return {
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} lists what DeviceTry itself has saved in your browser’s localStorage — test history entries, saved comparisons, and settings such as your theme choice and language — with the byte size of every key. One button clears the site’s stored data; nothing outside this site’s own keys is read or touched.`,
      'This is the site’s privacy control rather than a generic browser tool: it exists so you can see and delete the (browser-local) data DeviceTry keeps, the same data the privacy policy describes.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Check the key list before clearing — you will see exactly which features have saved state, including your theme and language preferences.',
      'Clearing is immediate and cannot be undone; export anything you want to keep first.',
      'If the list shows many keys after light use, that is test history accumulating — clearing it frees the space.',
      'Your browser’s broader site-data settings (cookies, cache, storage for all sites) live in the browser’s own settings, not here.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'The list is empty but I saved results before',
        fix: 'Either the data was already cleared, you are in a private window (which discards storage when it closes), or your browser blocks site data for this origin. Check the address-bar site settings.',
      },
      {
        problem: 'Test history will not save at all',
        fix: 'Site data is being blocked. Allow cookies/site data for this origin, then reload — the testers save to localStorage exactly like other site features.',
      },
      {
        problem: 'Clearing did not reset everything I expected',
        fix: 'The button removes this site’s localStorage keys. Browser-level data (cache, IndexedDB, cookies for other purposes) is managed in your browser’s settings, which is a separate surface.',
      },
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        q: 'What exactly does “clear” delete?',
        a: 'Every DeviceTry-prefixed localStorage key: your test history, saved comparisons, and local preferences like theme. The deletion is immediate and permanent.',
      },
      {
        q: 'Is any of this stored data uploaded?',
        a: 'No. All of it lives in your browser’s localStorage for this site only; it is never transmitted anywhere. Clearing removes it from your device and nowhere else, because it exists nowhere else.',
      },
      {
        q: 'Will clearing log me out or break the site?',
        a: 'There are no accounts here. After clearing you lose saved history and your theme/language preference resets — the tools themselves work exactly as before.',
      },
      {
        q: 'Can I inspect or clear this data outside this page?',
        a: 'Yes — your browser’s developer tools (Application → Local Storage) show the same keys, and the browser’s site-data settings can clear them too. This page is the friendly front end for the same data.',
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

/**
 * Network-tool content. The network category previously shared the browser
 * benchmark template — GPU drivers, thermal throttling, and "scores" that do
 * not exist on a speed test or an IP lookup page. Both tools below make real
 * network requests, and the text says exactly what those requests are.
 */
function internetSpeedContent(tool: ToolDefinition): ToolContent {
  return {
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} measures your connection by transferring real data: it downloads from and uploads to Cloudflare’s public measurement network (speed.cloudflare.com) using the official Cloudflare speed test engine, and reports download speed, upload speed, and latency as each phase completes. Pressing Start immediately begins transferring data — on a mobile connection that can consume a significant amount of your data allowance.`,
      'Because it is a live network measurement rather than a synthetic benchmark, results reflect this connection to that measurement network at this moment: your Wi-Fi signal, other devices sharing the line, routing, and time of day all move the numbers. One run is a data point; several runs at different times show your connection’s real shape.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Stay on this tab for the whole run — background throttling distorts the measurement.',
      'Stop downloads, streaming, cloud backups, and system updates before testing; anything else using the line skews the result.',
      'If the result seems low, retest next to the router or on a wired connection — Wi-Fi is the most common bottleneck.',
      'Run the test at a couple of different times of day; shared-connection congestion is time-dependent.',
      'On a metered mobile connection, remember the test moves real data in both directions before you press Start.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'The result is far below my plan speed',
        fix: 'Retest on a wired connection or right next to the router. If the number recovers, Wi-Fi was the bottleneck; if it does not, check whether other devices are saturating the line, then contact your ISP with your results.',
      },
      {
        problem: 'The latency number looks high',
        fix: 'Latency here is HTTP round-trip timing to the measurement endpoint, not an ICMP ping — it includes connection setup and server processing. Background traffic on your connection inflates it; retest with the line idle.',
      },
      {
        problem: 'The test fails partway through',
        fix: 'A proxy, VPN, or privacy extension can block the large transfers the test performs. Disable them for this site and retest; transient measurement-server issues also resolve on retry.',
      },
      {
        problem: 'Results differ a lot between runs',
        fix: 'That is normal for a live network. Compare runs under the same conditions — same time of day, same spot, nothing else using the connection — and treat the median as your realistic number.',
      },
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        q: 'What happens to my test data and results?',
        a: 'The test transfers data to and from Cloudflare’s measurement network, and Cloudflare collects measurement results on completion for aggregated internet-quality insights under its own terms. DeviceTry does not receive or store your measurements — the privacy policy describes this in detail.',
      },
      {
        q: 'Is the latency number the same as ping?',
        a: 'Close, but not identical: this test measures HTTP round-trip time to the measurement endpoint, which includes connection handling rather than a bare network ping. Treat it as an application-level latency figure.',
      },
      {
        q: 'Why do I get different numbers on other speed test sites?',
        a: 'Every test uses different servers, protocols, and parallelism, and your route to each differs. Compare trends within one tool over time instead of cross-checking absolute numbers between tools.',
      },
      {
        q: 'Does the test use my data allowance?',
        a: 'Yes — it makes real transfers in both directions. On a metered mobile connection that can be significant; the result is worth it on Wi-Fi, but think twice on a capped cellular plan.',
      },
    ],
  };
}

function whatIsMyIpContent(tool: ToolDefinition): ToolContent {
  return {
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} shows the public IP address your connection currently presents to websites. Pressing Show My IP sends one small request to this site’s own lookup endpoint — that single request is the tool’s entire network activity — and the reply is displayed to you only.`,
      'The tool deliberately does not look up geolocation, ISP, or identity information: an address alone answers the question “what does the internet see as my address right now?”. If you use a VPN or proxy, the address shown is the VPN/proxy exit address by design — which makes this a quick way to confirm your VPN is routing.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Press Show My IP when you want a reading; the page does not poll the endpoint in the background.',
      'Use the copy button if you need the address in a support ticket or firewall rule.',
      'To verify a VPN, note the address with the VPN off, then on — the on-address should be the VPN exit, not your home ISP.',
      'Reload and re-check after switching networks (Wi-Fi to cellular, for example) to see each connection’s own address.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'The request never completes',
        fix: 'A privacy extension or corporate proxy can block the lookup request. Try a private window with extensions disabled; if it still fails, the network you are on is filtering the request.',
      },
      {
        problem: 'This is not my home IP address',
        fix: 'If a VPN or proxy is active, the exit address is what any website sees — including this tool. Mobile carriers also assign carrier-grade NAT addresses that may not match what you expect. Disconnect the VPN and re-check to see the raw connection address.',
      },
      {
        problem: 'I expected an IPv4 address and got IPv6',
        fix: 'Your network and browser prefer IPv6 when both are available, so the connection presents the v6 address first. Both are identified where the connection makes that reliable; re-check on an IPv4-only network to see the v4 address.',
      },
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        q: 'Is my IP address stored or logged?',
        a: 'The reply is shown to you only; DeviceTry does not store it in application storage or logs. As with any internet request, the network operators and hosting infrastructure involved (including Cloudflare) process standard request metadata under their own policies — the privacy policy covers this.',
      },
      {
        q: 'Does this tool show my physical location?',
        a: 'No. No geolocation lookup is performed and no location is displayed — an IP address alone is not a precise location either. This page answers one question: the public address your connection presents.',
      },
      {
        q: 'Why does my IP change between checks?',
        a: 'Internet providers assign addresses dynamically: your ISP’s DHCP, mobile networks, and VPN servers all rotate addresses routinely. A changing public IP is normal; a persistent one is a business feature.',
      },
      {
        q: 'Can I use this to test my VPN?',
        a: 'Yes, that is one of its best uses. With the VPN active, the address shown is the VPN exit — if you ever see your home ISP address while connected, the VPN is not routing your traffic and should be reconnected or reconfigured.',
      },
    ],
  };
}

function refreshRateContent(tool: ToolDefinition): ToolContent {
  return {
    aboutTitle: `About the ${tool.title}`,
    about: [
      `The ${tool.title} measures the cadence at which your browser renders frames using requestAnimationFrame timing, then reports a stabilized estimate in Hz. It is the practical check that a high-refresh monitor is actually configured for its rated mode — the number you see is the frame cadence the browser is being given on this system right now.`,
      'It is a browser-rendering measurement, not a hardware certification: the reading converges on the refresh rate the OS has configured for the display, and system load, power-saving modes, or V-Sync features can pull it below what the panel supports. For what it does measure, it is the fastest way to spot a 120 Hz monitor quietly running at 60 Hz.',
    ],
    tipsTitle: 'Tips for a reliable result',
    tips: [
      'Watch the live measurement for a few seconds and use the stabilized value, not the first frame count.',
      'Compare the estimate against the refresh rate configured in your OS display settings — they should agree.',
      'Close heavy tabs and keep this tab in the foreground; other work lowers the measured cadence.',
      'On a laptop, plug in and disable battery saver — power limits can cap rendering below the panel’s capability.',
      'Re-run after changing display settings to confirm the new refresh rate is actually active.',
    ],
    problemsTitle: 'Common problems and fixes',
    problems: [
      {
        problem: 'The reading is lower than my monitor’s rated HZ',
        fix: 'Check the refresh rate configured in your OS display settings first — a high-refresh panel runs at its configured rate, not its maximum. On laptops, battery saver and integrated-GPU power limits can also cap the cadence.',
      },
      {
        problem: 'The reading bounces between values',
        fix: 'V-Sync, variable refresh, or dynamic-refresh features make the compositor switch cadences, and background load adds jitter. Re-run a few times with the machine idle and take the stable value.',
      },
      {
        problem: 'The reading is dramatically low',
        fix: 'The tab was likely backgrounded or the machine was saturated during measurement. Keep the tab visible, close heavy applications, and re-run; a laptop on battery saver may also be throttled by design.',
      },
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        q: 'Does this certify my monitor’s refresh rate?',
        a: 'No. It measures browser-rendering timing via requestAnimationFrame — the cadence the browser is given on this system — not the panel’s specification. A 144 Hz panel configured at 60 Hz will honestly read about 60.',
      },
      {
        q: 'Can it detect screen tearing or input lag?',
        a: 'No. It measures frame cadence only — it says nothing about tearing, latency, or motion clarity. Those need dedicated visual or hardware tests.',
      },
      {
        q: 'Why does the number wobble slightly?',
        a: 'Frame scheduling has natural granularity and background activity adds noise. The tool stabilizes over a few seconds; trust the settled value rather than any single frame interval.',
      },
      {
        q: 'Does a higher number mean better gaming performance?',
        a: 'It means the browser is being given frames more often. Game performance depends on GPU load, settings, and the game itself — this reading tells you the display pipeline’s cadence, nothing about GPU power.',
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
    'Because the tester uses the same getUserMedia pipeline as Zoom, Meet, and Teams, it is a close preview of your next call — but not a guarantee. Call apps apply their own resolution caps, frame-rate targets, and processing on top of what the camera delivers, so always confirm the result inside the app itself before an important meeting. Everything stays local: frames are processed in browser memory and destroyed when you close the tab.',
  ],
  tipsTitle: 'How to get an accurate result',
  tips: [
    'Test in the lighting you actually use for calls — webcam sensors change behavior dramatically between bright and dim rooms.',
    'Check the reported resolution against the camera’s spec: 1080p webcams often default to 720p until you set it in the conferencing app.',
    'Watch the frame rate while waving a hand, and note whether it is low from the start or falls partway through. This page reports the delivered frame rate and nothing about its cause — a low or falling number has several possible explanations, from USB bandwidth and heat to power management and background load, and the tester cannot tell them apart.',
    'Keep the frame counter climbing while you move: wave a hand in front of the lens or point the camera at a lamp and the counter should keep advancing. A counter that stops means the browser has stopped receiving frames altogether — it is not what the lens is pointed at.',
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
      problem: 'Frame rate is low, or falls after a minute',
      fix: 'Several different things produce this and the page cannot distinguish them. USB bandwidth contention is one possibility — try a different port, preferring USB 3.0 directly on the machine, and unplug other high-bandwidth devices like capture cards. Heat is another, so test on a cool machine with the power adapter connected. Equally plausible: CPU or GPU load from other apps starving the capture pipeline, aggressive power saving suspending the camera, a long or unpowered hub, a mismatched resolution/frame-rate mode the driver is downsampling, or background auto-exposure hunting in a dim room and eating frames. Change one variable at a time and compare the reported frame rate after each, because no single reading here identifies which cause is yours.',
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
  'audio-video': audioOutputContent,
  'input-devices': keyboardContent,
  display: screenContent,
  network: browserPerfContent,
  supporting: supportingDiagnosticsContent,
};

/**
 * Per-slug overrides for tools whose content must not come from their
 * category template: the three non-flagship audio tools, every input tool
 * except the keyboard (which is the category template), all six supporting
 * diagnostics, both network tools, the refresh-rate display tool, and the
 * touchscreen.
 */
const CONTENT_BY_SLUG: Record<string, (tool: ToolDefinition) => ToolContent> = {
  'speakers-test': speakersContent,
  'tone-generator': toneGeneratorContent,
  'voice-recorder': voiceRecorderContent,
  'touchscreen-test': touchscreenContent,
  'mouse-test': mouseContent,
  'gamepad-test': gamepadContent,
  'click-speed-test': clickSpeedContent,
  'reaction-time-test': reactionTimeContent,
  'permission-diagnostics': permissionDiagnosticsContent,
  'browser-compatibility': browserCompatibilityContent,
  'codec-support': codecSupportContent,
  'webrtc-test': webrtcContent,
  'browser-system-info': systemInfoContent,
  'devicetry-storage-inspector': storageInspectorContent,
  'internet-speed-test': internetSpeedContent,
  'what-is-my-ip': whatIsMyIpContent,
  'refresh-rate-test': refreshRateContent,
};

export function getToolContent(tool: ToolDefinition): ToolContent {
  const flagship = FLAGSHIP[tool.id];
  if (flagship) return flagship;
  const bySlug = CONTENT_BY_SLUG[tool.slug];
  if (bySlug) return bySlug(tool);
  return TEMPLATE_BY_CATEGORY[tool.category](tool);
}
