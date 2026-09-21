import { GuideArticle } from '../schema';

export const microphonesForMeetings: GuideArticle = {
  slug: 'microphones-for-meetings',
  title: 'Buying Guide: Microphones for Video Meetings',
  description:
    'How to choose a meeting microphone by pickup pattern, connection type, and room treatment — with specification-based picks for desk setups, untreated rooms, and travel kits.',
  category: 'audio',
  type: 'buying',
  relatedToolSlugs: ['microphone-test', 'voice-recorder'],
  relatedGuideSlugs: ['microphone-too-quiet', 'microphone-not-working'],
  intro:
    'A meeting microphone has one job: make your voice arrive clearly with the least friction. The specifications that matter are unglamorous — pickup pattern, connection, and how the microphone behaves in an untreated room — and they predict call quality far better than brand or price. Everything below is selected on published specifications and intended use, not on hands-on lab testing; we link the manufacturer pages so you can verify every claim.',
  published: true,
  publishedAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-15'),
  hasAffiliateLinks: false,
  sections: [
    {
      h2: 'What actually matters for calls',
      bullets: [
        'Pickup pattern: cardioid (front-facing) suits solo speakers in ordinary rooms; omni patterns pick up the whole room — wrong for shared offices.',
        'Dynamic vs condenser: dynamics reject room noise and need you close; condensers capture more detail and more keyboard, fan, and echo.',
        'Monitoring: a built-in headphone jack with zero-latency monitoring lets you hear exactly what colleagues hear.',
        'Connection: USB is plug-and-play; XLR matters only if a mixer or audio interface already sits on your desk.',
      ],
    },
    {
      h2: 'Specification-based picks',
      productIds: ['mic-samson-q2u', 'mic-blue-yeti', 'mic-jlab-talk-go'],
      productNotes: {
        'mic-samson-q2u':
          'The dynamic capsule and dual USB/XLR output make it the flexible default for untreated rooms — close-mic your voice, skip the room noise, and keep the XLR path open if your setup grows into a mixer.',
        'mic-blue-yeti':
          'Choose the Yeti when you also record or stream and want pattern flexibility and onboard controls; expect it to reward a treated corner and punish a loud shared office.',
        'mic-jlab-talk-go':
          'The travel pick: a compact cardioid USB-C mic that earns its place in a laptop bag when hotel rooms and meeting booths need predictable voice pickup.',
      },
    },
    {
      h2: 'Compatibility and setup facts',
      bullets: [
        'All three connect as standard USB audio devices — no drivers on current Windows and macOS versions.',
        'Position 10–20 cm from your mouth, slightly off-axis; distance is the single biggest quality lever.',
        'Q2U includes a desktop tripod and windscreen; the Yeti needs a stable desk or boom arm (its own weight suits booms well); the Talk GO sits flat with a tilting base.',
      ],
    },
    {
      h2: 'Trade-offs to accept',
      paragraphs: [
        'Every USB microphone here trades something: the Q2U needs to sit close and lacks pattern options, the Yeti is large and picks up more room in condenser mode, and the Talk GO gives up monitoring and pattern control for portability. None is a studio microphone, and none needs to be — the goal is that colleagues hear you clearly, which is a room-and-technique outcome as much as a hardware one.',
      ],
    },
  ],
  faqs: [
    {
      q: 'Do I need an XLR microphone for calls?',
      a: 'No. XLR adds a mixer or interface to the chain and helps only when you already own that gear. A good USB microphone connected directly is the simpler, equally clear path for meetings.',
    },
    {
      q: 'Is a more expensive microphone automatically clearer?',
      a: 'No. Pickup pattern fit, distance, and room noise dominate call clarity. A well-positioned budget dynamic microphone routinely beats an expensive condenser in a bare room.',
    },
    {
      q: 'How do I verify a new microphone works before a big meeting?',
      a: 'Run the Microphone Test: watch the level meter respond, record a short sample in the Recorder tab, and play it back through the Speaker Test to hear what others will hear.',
    },
  ],
};
