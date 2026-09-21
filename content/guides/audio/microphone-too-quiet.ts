import { GuideArticle } from '../schema';

export const microphoneTooQuiet: GuideArticle = {
  slug: 'microphone-too-quiet',
  title: 'Microphone Too Quiet? How to Raise Your Input Level',
  description:
    'Why your voice records at a whisper-quiet level and how to fix it: input gain, mic distance, OS level sliders, app boost, and when a different microphone type is the real answer.',
  category: 'audio',
  type: 'troubleshooting',
  relatedToolSlugs: ['microphone-test', 'voice-recorder', 'tone-generator'],
  relatedGuideSlugs: ['microphone-not-working'],
  intro:
    'A quiet microphone is not always a broken one — it is usually a level problem. Input gain, physical distance, and automatic processing all interact, and one wrong setting can cost you 20 dB of volume. This guide walks through every level that matters, from the microphone capsule to the conferencing app.',
  published: true,
  publishedAt: new Date('2026-08-14'),
  updatedAt: new Date('2026-09-15'),
  hasAffiliateLinks: false,
  sections: [
    {
      h2: 'Measure the problem first',
      paragraphs: [
        'Open the Microphone Test and watch the relative input level while you speak at your normal call volume. Note three things: how high the meter peaks, whether the level is consistently low or only occasionally quiet, and whether the waveform looks tiny or simply silent between words. Consistently tiny waveforms point to gain and distance; occasional dropouts point to processing (noise suppression) or a poor connection.',
      ],
    },
    {
      h2: 'Set the operating-system input level',
      paragraphs: [
        'This is the single most common fix. Both Windows and macOS expose an input level slider per device, and it frequently resets after OS updates or when a USB device re-enumerates.',
      ],
      steps: [
        'Windows: Settings → System → Sound → Input → select your device → set Input volume to 75–100 as a starting point and speak into the "Test your microphone" bar.',
        'macOS: System Settings → Sound → Input → select the device and drag the Input volume slider while watching the level meter.',
        'Re-run the online test after each change and compare the meter behavior.',
        'Advanced (Windows): Control Panel → Sound → Recording → device Properties → Levels tab. If a "Microphone Boost" slider exists, try +10 dB — but stop if it introduces hiss.',
      ],
    },
    {
      h2: 'Fix distance and direction',
      paragraphs: [
        'Sound level falls off quickly with distance — doubling your distance to the microphone roughly halves the level. Direction matters just as much for directional microphones.',
      ],
      bullets: [
        'Speak 10–20 cm from a headset or USB microphone, slightly off-axis to reduce plosives.',
        'Point the microphone\u2019s designated side at your mouth. Many USB mics record from the front only; speaking into the back produces a quiet, hollow signal.',
        'If you must sit further away, raise the gain and consider a mic with a wider pickup pattern rather than maxing software boost.',
      ],
    },
    {
      h2: 'Turn off the processing that fights you',
      paragraphs: [
        'Noise suppression and automatic gain control can clamp a quiet voice. In the browser, chrome://settings/content/microphone has no gain control but conferencing apps do: check Zoom\u2019s "Automatically adjust microphone volume", Teams\u2019 noise suppression levels, and Discord\u2019s automatic input sensitivity. Disable each temporarily while testing to see who is clamping your level.',
      ],
    },
    {
      h2: 'When the microphone type is the real problem',
      paragraphs: [
        'Condenser USB microphones expect to be close and are sensitive, but some budget laptop arrays are simply weak. Dynamic microphones (like the Samson Q2U in XLR or USB mode) need more gain but reject room noise far better. If you have maxed OS gain at distance and still sound distant and quiet, the hardware may genuinely be mismatched to the room — see our meeting-microphone buying guide for selection criteria rather than boosting your way past a bad setup.',
      ],
    },
    {
      h2: 'What not to do',
      bullets: [
        'Do not stack boosters: OS boost + app gain + software amplification multiplies hiss.',
        'Do not rely on "loudness equalization" effects for calls; they pump and distort.',
        'Do not judge final quality from laptop speakers — verify with headphones or the speaker test.',
      ],
    },
  ],
  faqs: [
    {
      q: 'Does the meter in the mic test show decibels?',
      a: 'No. It shows a relative input level driven by browser input gain — it is not a calibrated SPL meter. Use it to compare before/after changes, not to quote absolute numbers.',
    },
    {
      q: 'Why am I quiet only in one app?',
      a: 'That app is likely applying its own gain management or selecting a different input device. Check its audio settings and its own permission in OS privacy settings.',
    },
    {
      q: 'Is Microphone Boost safe to enable?',
      a: 'It is a digital/analog gain stage that amplifies noise as well as voice. Enable +10 dB first, test, and revert if you hear constant hiss.',
    },
  ],
};
