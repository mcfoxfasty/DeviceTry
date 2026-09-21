import { GuideArticle } from '../schema';

export const pcControllers: GuideArticle = {
  slug: 'pc-controllers',
  title: 'Buying Guide: PC Controllers',
  description:
    'Connection standards, stick technology, and platform compatibility explained — with specification-based picks including drift-resistant hall-effect sticks, and how to verify a controller before committing.',
  category: 'input-gaming',
  type: 'buying',
  relatedToolSlugs: ['gamepad-test', 'reaction-time-test'],
  relatedGuideSlugs: ['controller-stick-drift'],
  intro:
    'Controller quality lives in three specifications: which input standard it speaks, how its sticks measure position, and which platforms it pairs with. Everything else — lighting, software suites, shape preferences — is secondary. This guide explains those three, then maps them to three picks. Selections are specification-based from manufacturer documentation; no hands-on lab testing is performed here.',
  published: true,
  publishedAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-15'),
  hasAffiliateLinks: false,
  sections: [
    {
      h2: 'The three specifications that matter',
      bullets: [
        'Input standard: controllers that speak the Xbox Input (XInput) standard work with virtually every PC game out of the box; PlayStation-style controllers need Steam Input or game support for full functionality.',
        'Stick technology: conventional potentiometer sticks wear and eventually drift; hall-effect sticks measure magnetically and eliminate the wear mechanism that causes drift.',
        'Connectivity: USB-C wired is zero-latency and zero-battery-anxiety; 2.4 GHz dongles are low-latency wireless; Bluetooth suits mobile and couch use but adds slight latency.',
      ],
    },
    {
      h2: 'Specification-based picks',
      productIds: ['ctl-xbox-series-controller', 'ctl-8bitdo-ultimate-2c', 'ctl-dualsense'],
      productNotes: {
        'ctl-xbox-series-controller':
          'The compatibility default: XInput-native with textured grip, a share button, and flexible AA/USB-C power. If you want every PC game to just work, this is the specification to match.',
        'ctl-8bitdo-ultimate-2c':
          'The drift-resistant budget pick: hall-effect sticks by design — the wear mechanism behind stick drift simply does not exist — plus a 2.4 GHz dongle at a budget price. Windows-focused; check variant compatibility for mobile.',
        'ctl-dualsense':
          'The feature pick: adaptive triggers and haptics in supporting titles, a built-in microphone and headset jack, and full function on PS5 — on PC it shines through Steam Input, with partial XInput mapping elsewhere.',
      },
    },
    {
      h2: 'Compatibility facts worth checking',
      bullets: [
        'Xbox controller: wired, Bluetooth, and Xbox Wireless on Windows; native support on Android and most Linux setups via the xpad driver family.',
        '8BitDo Ultimate 2C: Windows via included dongle; Bluetooth variants target Android/iOS — verify the exact model variant before buying for mobile.',
        'DualSense: PS5 native; on PC use Steam for full feature support, otherwise expect basic XInput mapping; audio jack works wired.',
        'All three charge or power over USB-C; battery life varies most under heavy haptics use (a DualSense characteristic).',
      ],
    },
    {
      h2: 'Trade-offs to accept',
      paragraphs: [
        'The Xbox controller\u2019s mainstream design means no gyro aiming and a plastic build at its price. The 8BitDo saves money with fewer platform options and Windows-only software customization. The DualSense\u2019s advanced features depend on game and platform support — outside the PlayStation and Steam ecosystems they simply do not activate, and its battery life under haptics is shorter than rivals. Shape preference is real too: grips and stick placement differ enough that specifications alone cannot predict comfort.',
      ],
    },
    {
      h2: 'Verify before the return window closes',
      steps: [
        'Connect the controller and press any button in the Gamepad Test to confirm detection.',
        'Press every button and move both sticks, watching each register — a new controller should have zero dead zones.',
        'Run the Neutral Drift Check with sticks untouched; the resting offset should sit well inside the tool\u2019s approximate threshold.',
        'Test the vibration actuator and headphone jack (where present) before disposing of the receipt.',
      ],
    },
  ],
  faqs: [
    {
      q: 'Are hall-effect sticks really drift-proof?',
      a: 'The drift mechanism — a wiper wearing a resistive track — does not exist in a hall-effect design, which reads position magnetically. They have their own failure modes, but classic wear drift is not one of them.',
    },
    {
      q: 'Do all PC games support every controller?',
      a: 'No. Games built on the Xbox Input standard expect an Xbox-layout controller; PlayStation-style controllers work through Steam Input or per-game support. Check the game\u2019s platform notes when in doubt.',
    },
    {
      q: 'Wired or wireless for competitive play?',
      a: 'Wired and 2.4 GHz dongles both deliver consistently low latency; Bluetooth adds the most. If input timing matters to you, prefer wired or a dongle.',
    },
  ],
};
