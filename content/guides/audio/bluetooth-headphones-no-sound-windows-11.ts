import { GuideArticle } from '../schema';

/**
 * A2DP / HFP endpoint and codec facts in this file come from
 * https://learn.microsoft.com/en-us/windows-hardware/drivers/bluetooth/bluetooth-classic-audio
 * and the microphone-active format control from
 * https://support.microsoft.com/en-us/windows/hardware/bluetooth/configuring-bluetooth-le-audio-quality-settings-on-windows-11
 *
 * Both are cited INLINE beside the sentence they support, through `proseLinks`,
 * rather than collected into a Sources block: a bibliography is read once at
 * most, and a list at the foot of a section reads as "these links cover
 * everything above" — the vagueness that lets a claim drift away from its
 * evidence. tests/proseLinks.test.ts fails the build if a declared phrase
 * cannot be placed unambiguously in its paragraph.
 *
 * The article deliberately makes NO claim about how often each cause occurs.
 * It has no measurements, so it orders the checks by how cheap they are to
 * reverse and says so, and every check names what it cannot establish.
 */

export const bluetoothHeadphonesNoSoundWindows11: GuideArticle = {
  slug: 'bluetooth-headphones-no-sound-windows-11',
  title: 'Bluetooth Headphones Connected but No Sound on Windows 11',
  description:
    'Windows 11 shows your Bluetooth headphones connected but silent. Check the output device and volume mixer first, then work through format, pairing, and drivers.',
  category: 'audio',
  type: 'troubleshooting',
  relatedToolSlugs: ['speakers-test', 'tone-generator', 'microphone-test'],
  relatedGuideSlugs: ['one-headphone-side-not-working'],
  showToc: true,
  intro:
    'When Windows 11 reports your Bluetooth headphones as connected and you hear nothing, the first thing to stop trusting is the word "connected". It describes the Bluetooth link. It does not describe which output device Windows is playing through, whether the application you are in has muted itself, or whether an app opened the microphone and moved playback to a lower-bandwidth profile. This guide starts with the three checks that cost about a minute, and only then explains the profile model behind them, because that model is what the later steps actually act on. Every check here also states what it cannot tell you: none of them identifies a failed component.',
  published: true,
  publishedAt: new Date('2026-09-30'),
  updatedAt: new Date('2026-10-08'),
  hasAffiliateLinks: false,
  featuredImage: {
    src: '/guides/bluetooth-headphones-no-sound-windows-11-hero',
    width: 1672,
    height: 941,
    kind: 'photo',
    alt: 'Black over-ear headphones on a desk beside an open laptop with a blue wallpaper.',
  },
  sections: [
    {
      h2: 'Step 1 — confirm the computer is producing audio at all',
      paragraphs: [
        'Before changing anything about Bluetooth, establish a baseline. Play a sound through the laptop’s own speakers. If the built-in speakers are silent too, this is not a Bluetooth problem, and none of the steps below will help.',
        'A continuous tone is more useful than a media file here, because it keeps playing while you move the volume or switch outputs without looping back to the start.',
        'If the built-in speakers are silent as well, run the audio troubleshooter in the Get Help app before you go any further. Windows ships troubleshooters for the audio and the Bluetooth stacks, and the audio one is the right tool for a machine that produces no sound at all.',
      ],
      steps: [
        'Play a test tone through the built-in speakers and listen. Note whether you hear anything at all.',
        'If the built-in speakers are silent, stop here and use the audio troubleshooter — this is a system audio fault, not a Bluetooth fault.',
        'If the built-in speakers work, the fault is downstream of them. Continue to step 2.',
        'Keep the tone playing through the remaining steps rather than switching to a music file. It makes an output that is present but wrong far easier to notice.',
      ],
      stepLinks: [
        {
          stepIndex: 0,
          label: 'Open the Speaker & Headphone Test',
          href: '/test/speakers-test',
          note: 'Sends a 440 Hz tone to the left, right, and centre channels one at a time, so you can also catch a fault where only one side is silent.',
        },
        {
          stepIndex: 3,
          label: 'Open the Tone Generator',
          href: '/test/tone-generator',
          note: 'A continuous tone you can leave running while you change the output device, instead of restarting a track each time.',
        },
      ],
      proseLinks: [
        {
          field: 'paragraph',
          index: 2,
          text: 'the audio troubleshooter in the Get Help app',
          href: 'https://support.microsoft.com/en-us/support/get-help/windows-troubleshooters',
        },
      ],
    },
    {
      h2: 'Step 2 — check the volume mixer, and test the app you were in',
      paragraphs: [
        'Windows keeps a separate volume and mute state per application, so a single app can be completely silent while every other app, and every other test tone, plays normally. The fault this finds looks exactly like a Bluetooth fault from the outside, which is why it is worth doing before anything else.',
        'Keep the two sound dialogs apart, because they show different things. The Volume mixer in Settings is per application: one row per app, plus a row for the device. The classic Sound dialog you open with mmsys.cpl is per device: the level, the mute state, and the enhancements for each endpoint Windows has created. An app can be muted in the first while the device is perfectly healthy in the second, and a left-on effect on the Enhancements tab is a real and easily missed cause of distorted or missing output.',
        'What this step cannot do: it will not reveal a fault that is not an application-level mute or an effect. If every application is unmuted and the device level is up, the mixer has nothing left to tell you, and you should move on rather than keep adjusting it.',
      ],
      steps: [
        'Select Start → Settings → System → Sound, then scroll to Volume mixer.',
        'Check the level for the application you were actually hearing nothing in, and reset any row showing a muted speaker icon.',
        'Check the device row for your Bluetooth headphones too, and confirm it is not muted there either.',
        'Run mmsys.cpl, open your device in the Playback tab, then Properties → Enhancements, and untick any effect that is enabled.',
        'Replay audio from that application itself, rather than from a test tool, so you are testing the thing that was silent.',
        'If that application now plays, the fault was the mixer. If it is still silent while another app plays, the fault is downstream and step 3 is next.',
      ],
    },
    {
      h2: 'Step 3 — confirm the output device, and that it is enabled',
      paragraphs: [
        'Windows does not always move the output device when a Bluetooth headset connects, so audio can keep going to the built-in speakers or to a monitor. That is the version of this symptom worth checking first, because it is the cheapest thing in the list to change: the headphones say connected, the volume icon shows them selected, and the sound still comes out of the laptop.',
        'Check that the device is not simply disabled. A disabled device still appears in the list with its normal name, which makes it easy to leave selected and wonder why nothing happens.',
        'The quick sound panel only lists devices it currently considers active, so confirm the selection on the full settings page rather than trusting the panel.',
      ],
      steps: [
        'Select Start → Settings → System → Sound.',
        'Under "Choose your output device", select your Bluetooth headphones. If they are absent from this list entirely, Windows has not created an output endpoint for them — go to step 6.',
        'Run mmsys.cpl, select the Playback tab, and confirm your device is neither disabled nor muted there. Windows stores the enabled state in this dialog, separately from the selection in Settings.',
        'Leave the test tone running and confirm you hear it in the headphones rather than the laptop speakers.',
      ],
    },
    {
      h2: 'What Windows 11 is deciding behind those settings',
      paragraphs: [
        'If all three checks above passed, the fault is further along, and the next thing to know is what Windows is doing with the headset. This is also where advice written for Windows 10 will send you looking for a control Windows 11 does not have.',
        'In Windows 10, pairing a Bluetooth Classic headset could create separate "Stereo" and "Hands-Free" entries, and picking the wrong one produced a familiar dead end. In Windows 11 those endpoints are unified: a device that supports the Hands-Free Profile gets a single output and a single input endpoint, and a device that only supports A2DP gets an output endpoint alone. So on Windows 11 you are not choosing between two competing entries for one headset. Microsoft’s Bluetooth Classic audio documentation describes both models.',
        'Windows selects the profile on your behalf. Playback uses A2DP — the high-quality stereo profile — as the default, and switches to the Hands-Free Profile when an application opens the microphone endpoint or creates a playback stream in the Communications category. In all other cases playback stays on A2DP. Windows resamples audio to suit whichever profile is active, and returns to A2DP when the microphone closes.',
        'A2DP carries output only: capturing from the microphone always uses HFP, which is mono in both directions. The profile switch is therefore a change in what you hear, not normally a switch to silence. If a headset is genuinely silent while a call is open, the profile change is not by itself an explanation — look instead at a format the headset cannot produce, a disabled endpoint, or a headset that has not reconnected at all. If the microphone is silent on this machine too, follow the microphone troubleshooting guide instead: that is a different fault with a different first step.',
        'If you are on Windows 10, or you genuinely see two separate entries, the older split applies and that is worth knowing. Treat it as a Windows 10 behaviour, not as the normal Windows 11 interface.',
      ],
      image: {
        src: '/guides/bluetooth-headphones-no-sound-windows-11-profile',
        width: 640,
        height: 464,
        kind: 'diagram',
        alt: 'Diagram. Scoped to a Bluetooth Classic headset that supports the Hands-Free Profile. The title reads "One output, one input"; a bar below states Windows 11 creates one output and one input endpoint. A pill states Windows picks the profile and that switching is automatic. Two cards: A2DP, when neither trigger fires — no app opens the microphone and no Communications-category stream — giving stereo, high quality; and the Hands-Free Profile, when either trigger fires — an app opens the microphone, or a Communications-category stream — giving mono, call grade. A note states Windows resamples audio to the active profile, and that Windows 10 created separate Stereo and Hands-Free entries.',
        caption:
          'Scoped to a Bluetooth Classic headset that supports the Hands-Free Profile: one output, one input, and Windows choosing the profile between them. The two-entry choice belongs to Windows 10.',
      },
      proseLinks: [
        {
          field: 'paragraph',
          index: 1,
          text: 'Microsoft’s Bluetooth Classic audio documentation',
          href: 'https://learn.microsoft.com/en-us/windows-hardware/drivers/bluetooth/bluetooth-classic-audio',
        },
        {
          field: 'paragraph',
          index: 3,
          text: 'the microphone troubleshooting guide',
          href: '/guides/microphone-not-working',
        },
      ],
    },
    {
      h2: 'Step 4 — check the settings that change the audio rather than routing it',
      paragraphs: [
        'Two Windows 11 settings alter the sound without touching the output route, and both can produce a result that reads as "no sound". Both are reversible in one click.',
        'The first is the system-wide mono audio toggle in Settings → Accessibility → Audio. When it is enabled, Windows shows a warning that stereo audio may not work correctly, and Microsoft’s own advice is to disable the toggle if you want stereo.',
        'The second applies only to Bluetooth LE Audio, and only on Windows 11 version 24H2 or newer with factory support for Bluetooth LE, the manufacturer’s drivers, and an LE Audio accessory. Under the device’s Output settings there is a "Format when microphone is active" control, set to Stereo (2 channels) by default. Where Windows defaults to stereo and the accessory loses audio or glitches, Microsoft documents switching it to Mono (1 channel) to improve compatibility.',
        'If the control is not there at all, that is informative rather than broken: it means the system does not support stereo playback while the microphone is active, and the documented behaviour in that case is mono audio while the microphone is in use — quieter, not silent. On a Classic connection the same microphone moment is a drop to the Hands-Free Profile, where Windows may negotiate narrowband (8 kHz) or wideband (16 kHz) speech, and some wideband-capable devices revert to narrowband on particular radios.',
        'The honest summary of this step: the microphone branch produces a quality change, not a loss of sound. If the sound is genuinely gone while a call is open, the format in step 5 is the next place to look.',
      ],
      steps: [
        'Select Start → Settings → Accessibility → Audio and check whether Mono audio is switched on. If stereo playback is expected, switch it off.',
        'Select Start → Settings → System → Sound and find your Bluetooth device under Output.',
        'If your device supports LE Audio, click the arrow to the right of it to open its settings, then expand Output settings.',
        'If "Format when microphone is active" is present, set it to Stereo (2 channels), or to Mono (1 channel) if the accessory loses audio or glitches while the microphone is active.',
        'Replay the test tone with the microphone idle, then again while a microphone-using application is open, and compare the two.',
      ],
      proseLinks: [
        {
          field: 'paragraph',
          index: 1,
          text: 'Microsoft’s own advice is to disable the toggle',
          href: 'https://support.microsoft.com/en-us/windows/hardware/bluetooth/configuring-bluetooth-le-audio-quality-settings-on-windows-11',
        },
        {
          field: 'paragraph',
          index: 2,
          text: 'Microsoft documents switching it to Mono (1 channel) to improve compatibility',
          href: 'https://support.microsoft.com/en-us/windows/hardware/bluetooth/configuring-bluetooth-le-audio-quality-settings-on-windows-11',
        },
      ],
    },
    {
      h2: 'Step 5 — reset the audio format',
      paragraphs: [
        'A selected device can stay silent if the format Windows negotiated is one the headset cannot produce. A mismatched channel count, bit depth, or sample rate is a real failure mode, and it survives every reconnect until the format is changed.',
        'Microsoft’s own fix for this symptom uses 2 channels, 16 bit, 48000 Hz (DVD Quality). Treat that as a documented starting point rather than a universal requirement: if the headset is still silent at it, try another of the formats the Advanced tab offers before moving on.',
        'This is the device’s default format, which is a different control from the microphone-active format in step 4. Note also that the advanced properties page only exists while the device is connected, so it will not be there with the headphones powered off.',
      ],
      steps: [
        'Select Start → Settings → Bluetooth & devices → Devices.',
        'Find your headphones and expand their entry.',
        'Select "Advanced sound properties". This option only appears while the device is connected.',
        'Under Output settings, set Format to 2 channels, 16 bit, 48000 Hz (DVD Quality).',
        'Apply, close, and replay the test tone.',
      ],
      proseLinks: [
        {
          field: 'paragraph',
          index: 1,
          text: 'Microsoft’s own fix for this symptom',
          href: 'https://support.microsoft.com/en-us/windows/hardware/bluetooth/fix-bluetooth-connected-but-no-sound-issue-on-windows',
        },
      ],
    },
    {
      h2: 'Step 6 — re-pair the device',
      paragraphs: [
        'If the device is listed but never becomes an output device, the pairing record is the next thing to discard. Microsoft documents removing the device and adding it again as the fix for a device that appears in the list but will not connect. Removing a device is reversible: it does not unpair the headset from your other machines, and re-adding it takes about a minute.',
        'Toggling the Bluetooth radio is the cheaper version of the same reset and is worth trying first, because it costs nothing and does not require you to find the device again.',
        'A constraint worth knowing before you blame the PC: many headsets hold only one active connection at a time. If the same headphones are paired to your phone, they may not accept a second active device, and Windows will show them as unavailable rather than as faulty.',
      ],
      steps: [
        'Toggle first: open Start → Settings → Bluetooth & devices, turn Bluetooth off, wait 10 seconds, turn it back on, and reconnect.',
        'If that did not help, select the device and choose More options (…) → Remove device.',
        'Confirm no other paired device is currently connected to the headset.',
        'Put the headset into pairing mode, then select Add device and pick it from the list.',
        'Once it reports Connected, re-check step 3: removing a device commonly resets the active output back to the built-in speakers.',
      ],
      proseLinks: [
        {
          field: 'paragraph',
          index: 0,
          text: 'removing the device and adding it again',
          href: 'https://support.microsoft.com/en-us/windows/hardware/bluetooth/fix-bluetooth-connected-but-no-sound-issue-on-windows',
        },
      ],
    },
    {
      h2: 'Step 7 — update the Bluetooth driver',
      paragraphs: [
        'This is the step for faults that survive everything above, and it deserves priority when the problem started after a Windows update or a new application install. A driver that has lost track of the audio endpoint can hold a valid pairing while failing to route sound through it.',
        'Laptop and desktop manufacturers frequently ship Bluetooth drivers newer than the ones Windows Update offers, so if the automatic search does not resolve it, the manufacturer’s support page for your exact model is the next place to look. Updating the Bluetooth driver is the documented step for a driver that has become incompatible, and it is the step Windows itself recommends for a machine that has just been upgraded.',
      ],
      steps: [
        'Select Start → Device Manager.',
        'Expand Bluetooth and select your adapter, which may include the word "radio" in its name.',
        'Right-click the adapter and select Update driver → Search automatically for updated driver software.',
        'Close the dialog and restart if prompted.',
        'Select Start → Settings → Windows Update, check for updates, restart, and retest with the tone from step 1.',
      ],
      proseLinks: [
        {
          field: 'paragraph',
          index: 1,
          text: 'Updating the Bluetooth driver is the documented step',
          href: 'https://support.microsoft.com/en-us/windows/hardware/bluetooth/update-bluetooth-drivers-in-windows',
        },
      ],
    },
    {
      h2: 'If it works after a restart but fails again after you reconnect',
      paragraphs: [
        'A restart that brings the sound back is easy to over-read. What a restart actually does is reload the radio driver, re-enumerate the adapter, and discard the cached endpoint state for the session. That is genuinely useful, and it is not a measurement of anything: it does not show that power management was involved, and it does not show which of those three things mattered.',
        'The symptom is still worth taking seriously, because a fault that returns on every new connection is a fault in the connection or in the driver rather than in a setting you have already visited. Work the toggle at the start of step 6, then re-check the output selection in step 3 after reconnecting, because re-pairing commonly leaves the output back on the built-in speakers.',
        'There is one related checkbox worth a single change. In Device Manager, your adapter’s Properties → Power Management tab holds "Allow the computer to turn off this device to save power", where that tab is present at all. Unchecking it is a one-click experiment. It is not proof of anything either way, and if the sound does not change you have learned very little — but it is cheap, it is reversible, and it is the setting people most often blame on evidence they do not have.',
      ],
      steps: [
        'Toggle the Bluetooth radio off, wait 10 seconds, and back on, then reconnect the headset.',
        'After it reconnects, re-check the output device in step 3 before assuming anything is still wrong.',
        'If it fails again on every new connection, go to step 7 and the driver, and note the timing for the next section.',
      ],
    },
    {
      h2: 'If it works on your phone but not on this PC',
      paragraphs: [
        'Playing on a phone is useful evidence: it shows the headset produced sound somewhere, under some configuration. It does not clear the accessory and it does not identify the fault here. Pairing state, the host’s codec list, the profile Windows selects, the output selection, and the mono audio toggle are all different on the two machines.',
        'So treat it as a boundary rather than an answer. The search stays on this PC, and steps 1 to 7 are still worth running in order. What is worth carrying across is the configuration, not the verdict: if the phone was playing music while this PC is silent only in a call, the hands-free profile is where to look; if the phone was playing music and this PC is silent for music too, start at step 3.',
        'If the microphone works on the phone and not on this PC, that is a different fault again, and the microphone troubleshooting guide starts at the right place.',
      ],
      bullets: [
        'The two hosts do not necessarily share a codec list. Windows picks the first A2DP codec both sides support, so a codec the headset prefers may simply not be offered on this machine.',
        'A phone may never open the microphone endpoint, so playback stays on A2DP and never reaches the hands-free profile that this PC switches into.',
        'The mono audio toggle, the output selection, and a disabled endpoint are all per-machine state. None of them travels with the headset.',
        'Interference and distance differ between a desk and a room, and an intermittent fault can pass a single test on either machine.',
      ],
      proseLinks: [
        {
          field: 'paragraph',
          index: 2,
          text: 'the microphone troubleshooting guide',
          href: '/guides/microphone-not-working',
        },
      ],
    },
    {
      h2: 'If it started after a Windows, driver, or firmware update',
      paragraphs: [
        'Timing is a lead, not a cause. A fault that begins the day after an update is worth investigating because an update is the largest single change in the system, not because the update is now known to be responsible.',
        'So investigate the change rather than undoing it. Find out which update arrived: Settings → Windows Update → Update history, or Reliability Monitor for a dated list of what changed and when. Read its release notes, then check your PC manufacturer’s support page for the same period, which is where a Bluetooth regression on a specific model gets named. Compare the driver version in Device Manager → your adapter → Properties → Driver, and do the same for BIOS or UEFI firmware, because a firmware change can alter the radio’s own firmware and the manufacturer’s release notes are the authority on that.',
        'If the fault began with a driver update, a driver rollback is the small, targeted action: Device Manager → your adapter → Properties → Driver → Roll Back Driver restores the previously installed version, and it is reversible. Removing the Windows update is a different and much larger step, and it is not the one this evidence points at. The update may be carrying the fix for this fault, and undoing a security or quality update on the strength of a date is a real cost paid for a guess. Investigate the update, the driver, and any documented issue first, and roll back the specific component that actually changed.',
      ],
      steps: [
        'Open Settings → Windows Update → Update history and find the update that arrived just before the fault started.',
        'Read its release notes, and search your PC manufacturer’s support page for the model and that date.',
        'In Device Manager, note the driver version for your Bluetooth adapter under Properties → Driver.',
        'If the fault began with a driver update, use Roll Back Driver on that same tab, then retest with the tone from step 1.',
        'Check whether a BIOS or UEFI firmware update is outstanding for your model and read its notes before applying it. Leave the Windows update in place until the evidence points somewhere else.',
      ],
    },
    {
      h2: 'Match your symptom to the check',
      paragraphs: [
        'This table is ordered by how cheap each fix is to reverse, not by how likely the cause is. This article has no measurement of how often each cause occurs and does not claim one.',
      ],
      table: {
        columns: ['What you observe', 'Where to look first', 'Limit of that check'],
        rows: [
          [
            'Nothing plays anywhere, Bluetooth or built-in',
            'Step 1, then the audio troubleshooter',
            'Establishes only that the fault is not specific to the headset',
          ],
          [
            'One application is silent, others play',
            'Step 2, the volume mixer',
            'Will not detect a fault that is not an application-level mute or effect',
          ],
          [
            'Built-in speakers play, headphones silent',
            'Step 3, output device selection and enabled state',
            'Cannot see devices Windows has not created an endpoint for',
          ],
          [
            'Sound flattens or gets quieter when the microphone opens',
            'Step 4, mono audio and the microphone-active format',
            'The documented behaviour there is a quality change, not silence',
          ],
          [
            'Sound is fine until something is played at a new format',
            'Step 5, then step 7 for the driver',
            'Format changes address negotiation, not a stalled driver',
          ],
          [
            'Headset is absent from the output list entirely',
            'Step 6, re-pairing',
            'Does not resolve a fault in the adapter driver itself',
          ],
          [
            'Works after a restart, fails again on the next connection',
            'The restart branch above, then step 7',
            'A restart reloads state; it does not identify which part mattered',
          ],
          [
            'Plays on a phone, silent on this PC',
            'The phone-versus-PC branch, then steps 1 to 7',
            'Rules nothing out on its own; it only bounds where to look',
          ],
          [
            'Started right after an update, driver, or firmware change',
            'The update branch above',
            'Timing points at where to investigate, not at what to remove',
          ],
        ],
        caption:
          'Each row names what the check can and cannot establish. None of them, alone, identifies a failed component.',
      },
      image: {
        src: '/guides/bluetooth-headphones-no-sound-windows-11-audio-path',
        width: 640,
        height: 470,
        kind: 'diagram',
        alt: 'Diagram. A four-stage chain from the playing application to the headphones: the application, the Windows output device, the Bluetooth profile, and the headphones themselves. The headphone stage is the only one marked connected; the other three are marked as places the chain can break while the device still reports as connected.',
        caption:
          'The three stages before the headphones are the ones a reader can still change from Windows settings. A link that reports as connected is evidence about the last stage, and none about the three before it.',
      },
    },
    {
      h2: 'Bluetooth Classic and LE Audio are not the same thing',
      paragraphs: [
        'Windows 11 supports two different Bluetooth audio technologies, and conflating them produces a lot of contradictory advice.',
        'Bluetooth Classic audio streams over the classic radio: A2DP for high-quality stereo playback, and the Hands-Free Profile for mono playback and mono capture. This is what most headphones use, and it is what steps 1 to 7 above are about. A2DP output requires SBC support on both ends, and Windows 11 also supports AAC from version 21H2, aptX Classic from 21H2, and aptX Adaptive (lossless) from version 24H2 on select devices with compatible Qualcomm radios, choosing the first codec both the host and the headset support. The codec and version tables are in Microsoft’s Bluetooth Classic audio documentation.',
        'Bluetooth LE Audio streams over the low-power LE radio. It is a separate path with separate requirements: factory support for Bluetooth LE in the PC, manufacturer drivers, and an accessory that supports LE Audio. Where it is supported it improves the quality available while the microphone is in use. The stereo-while-mic-active control needs more than that — Windows 11 version 24H2 or newer and a recent build — which is why it is missing on machines that are otherwise LE-capable. Microsoft’s LE Audio page lists the compatibility requirements and what to do when the control does not appear.',
        'The practical consequence is that a setting, a menu, or a fix described for one of these will often simply not exist on the other. If a step in this article refers to a control you cannot find, that is more likely a compatibility boundary than a mistake in the step.',
      ],
      proseLinks: [
        {
          field: 'paragraph',
          index: 1,
          text: 'Microsoft’s Bluetooth Classic audio documentation',
          href: 'https://learn.microsoft.com/en-us/windows-hardware/drivers/bluetooth/bluetooth-classic-audio',
        },
        {
          field: 'paragraph',
          index: 2,
          text: 'Microsoft’s LE Audio page',
          href: 'https://support.microsoft.com/en-us/windows/hardware/bluetooth/configuring-bluetooth-le-audio-quality-settings-on-windows-11',
        },
      ],
    },
    {
      h2: 'What these checks cannot tell you',
      paragraphs: [
        'It is worth being blunt about the limits, because most misleading advice on this topic comes from presenting a partial result as a diagnosis.',
        'Testing the same headset on a second machine is useful evidence — it shows the headset produced sound on that machine under that configuration. It does not certify the hardware. A fault that depends on pairing state, on the headset’s own volume, on interference, or on which device it is simultaneously connected to can appear on one machine and not another, and an intermittent fault can pass a single test.',
        'None of the checks above can tell you that a component has failed. They can tell you where a setting, a format, or a mute is standing in the way, and they can rule those out. They cannot rule in a hardware fault, and a headset that is silent on two different computers is evidence worth acting on — but the conclusion to draw is that the manufacturer’s support process is the right next step, not a diagnosis this article can make for you.',
        'One adjacent fault deserves its own article rather than a paragraph here: if both channels are selected and only one side ever sounds, the chain has failed somewhere other than output routing, and the guide to one-sided audio starts at the right place.',
        'For that reason there is no headset factory-reset routine here. Reset procedures are model-specific: the button combination, how long to hold it, and what the indicator lights mean all differ between manufacturers, and a wrong sequence can erase pairing data without fixing anything. Your headset’s own documentation is the authority for its reset, and most manufacturers also provide a direct support channel for a headset that will not produce sound.',
        'For the same reason there is no advice here about reinstalling Windows. Nothing in the checks above points at an install that needs replacing, and a reinstall is a large, destructive step to take on the strength of a symptom this guide cannot attribute to the operating system.',
      ],
      proseLinks: [
        {
          field: 'paragraph',
          index: 3,
          text: 'the guide to one-sided audio',
          href: '/guides/one-headphone-side-not-working',
        },
      ],
    },
    {
      h2: 'When to escalate',
      paragraphs: [
        'If the headset produces sound on another machine, every check above is clean, and the fault persists, the remaining possibilities are a fault in this machine’s Bluetooth stack or an accessory fault. Both are worth taking to someone who can see the machine rather than continuing to change settings.',
        'Gathering these before you contact anyone saves a round trip: the exact headset model, the Windows build, whether the fault followed an update, and what the audio endpoint list looks like.',
      ],
      steps: [
        'Run the Bluetooth troubleshooter in the Get Help app and note exactly what it reports.',
        'Check Event Viewer for Bluetooth or audio service errors, which usually name the component that failed. Search Windows Logs → System for Bluetooth or audio sources around the time the fault began.',
        'Confirm the Bluetooth Support Service is set to start automatically and is not disabled, in services.msc.',
        'Contact the PC manufacturer with your model number if the fault is suspected to be in the machine’s Bluetooth hardware or driver stack.',
        'Contact the headset manufacturer with the model if the headset is silent on more than one computer, and use their documented reset procedure if one exists for your model.',
      ],
    },
  ],
  faqs: [
    {
      q: 'I see both "Stereo" and "Hands-Free" entries for my headset. Is that the cause?',
      a: 'On Windows 10, yes — pairing a Bluetooth Classic headset could create separate Stereo and Hands-Free endpoints, and selecting the wrong one caused exactly this symptom. On Windows 11 those endpoints are unified into a single output and input for devices that support the Hands-Free Profile, so seeing two competing entries is a Windows 10 behaviour rather than the normal Windows 11 interface. If you are on Windows 10 and see both, confirm which one is selected in the output list.',
    },
    {
      q: 'Does the Hands-Free Profile stop sound from playing?',
      a: 'It changes the quality rather than normally stopping playback. Windows uses A2DP for playback by default and switches to the Hands-Free Profile when an application opens the microphone or uses the Communications category, resampling audio to suit. The result is mono, lower-bandwidth audio — and a resampling or format mismatch on top of that is what can turn a quality change into silence. That mismatch is what step 5 checks for.',
    },
    {
      q: 'My headphones stop playing sound when the microphone turns on. Why?',
      a: 'Separate the two possibilities, because they have different answers. Dropping to a lower-quality profile when the microphone opens is expected: on Bluetooth Classic audio, A2DP output ends and Windows switches to the Hands-Free Profile, which is mono call-grade audio, resampled to match. Where Bluetooth LE Audio is supported on Windows 11 version 24H2 or newer, a "Format when microphone is active" control sets whether that state is stereo or mono. Complete silence is not normal profile behaviour — a profile change makes sound narrower and quieter, not absent. If nothing plays while a call is open, work step 4 and then step 5: that points at a format the headset cannot produce, a disabled endpoint, or a headset that has not reconnected.',
    },
    {
      q: 'Why is the sound still coming from my laptop speakers when the headphones say connected?',
      a: 'Connecting a headset does not always move the output device, and the quick sound panel only lists devices it considers active, so a device can be connected while the output still points at the built-in speakers or a monitor. Select the headphones under Settings → System → Sound → Choose your output device, and check in mmsys.cpl that the device is neither disabled nor muted there. Windows stores the enabled state in that dialog, separately from the selection in Settings, so a device can be selected and still produce nothing.',
    },
    {
      q: 'A restart fixes it, but it fails again after I reconnect. What does that tell me?',
      a: 'Less than it appears to. A restart reloads the radio driver, re-enumerates the adapter, and discards the cached endpoint state for the session; it does not identify which of those mattered, and it is not evidence about power management. A fault that returns on every new connection points at the connection or the driver rather than at a setting you have already visited, so toggle the Bluetooth radio, re-check the output selection after reconnecting, and then update the driver.',
    },
    {
      q: 'It works on my other computer. Does that prove the hardware is fine?',
      a: 'No. It shows the headset produced sound on that machine under that configuration, which is useful evidence and rules out some possibilities. It does not certify the hardware: a fault that depends on pairing state, the headset’s own volume, interference, or a second connected device can appear on one machine and not another. Treat it as evidence, not a diagnosis.',
    },
    {
      q: 'Should I uninstall the Windows update that arrived just before this started?',
      a: 'Not on the strength of the timing alone, and not as a first move. Use Update history to identify the update, read its release notes, and check your PC manufacturer’s support page for your model and that date; a documented issue may already have a fix or a newer driver. If the fault began with a driver update, a driver rollback from Device Manager → Properties → Driver is the small, reversible action that actually targets the component that changed.',
    },
    {
      q: 'Should I reinstall Windows or reset my headset to factory defaults?',
      a: 'This guide does not recommend either. Nothing in the steps above points at an operating system install that needs replacing, so a reinstall is a large destructive step to take on a symptom like this. Headset reset procedures are model-specific — the button combination, hold duration, and indicator behaviour all differ — so use your headset’s own documentation rather than a generic routine. If the headset is silent on more than one computer, that is a signal to use the manufacturer’s support process.',
    },
    {
      q: 'The volume mixer is not muted. What now?',
      a: 'That check only rules out an application-level mute and a left-on enhancement, which is all it can do. Move on to the output device selection in step 3, then the audio format in step 5. Repeatedly adjusting the mixer after it is unmuted will not tell you anything new.',
    },
  ],
};
