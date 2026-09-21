import { GuideArticle } from '../schema';

export const webcamNotWorking: GuideArticle = {
  slug: 'webcam-not-working',
  title: 'Webcam Not Working: From Black Screen to Working Camera',
  description:
    'A structured fix list for a webcam that shows a black screen or is simply not detected: camera permissions, device conflicts, driver resets, and USB troubleshooting.',
  category: 'video',
  type: 'troubleshooting',
  relatedToolSlugs: ['webcam-test', 'microphone-test', 'screen-test'],
  relatedGuideSlugs: ['microphone-not-working', 'webcams-for-low-light-calls'],
  intro:
    'A webcam that refuses to show video is usually blocked by a permission, held hostage by another application, or misdetected after a driver update. This guide separates those causes quickly: first prove what the browser can see, then fix whichever layer is broken.',
  published: true,
  publishedAt: new Date('2026-08-14'),
  updatedAt: new Date('2026-09-15'),
  hasAffiliateLinks: false,
  sections: [
    {
      h2: 'Establish whether the camera reaches the browser',
      paragraphs: [
        'Open the Webcam Test and click Start Test. If you see yourself, the camera chain works end to end — any remaining problem belongs to the specific app you were trying to use. If the browser shows "no camera", "permission denied", or an endless black frame, work down this page in order.',
      ],
    },
    {
      h2: 'Browser camera permission',
      paragraphs: [
        'Just like the microphone, camera access is gated per site and can silently reset after updates.',
      ],
      steps: [
        'Click the padlock or tune icon in the address bar while on the test page.',
        'Set Camera to Allow and reload.',
        'Chrome global check: Settings → Privacy and security → Site settings → Camera; make sure the correct camera is the default and the site is not in the Block list.',
        'macOS: System Settings → Privacy & Security → Camera must list and enable your browser.',
        'Windows: Settings → Privacy & security → Camera — enable "Camera access" and "Let apps access your camera".',
      ],
    },
    {
      h2: 'Free the camera from exclusive locks',
      paragraphs: [
        'Cameras are single-user devices. If another app opened the camera first, the browser gets either nothing or a degraded stream.',
      ],
      bullets: [
        'Fully quit Zoom, Teams, Skype, OBS, and browser tabs that use the camera (check the system tray/menu bar, not just the window).',
        'On Windows, open Task Manager and end any background "Camera" helper processes.',
        'Disable virtual camera drivers you no longer use (OBS Virtual Camera, Snap Camera remnants) — they can hijack the default device slot.',
        'Re-run the test after each app you close; the moment the stream appears you found the lock holder.',
      ],
    },
    {
      h2: 'Device selection and detection',
      steps: [
        'In the test, open the camera picker and try every listed device — stale virtual cameras often occupy the default slot.',
        'External USB webcams: unplug, wait five seconds, reconnect directly to the computer (avoid hubs and monitor ports first).',
        'Try a different USB port, ideally USB 2.0 for older webcams whose controllers negotiate poorly with USB 3.',
        'Windows Device Manager → Cameras: if the device shows a warning icon, right-click → Uninstall device, then scan for hardware changes.',
      ],
    },
    {
      h2: 'Driver and OS-level fixes',
      paragraphs: [
        'If the camera is detected but delivers black frames, a driver update is the usual suspect. On Windows, roll back the driver from Device Manager → Properties → Driver tab, or install the latest one from the manufacturer (Logitech, Elgato, Razer) rather than the generic UVC driver. On macOS, camera access for browsers changed in recent versions — a reboot after enabling privacy access clears a stuck daemon more often than any setting.',
      ],
    },
    {
      h2: 'Physical checks people forget',
      bullets: [
        'Built-in laptop privacy shutters and keyboard function-key camera kills (often F8 or Fn+F10) are easy to trigger accidentally.',
        'External webcams with a physical shutter: make sure it is fully open — a half-closed shutter produces a dim, half-black frame.',
        'Check the lens for a stuck tape strip; new devices ship with one.',
      ],
    },
    {
      h2: 'Interpreting what the test shows',
      bullets: [
        'Video appears but looks frozen every few seconds → USB bandwidth contention; unplug other USB cameras or move to a different port.',
        'Video appears very dark → that is exposure, not failure; see the low-light webcam guide for why small sensors do this.',
        'Resolution lower than the spec → the browser negotiated a conservative constraint; the delivered-resolution panel in the test shows the actual stream values.',
      ],
    },
  ],
  faqs: [
    {
      q: 'Why does my webcam work in one browser but not another?',
      a: 'Each browser keeps its own site permissions and its own default camera choice. Re-allow permission in the failing browser and pick the device explicitly in the test.',
    },
    {
      q: 'My camera works here but Zoom still shows black. Why?',
      a: 'Zoom holds its own device selection and can retain a stale virtual camera. Quit Zoom completely, reopen its video settings, and select the same camera the browser test sees.',
    },
    {
      q: 'Does this webcam test upload my video anywhere?',
      a: 'No. The stream is processed locally in your browser; snapshots stay on your device unless you choose to share them yourself. See the privacy page for details.',
    },
  ],
};
