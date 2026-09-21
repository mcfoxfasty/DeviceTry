import { GuideArticle } from '../schema';

export const oneHeadphoneSideNotWorking: GuideArticle = {
  slug: 'one-headphone-side-not-working',
  title: 'One Headphone or Speaker Side Not Working: Fixes That Actually Work',
  description:
    'Diagnose audio playing in only one ear or speaker: channel tests, balance settings, connector faults, Bluetooth mono modes, and how to tell a cable problem from a driver failure.',
  category: 'audio',
  type: 'troubleshooting',
  relatedToolSlugs: ['speakers-test', 'tone-generator', 'internet-speed-test'],
  relatedGuideSlugs: ['microphone-not-working'],
  intro:
    'When sound comes out of only one side of your headphones or speakers, the fault sits somewhere on a short chain: the audio source, the OS balance setting, the connector, the cable, or the driver inside the earcup. Each link fails in a characteristic way, and a two-minute channel test tells you which link to suspect.',
  published: true,
  publishedAt: new Date('2026-08-14'),
  updatedAt: new Date('2026-09-15'),
  hasAffiliateLinks: false,
  sections: [
    {
      h2: 'Start with a hard channel test',
      paragraphs: [
        'Play the dedicated left-channel and right-channel tones in the Speaker & Headphone Test and note exactly what you hear in each ear. Three outcomes are possible, and each has a different meaning: only one side ever sounds (hard failure), both sides sound but one is quieter (balance or wiring fault), or both sound but only during some content (a mono/stereo profile issue).',
      ],
    },
    {
      h2: 'Check OS balance first — it is free',
      paragraphs: [
        'A left/right balance slider that drifted to one side is the most common and most overlooked cause. Accessibility settings sometimes move it accidentally.',
      ],
      steps: [
        'Windows: Settings → System → Sound → Volume mixer, or Control Panel → Sound → Playback → device Properties → Levels → Balance. Both sliders should sit at their center values.',
        'macOS: System Settings → Sound → Output → Balance slider centered.',
        'Also check any audio-enhancement or "spatial audio" panels that expose their own balance controls.',
      ],
    },
    {
      h2: 'Rule out the source: try another device',
      paragraphs: [
        'Plug the headphones into a phone, another computer, or a music player and replay a known stereo track. If both sides work elsewhere, your computer\u2019s jack, DAC, or settings are at fault — not the headphones. If the same side stays silent on every device, the headphones themselves have failed, almost always at the cable or connector rather than both drivers at once.',
      ],
    },
    {
      h2: 'The connector and cable failure pattern',
      bullets: [
        'Wiggle the plug gently at the jack while audio plays: crackling or a side popping back in means a broken solder joint at the plug.',
        'Move the cable in a slow S-shape along its length; a dead spot that crackles locates an internal break.',
        '3.5 mm plugs with three black rings (TRRS) can fail to seat fully in older jacks — pull the plug out one millimeter and retest; if both sides return, the jack\u2019s switch contacts are worn.',
        'Detachable-cable headphones: swap the cable before condemning the headphones.',
        'Bluetooth headsets: mono "hands-free" mode used for calls collapses stereo to one channel; in music mode both channels should return.',
      ],
    },
    {
      h2: 'When it is the speaker or driver itself',
      paragraphs: [
        'If a balanced source, centered balance slider, and known-good cable still leave one side silent, the driver or its internal wiring has failed. On earbuds this is usually a broken strand where the cable meets the earpiece. On wired desktop speakers, test each satellite on the same output and swap left/right: a side that stays dead regardless of channel has an internal fault. Repair is rarely economical on budget hardware; warranty replacement is the practical route.',
      ],
    },
    {
      h2: 'Software still suspect? Two quick exclusions',
      bullets: [
        'Test in a different browser and a different app. If both sides work there, an app-level audio effect or extension is mixing to mono — check extension audio features and OS "mono audio" accessibility toggle.',
        'Windows: run the playback-device troubleshooter (Settings → System → Sound → your device → Troubleshoot) which resets common endpoint issues.',
      ],
    },
  ],
  faqs: [
    {
      q: 'Why do both sides work in music but not in calls?',
      a: 'Call apps switch headsets to the hands-free profile, which is mono by design. Both channels collapse into one. That is profile behavior, not a hardware fault.',
    },
    {
      q: 'My left ear is quieter, not dead. What does that mean?',
      a: 'Quieter-but-present points to balance settings, earwax or debris in a mesh filter, or a partially broken cable strand. Clean the grille, check balance, then wiggle-test the cable.',
    },
    {
      q: 'Can a software update cause one-sided audio?',
      a: 'OS audio updates can reset device enhancements or re-detect endpoints. Re-check the balance slider after any update — it is the most frequently reset control.',
    },
  ],
};
