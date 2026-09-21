/**
 * Speaker channel-observation model — extracted from SpeakersTester so the
 * per-channel confirmation semantics are regression-testable.
 *
 * Core rule: a user confirmation is only valid for a channel that was
 * ACTUALLY REQUESTED AND PLAYED in this session. The aggregate verdict only
 * counts channels the user really tested; an untested channel never silently
 * counts as passed.
 */

export type SpeakerChannel = 'left' | 'right' | 'both';

/** Channels (in a usable display order) the user has actually played so far. */
export type PlayedChannels = SpeakerChannel[];

export interface SpeakerVerdict {
  status: 'passed' | 'warning' | 'inconclusive';
  details: string;
  metrics: Record<string, unknown>;
}

/** Start a fresh observation record for one tester instance. */
export function createSpeakerObservation(): { played: PlayedChannels; confirmed: SpeakerChannel[] } {
  return { played: [], confirmed: [] };
}

/** Record that a tone was requested and started for `channel`. */
export function markPlayed(obs: { played: PlayedChannels }, channel: SpeakerChannel): void {
  if (!obs.played.includes(channel)) {
    obs.played.push(channel);
  }
}

/**
 * The user confirms hearing `channel`. Returns false when the confirmation is
 * invalid because that channel was never actually played in this session —
 * the UI must not record it.
 */
export function confirmChannel(
  obs: { played: PlayedChannels; confirmed: SpeakerChannel[] },
  channel: SpeakerChannel
): boolean {
  if (!obs.played.includes(channel)) {
    return false;
  }
  if (!obs.confirmed.includes(channel)) {
    obs.confirmed.push(channel);
  }
  return true;
}

/**
 * Map the raw observation to a rich verdict:
 * - 'both' confirmed → passed (stereo path verified end-to-end).
 * - A single side channel confirmed (left or right) without 'both' →
 *   warning: that channel works, but stereo separation was not fully
 *   verified, and the untested channels are explicitly listed.
 * - Nothing confirmed → inconclusive: a working AudioContext/oscillator is
 *   NOT proof that the user heard sound.
 */
export function aggregateSpeakerVerdict(
  obs: { played: PlayedChannels; confirmed: SpeakerChannel[] },
  fallbackLabel = 'the audio output'
): SpeakerVerdict {
  if (obs.confirmed.includes('both')) {
    return {
      status: 'passed',
      details: 'User confirmed audible tone on both channels (center/stereo playback).',
      metrics: { confirmedChannels: 'both', channelsPlayed: obs.played.join(',') },
    };
  }

  if (obs.confirmed.includes('left') || obs.confirmed.includes('right')) {
    const confirmedSides = obs.confirmed.filter((c) => c === 'left' || c === 'right');
    const label = confirmedSides.map((c) => `${c} channel`).join(' and ');
    const untested = (['left', 'right'] as const).filter(
      (side) => !obs.played.includes(side) && !obs.confirmed.includes(side)
    );
    const untestedNote =
      untested.length > 0
        ? ` Untested channels not counted: ${untested.join(', ')}.`
        : '';
    return {
      status: 'warning',
      details: `User confirmed audible tone on the ${label} only. Stereo separation not fully verified.${untestedNote}`,
      metrics: {
        confirmedChannels: confirmedSides.join(','),
        channelsPlayed: obs.played.join(','),
      },
    };
  }

  return {
    status: 'inconclusive',
    details: `No audible-output confirmation recorded for ${fallbackLabel} yet. A playing tone alone is not proof the sound was heard.`,
    metrics: { channelsPlayed: obs.played.join(',') },
  };
}
