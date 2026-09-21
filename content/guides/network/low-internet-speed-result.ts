import { GuideArticle } from '../schema';

export const lowInternetSpeedResult: GuideArticle = {
  slug: 'low-internet-speed-result',
  title: 'Understanding an Unexpectedly Low Internet Speed Test Result',
  description:
    'Why real speed tests return less than your plan promises: Wi-Fi physics, shared bandwidth, latency, provider routing, and a method for finding where your throughput actually disappears.',
  category: 'network',
  type: 'how-to',
  relatedToolSlugs: ['internet-speed-test', 'what-is-my-ip'],
  relatedGuideSlugs: [],
  intro:
    'You pay for 500 Mbps and the test says 90. Before calling your provider, it helps to know that a speed test measures one path, at one moment, over the exact hardware chain in front of it — and that chain includes your Wi-Fi, your router, every device sharing your connection, and the route to the measurement server. Most disappointing results are explained by one of the factors below.',
  published: true,
  publishedAt: new Date('2026-08-25'),
  updatedAt: new Date('2026-09-15'),
  hasAffiliateLinks: false,
  sections: [
    {
      h2: 'What the test actually measures',
      paragraphs: [
        'A browser speed test opens parallel transfers to a measurement endpoint and times the data. The result is the throughput of the full path: your device → Wi-Fi → router → modem → your provider\u2019s network → the measurement network. The advertised plan number describes only the provider-side segment. The test is honest about its own slice: it measures your connection to the selected measurement network at that moment, not a universal rating of your line.',
      ],
    },
    {
      h2: 'Wi-Fi is the usual culprit',
      bullets: [
        'Distance and walls cost real throughput: two rooms and a wall can halve a strong signal.',
        'The 2.4 GHz band is slower and congested; 5 GHz (or 6 GHz where supported) is dramatically faster at short range.',
        'Old routers cap the ceiling: a Wi-Fi 4 router cannot deliver gigabit-class speeds no matter what the plan says.',
        'Other devices steal bandwidth — a TV streaming in another room is invisible to you but obvious to the test.',
        'Test on cable first: an Ethernet connection to the router is the true baseline. If cable shows the full plan speed, the deficit belongs to Wi-Fi, not the provider.',
      ],
    },
    {
      h2: 'Reading the three numbers together',
      paragraphs: [
        'Download, upload, and latency tell different stories. High download with high latency (busy ping) suggests buffer congestion — often from uploads saturating the line or an overloaded router queue. Low upload is normal on many plans (asymmetric by design), but extremely low upload with okay download can indicate signal problems upstream. Jitter (variation in latency) matters more than its absolute value for calls and gaming: a 20 ms connection with high jitter feels worse than a stable 40 ms one.',
      ],
    },
    {
      h2: 'Ruling out your own devices',
      steps: [
        'Pause cloud backups, system updates, and downloads on every device in the house.',
        'Run the test once on Ethernet, once on Wi-Fi from the same room as the router, once from the problem location.',
        'Compare the three numbers: the difference between them is the Wi-Fi or distance penalty.',
        'Reboot the router if results vary wildly between runs — some consumer routers degrade under memory pressure.',
        'Repeat at a different time of day: neighborhood congestion on shared infrastructure is real, especially on cable networks in the evening.',
      ],
    },
    {
      h2: 'When the provider is actually at fault',
      paragraphs: [
        'After eliminating Wi-Fi and your own devices, persistent shortfalls with cable-connected tests at all hours are worth reporting. Keep evidence: screenshots of results, times of day, and the fact that Ethernet was used. Providers can run their own line diagnostics, fix signal issues at the street cabinet, or provision a different profile. Note that changing plan speed does not help if the router is the bottleneck — upgrade the router first when the plan already exceeds what it can deliver.',
      ],
    },
    {
      h2: 'Common myths, briefly',
      bullets: [
        'A single test is not a verdict: one run at a congested hour proves little; three runs at different times do.',
        'Higher plan ≠ faster browsing: most web pages are latency-bound, not bandwidth-bound.',
        'The test cannot measure "internet health": there is no such single number — throughput, latency, jitter, and loss describe different failures.',
        'VPN routes distort everything: a VPN test measures the VPN path; disconnect it before baseline testing.',
      ],
    },
  ],
  faqs: [
    {
      q: 'Why do I get different results on different speed test sites?',
      a: 'Each site measures your path to its own network, with its own server locations and methods. Differences of 10–20% are normal; wildly different numbers usually mean a routing or peering difference.',
    },
    {
      q: 'Is latency here the same as ping in games?',
      a: 'It is HTTP round-trip timing to the measurement endpoint, not ICMP ping. Game latency adds server-side and routing factors the test cannot see, but the two correlate.',
    },
    {
      q: 'My result varies every run. Which number is real?',
      a: 'The median of several runs in comparable conditions is the meaningful one. Single outliers in either direction are measurement noise or transient congestion.',
    },
    {
      q: 'Does the speed test use my mobile data?',
      a: 'Yes — it transfers real data in both directions. On metered or mobile connections, run it sparingly or skip it.',
    },
  ],
};
