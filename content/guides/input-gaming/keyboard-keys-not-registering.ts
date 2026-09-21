import { GuideArticle } from '../schema';

export const keyboardKeysNotRegistering: GuideArticle = {
  slug: 'keyboard-keys-not-registering',
  title: 'Keyboard Keys Not Registering: Diagnose Dead Keys and Random Dropouts',
  description:
    'Find out why specific keys stop responding or register intermittently: software filters, debris, failing switches, ribbon cables, and how a key test isolates the layer at fault.',
  category: 'input-gaming',
  type: 'troubleshooting',
  relatedToolSlugs: ['keyboard-test', 'click-speed-test', 'mouse-test'],
  relatedGuideSlugs: ['mechanical-keyboards'],
  intro:
    'A dead key is one of the few faults you can pinpoint precisely, because each key\u2019s journey is independent: the switch (or membrane dome), the controller, the USB link, the OS, and finally the browser. Testing the keyboard key-by-key tells you whether the fault is physical, electrical, or software — before you open anything.',
  published: true,
  publishedAt: new Date('2026-08-20'),
  updatedAt: new Date('2026-09-15'),
  hasAffiliateLinks: false,
  sections: [
    {
      h2: 'Map exactly which keys fail',
      paragraphs: [
        'Open the Keyboard Test and press every key slowly, then note the failures. The pattern is the diagnosis: a single dead key usually means a failed switch or dome under it; a whole column or row points to the internal matrix or ribbon cable; random keys across the board suggest a controller or connection problem; and a key that registers twice when pressed once is switch chatter — a hardware fault that worsens over time.',
      ],
    },
    {
      h2: 'Exclude the software layers first',
      steps: [
        'Test in another browser, and if possible another user account — extensions and utilities (key remappers, macro tools, anti-keylogger software) can swallow specific keys.',
        'Check whether the keys work in a text editor: if they fail in the editor too, the OS layer is involved, not the browser.',
        'Windows: verify no Filter Keys is active (Settings → Accessibility → Keyboard) — it ignores brief or repeated presses.',
        'Try the keyboard on a different computer. Keys that work elsewhere point to your system; keys that fail everywhere point at the hardware.',
      ],
    },
    {
      h2: 'Debris and cleaning',
      paragraphs: [
        'Dust, hair, crumbs, and drink residue are the leading cause of intermittent single-key failures. For mechanical keyboards, pull the affected keycap and blow the stem area with compressed air; a drop of isopropyl alcohol on a swab can clean sticky residue around the switch. For membrane keyboards (most office laptops and cheap externals), debris under the dome causes exactly the "press harder and it works" symptom. Full disassembly of a membrane keyboard is rarely worth the risk — attempt it only on hardware you can afford to lose.',
      ],
    },
    {
      h2: 'Mechanical switch faults and the hot-swap advantage',
      paragraphs: [
        'On mechanical boards, individual switches fail after millions of actuations or a spilled drink. If your keyboard is hot-swappable, replacing one switch takes a minute: pull the keycap, grip the switch, release the two socket tabs, and press in a replacement of the same pin layout. On soldered boards the fix requires a soldering iron and confidence — often uneconomical outside flagship boards.',
      ],
    },
    {
      h2: 'Controller and connection faults',
      bullets: [
        'A whole row or column dying in a sudden event (spill, drop) is typically the matrix ribbon — on many laptop and cheap external boards this is not repairable.',
        'USB keyboards: replace the cable or try another port; a flaky cable produces random multi-key dropouts that mimic software issues.',
        'Wireless boards: low battery often manifests as specific keys skipping before full failure — replace or charge the battery and re-pair.',
        'If the board has a mode switch (Windows/Mac), flip it; wrong-mode boards map some keys to nothing.',
      ],
    },
    {
      h2: 'Rollover and ghosting: when "not registering" is normal',
      paragraphs: [
        'Pressing five or more keys at once can exceed what the keyboard can report simultaneously (its rollover limit); extra presses are simply dropped. Membrane keyboards often manage only 2–3 keys, which is why gaming on them feels unresponsive. This is a design limitation, not a fault. If you regularly chord many keys, the mechanical-keyboard guide explains rollover specifications worth looking for.',
      ],
    },
  ],
  faqs: [
    {
      q: 'One key registers twice per press. Can I fix it?',
      a: 'That is chatter — the switch contacts bounce. Mechanical boards can be fixed by replacing the switch; on hot-swap models that is a minute of work. Membrane keyboards with chatter are usually replaced.',
    },
    {
      q: 'My keys fail only in games, not in the browser test. Why?',
      a: 'Games with anti-cheat or exclusive input modes can filter keys differently, and some use raw input that bypasses OS remapping. If the browser test shows all keys registering, the keyboard is healthy.',
    },
    {
      q: 'Can a keyboard test detect a failing key before it dies completely?',
      a: 'Intermittent registration — a key that misses during fast repeats — is the early warning sign. Run the test with rapid repeated presses of suspect keys to catch it.',
    },
  ],
};
