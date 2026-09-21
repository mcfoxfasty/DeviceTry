import { GuideArticle } from '../schema';

export const controllerStickDrift: GuideArticle = {
  slug: 'controller-stick-drift',
  title: 'Controller Stick Drift: Diagnose It, Calibrate It, Fix It',
  description:
    'How to confirm stick drift, separate calibration problems from worn potentiometers, run a neutral check, and choose between cleaning, calibration, replacement modules, or drift-resistant sticks.',
  category: 'input-gaming',
  type: 'troubleshooting',
  relatedToolSlugs: ['gamepad-test', 'touchscreen-test'],
  relatedGuideSlugs: ['pc-controllers'],
  intro:
    'Stick drift — your character or cursor creeping without you touching the stick — starts as a nuisance and ends as a reason to retire a controller. Not all drift is hardware death: some is calibration debt or debris. This guide helps you tell which kind you have before you spend anything.',
  published: true,
  publishedAt: new Date('2026-08-20'),
  updatedAt: new Date('2026-09-15'),
  hasAffiliateLinks: false,
  sections: [
    {
      h2: 'Confirm drift with a neutral check',
      paragraphs: [
        'In the Gamepad Test, run the Neutral Drift Check while the sticks are completely untouched. The tool samples the resting position for 2.5 seconds and reports whether the idle offset exceeds its approximate threshold. Note: the threshold is this tool\u2019s heuristic for flagging obvious drift — it is not a manufacturer certification, and a small resting offset that never moves your cursor in real games is harmless.',
      ],
      steps: [
        'Connect the controller, then leave both sticks untouched.',
        'Run the Neutral Check and read the reported idle offsets.',
        'Repeat twice; genuine drift is consistent, while electrical noise varies between runs.',
      ],
    },
    {
      h2: 'Calibration debt: the cheap explanation',
      paragraphs: [
        'Some platforms store a per-controller neutral calibration. If the controller was moved during power-on, was calibrated on a shaky surface, or was previously recalibrated with the stick held off-center, the stored neutral no longer matches reality. Re-calibrate with the sticks untouched: console controllers recalibrate neutrals at power-on (so reconnect them while resting flat), and Windows exposes calibration via Control Panel → Devices and Printers → controller → Game controller settings → Properties → Calibrate. If drift vanishes after recalibration, you are done — no hardware fault exists.',
      ],
    },
    {
      h2: 'Debris under the stick mechanism',
      paragraphs: [
        'Pocket lint and dust between the stick shaft and its housing produce mechanical bias that reads as drift. Power the controller off, work a small amount of isopropyl alcohol around the base of the shaft while gently cycling the stick, then let it dry fully and re-test. Multiple careful cycles often clear it. Compressed air alone can push debris deeper — use it sparingly and after the alcohol cycle, not before.',
      ],
    },
    {
      h2: 'Worn potentiometers: the real drift',
      paragraphs: [
        'Conventional sticks measure position with a potentiometer — a resistive track a wiper rides on. Thousands of hours of movement wear the track, and the worn region reports voltage incorrectly at rest. Cleaning cannot restore a worn track. Your options: replace the stick module (repairable with soldering on most controllers, or without soldering on models with module sockets), use the manufacturer\u2019s repair service, or replace the controller.',
      ],
    },
    {
      h2: 'Hall-effect sticks and what they change',
      paragraphs: [
        'Hall-effect sticks measure position magnetically, with no physical wiper on a resistive track, so the wear mechanism that causes classic drift does not exist. Controllers such as the 8BitDo Ultimate 2C ship with them as standard, and aftermarket hall-effect modules exist for some popular controllers. The specification is meaningful: "drift-resistant" here is a mechanism claim, not a marketing one — the failure mode is simply absent. Our controller buying guide lists which models include them.',
      ],
    },
    {
      h2: 'Decision list',
      bullets: [
        'Drift disappears after recalibration → calibration debt; recalibrate whenever it returns.',
        'Drift reduces after cleaning but returns → debris; repeat the alcohol cycle and keep the controller in a case.',
        'Drift is constant, grows worse, and survives recalibration → worn potentiometer; module replacement or new controller.',
        'Buying new: prefer hall-effect sticks and a warranty — see the controller buying guide.',
      ],
    },
  ],
  faqs: [
    {
      q: 'Does the Neutral Check prove my controller has no drift?',
      a: 'It proves the resting offset stayed inside this tool\u2019s threshold during the check. Severe drift is obvious; marginal drift that only affects fine aiming needs your own in-game confirmation too.',
    },
    {
      q: 'Can firmware updates fix drift?',
      a: 'They can improve deadzone handling and calibration behavior, which masks mild drift. Hardware wear is not fixable in firmware.',
    },
    {
      q: 'Why does drift matter more in some games?',
      a: 'Games apply their own deadzones. A controller with small idle offset feels fine in games with generous deadzones and drifts visibly in aiming-heavy titles with tight ones.',
    },
  ],
};
