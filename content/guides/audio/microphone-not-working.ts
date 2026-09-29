import { GuideArticle } from '../schema';

export const microphoneNotWorking: GuideArticle = {
  slug: 'microphone-not-working',
  title: 'Microphone Not Working? A Complete Troubleshooting Guide',
  description:
    'Step-by-step fixes for a microphone that produces no sound in any app: permissions, device selection, drivers, and hardware checks you can run in minutes.',
  category: 'audio',
  type: 'troubleshooting',
  relatedToolSlugs: ['microphone-test', 'voice-recorder', 'speakers-test'],
  relatedGuideSlugs: ['microphone-too-quiet'],
  intro:
    'When a microphone produces nothing at all, the cause is almost always one of five things: a privacy permission, the wrong input device, the microphone being muted at the hardware level, a driver that reset itself, or a failed connection. Work through this guide in order — most people find the fault in the first two sections.',
  // The lead figure is a supplied photograph. The three figures inside the
  // article are original diagrams, never screenshots: nothing there asserts a
  // reading, a permission state or a device the reader has not seen — each
  // only restates, in pictures, a list the article already makes. `kind` is
  // explicit on every figure so a drawn diagram is never read as a
  // photograph of the reader's own setup.
  featuredImage: {
    kind: 'photo',
    src: '/guides/microphone-not-working-hero',
    width: 1672,
    height: 941,
    // Describes what is actually in the frame. It deliberately does not name
    // the control the hand is touching: that detail could not be confirmed
    // from the file at a resolution where it is legible, and an alt text that
    // guesses is worse than one that stops short.
    alt: 'A black desktop USB microphone on a small stand in the middle of a wooden desk, with a hand resting against the side of its body. An open laptop sits to the left, black over-ear headphones lie to the right, and a notebook and a potted plant are in the foreground. The room is a home office lit by daylight from a window behind, with a second plant on a shelf in the background.',
  },
  published: true,
  publishedAt: new Date('2026-08-14'),
  updatedAt: new Date('2026-09-29'),
  hasAffiliateLinks: false,
  sections: [
    {
      h2: 'First: confirm whether the mic reaches the browser at all',
      paragraphs: [
        'Before changing any settings, establish what is actually broken. Run the online microphone test on this site. If the meter moves when you speak, an audio signal has reached this browser test — which tells you the microphone and this page\u2019s permission are working here, and nothing beyond that. Another app may be opening a different input, or holding a permission of its own, so a test on this page is not a verdict on the microphone that app is using. If the silence is confined to one app, skip to the last section of this guide. If the meter stays flat, continue below.',
      ],
      steps: [
        'Open the Microphone Test and click Start Test.',
        'Speak at a normal volume about a hand-width from the microphone.',
        'Watch the input level meter: any movement means the signal path works.',
      ],
      image: {
        kind: 'diagram',
        src: '/guides/microphone-not-working-signal-arrives',
        width: 640,
        height: 470,
        alt: 'Diagram. A flow diagram of the first check. After speaking into the microphone a hand-width away, one question decides the rest of the guide: does the level meter move? If it does, an audio signal has reached this browser test, so the microphone and this page\u2019s permission are working here — not in the app that is still silent, which may open a different input or hold a permission of its own; skip to the last section. If it does not, the signal never arrived and the guide continues with permissions, device selection and then hardware.',
        caption: 'One test tells you which half of this guide you actually need.',
      },
    },
    {
      h2: 'Check the browser privacy permission',
      paragraphs: [
        'Modern browsers require explicit permission before any site can open your microphone. A previously granted permission can also silently revert after a browser update or a settings reset.',
      ],
      image: {
        kind: 'diagram',
        src: '/guides/microphone-not-working-permission-layers',
        width: 640,
        height: 452,
        alt: 'Diagram. Three stacked layers that must all allow microphone access before a page can use it: the operating system privacy setting, which is the master switch for every app on the machine; the browser site permissions, which record what this browser allows, kept per site; and the current page, which records what the tab in front of you is allowed to use. A note below warns that opening the top layer does not open the other two.',
        caption:
          'The three steps and bullets below cover these layers in turn, and name the exact menus.',
      },
      steps: [
        'Click the padlock (or tune) icon at the left of the address bar.',
        'Find Microphone in the site permissions list.',
        'If it says Blocked, change it to Allow and reload the page.',
        'In Chrome you can also open Settings → Privacy and security → Site settings → Microphone to check the global default and the blocked-sites list.',
      ],
      bullets: [
        'macOS: System Settings → Privacy & Security → Microphone — your browser must be listed and enabled.',
        'Windows: Settings → Privacy & security → Microphone — enable both "Microphone access" and "Let apps access your microphone".',
        'If you use a browser profile with strict privacy extensions, disable them for this test; some block getUserMedia entirely.',
      ],
    },
    {
      h2: 'Check the operating system input device and level',
      paragraphs: [
        'The OS decides which device receives system audio. Headsets that registered as two devices (headphones plus microphone) are a common source of confusion after reconnecting.',
      ],
      steps: [
        'Windows: Settings → System → Sound → Input. Speak and watch the "Test your microphone" bar while the correct device is selected.',
        'macOS: System Settings → Sound → Input. Select your microphone and watch the Input level respond.',
        'Confirm the input volume is not at zero and the device is not muted there.',
        'USB microphones: try a different USB port, preferably directly on the computer rather than a hub.',
      ],
    },
    {
      h2: 'Hardware mutes, switches, and physical faults',
      paragraphs: [
        'Many headsets mute by flipping the boom arm up or by an inline remote button, and the mute state persists. Gaming headsets sometimes ship with the mute switch engaged from the factory.',
      ],
      bullets: [
        'Check the inline remote or boom-arm mute position.',
        'On laptops, confirm no function-key mic mute is active (often F4 or F8 with an LED).',
        'Try the microphone on another device — if it is also silent there, the cable or capsule has failed.',
        '3.5 mm headsets on phones: a TRRS plug fully inserted but in a TRS-only port will record silence.',
      ],
    },
    {
      h2: 'Driver and app-level causes',
      paragraphs: [
        'If the microphone appears in the OS but records silence everywhere, reinstall the audio driver. On Windows, Device Manager → Sound, video and game controllers → right-click the device → Uninstall device, then reboot and let Windows re-detect it. Audio enhancements (Windows "audio enhancements", Realtek effects) can also break input; toggle them off for the microphone device.',
        'If other apps hear you but one specific conferencing app does not: check that app\u2019s own input-device selector, its in-app microphone setting, and whether another app (OBS, Discord with exclusive mode) is holding the device exclusively. Close other audio apps, then retry.',
      ],
    },
    {
      h2: 'Still nothing? The quick decision list',
      // The full signal path, recapped now that the reader has walked it. It
      // was the lead figure while this article had no photograph; as a
      // summary it reads better than as a preamble.
      image: {
        kind: 'diagram',
        src: '/guides/microphone-not-working-signal-path',
        width: 640,
        height: 672,
        alt: 'Diagram. A numbered vertical chain of the five places a silent microphone can lose its signal, in the order to check them: microphone hardware (mute switch, boom arm, or a failed capsule); the connection (cable, USB port, or Bluetooth pairing); the operating system (wrong input device, level at zero, or muted); the browser permission (site permission, or the OS privacy switch); and the app you are using (its own device picker, or another app locking it).',
        caption:
          'The five checkpoints are the sections of this guide in order. The diagram repeats the list, it does not add to it.',
      },
      bullets: [
        'Meter moves in the test but not in the app → fix the app\u2019s device selection or reinstall/re-login to the app.',
        'Permission resets itself after every reload → check the browser\u2019s global site-setting and any privacy/antivirus software.',
        'Silent on every device you try → hardware fault; replace or claim warranty.',
        'Works wired, silent on Bluetooth → re-pair the headset and check it is in headset (hands-free) mode for calls.',
      ],
    },
  ],
  faqs: [
    {
      q: 'Why does my microphone work in the browser test but not in Zoom or Teams?',
      a: 'Conferencing apps choose their own input device, independent of the system default. Open the app\u2019s audio settings and select the exact device the browser test sees. Also check the app\u2019s own permission in OS privacy settings.',
    },
    {
      q: 'Can a browser update turn off microphone access?',
      a: 'Yes. Browser and OS updates can reset site permissions or re-prompt privacy choices. If access vanishes after an update, re-allow it from the address-bar padlock icon.',
    },
    {
      q: 'My meter shows signal but recordings are silent. What now?',
      a: 'Some systems route recording through a different device than monitoring. Record with the Voice Recorder tab and check OS input selection. If the recording is silent while the live meter moves, the recording app is capturing the wrong endpoint.',
    },
    {
      q: 'Is an online mic test safe to use?',
      a: 'This site processes microphone audio locally in your browser; samples are not uploaded. See the privacy page for the full breakdown of what each tool does and does not send anywhere.',
    },
  ],
};
