/**
 * Local WebRTC loopback — the real protocol, extracted from the component so
 * it can be regression-tested with fake peers.
 *
 * WHAT THIS PROVES (and nothing more):
 *  - two RTCPeerConnections created with `iceServers: []` completed an
 *    offer/answer exchange and reached `connected` on the same page,
 *  - ICE candidates were gathered and accepted in both directions,
 *  - a data channel opened on BOTH peers, and five uniquely-identified ping
 *    messages were echoed back by the receiving peer.
 *
 * WHAT IT DOES NOT PROVE: microphone or camera capture, internet call
 * reachability, TURN/STUN availability across a network, or anything about
 * VPN/DNS privacy. The module never contacts a STUN or TURN server, never
 * touches media tracks, and never requests a permission.
 *
 * DESIGN NOTES — each of these is a bug class this file exists to prevent:
 *  - The receiving peer's `ondatachannel` handler is attached BEFORE the
 *    offer is created, so the echo receiver exists before negotiation.
 *  - Only FIVE UNIQUE, MATCHING replies complete the exchange. Duplicate
 *    echoes, replies to ids we never sent, and payloads that are not our
 *    ping protocol are counted and ignored, never rounded into a success.
 *  - Each round-trip is timed from ITS OWN send timestamp; the handshake time
 *    is measured separately and never folded into the round-trip figure.
 *  - ICE candidates that arrive before the remote description is set are
 *    BUFFERED and flushed afterwards (addIceCandidate rejects before then),
 *    and every rejection/gathering error is counted and surfaced.
 *  - `finish()` is idempotent and never rejects: a timeout settles the run
 *    through the same path as a failure, so an abandoned timeout can never
 *    produce an unhandled promise rejection.
 *  - `reset()`/`dispose()` invalidate the run token, so a callback belonging
 *    to an abandoned run can never update results, and every peer, channel,
 *    listener and timer is released on completion, failure, reset and unmount.
 */

export const REQUIRED_ECHOES = 5;
export const CHANNEL_LABEL = 'devicetry-ping';
/** Protocol version, echoed in every message so foreign payloads are ignored. */
const PROTOCOL = 'dt1';

/** Wall-clock budget for connection setup, and for the echo exchange. */
export const HANDSHAKE_TIMEOUT_MS = 8000;
export const ECHO_TIMEOUT_MS = 4000;

export interface DataChannelLike {
  label?: string;
  readyState?: string;
  send(data: string): void;
  close(): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
}

export interface PeerConnectionLike {
  connectionState?: string;
  iceConnectionState?: string;
  createDataChannel(label: string): DataChannelLike;
  createOffer(): Promise<unknown>;
  createAnswer(): Promise<unknown>;
  setLocalDescription(description: unknown): Promise<void>;
  setRemoteDescription(description: unknown): Promise<void>;
  addIceCandidate(candidate: unknown): Promise<void>;
  close(): void;
  onicecandidate: ((event: { candidate: { type?: string } | null }) => void) | null;
  onicecandidateerror?: ((event: { errorCode?: number; errorText?: string }) => void) | null;
  onconnectionstatechange: (() => void) | null;
  ondatachannel?: ((event: { channel: DataChannelLike }) => void) | null;
}

/**
 * Metrics for the shared banner, and from there local history, rerun
 * comparison and every export.
 *
 * A measurement that could not be taken is OMITTED, never coerced to 0. A run
 * that fails before connecting has no handshake time, and recording
 * `handshakeMs: 0` would put a number that was never measured into the
 * comparison store — where the next genuine run is then compared against it,
 * producing a confident-looking delta out of nothing.
 *
 * The test is null/undefined/non-finite, not falsiness, so a genuinely
 * measured 0 (an instantaneous local connection) is kept.
 */
export function buildLoopbackMetrics(outcome: LoopbackOutcome): Record<string, number> {
  const metrics: Record<string, number> = {
    echoRepliesConfirmed: outcome.echoesReceived,
    iceCandidateAddErrors: outcome.iceCandidateAddErrors,
  };
  if (typeof outcome.handshakeMs === 'number' && Number.isFinite(outcome.handshakeMs)) {
    metrics.handshakeMs = outcome.handshakeMs;
  }
  if (typeof outcome.rttMs === 'number' && Number.isFinite(outcome.rttMs)) {
    metrics.echoRttMs = outcome.rttMs;
  }
  return metrics;
}

export interface LoopbackStep {
  label: string;
  ok: boolean;
  detail?: string;
}

export interface LoopbackOutcome {
  steps: LoopbackStep[];
  /** Time to reach `connected`, measured separately from any round-trip. */
  handshakeMs: number | null;
  /** Median of the per-message round trips, or null when nothing came back. */
  rttMs: number | null;
  rttSamplesMs: number[];
  candidateTypes: string[];
  /** True when the peer connection reached "connected" before finishing. */
  connected: boolean;
  /** Distinct, correctly matched echoes — the only thing that counts. */
  echoesReceived: number;
  requiredEchoes: number;
  duplicatesIgnored: number;
  unrelatedIgnored: number;
  iceCandidateAddErrors: number;
  /** Populated when the run failed for a reason worth showing verbatim. */
  failure: string | null;
  ok: boolean;
}

/** Live progress for the UI; every field is an observation, never a verdict. */
export interface LoopbackSnapshot {
  running: boolean;
  echoesReceived: number;
  requiredEchoes: number;
  connected: boolean;
}

export interface LoopbackDeps {
  createPeerConnection: (config: { iceServers: RTCIceServer[] }) => PeerConnectionLike;
  now: () => number;
  setTimeout: (handler: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  /** Overridable for tests; production always uses the exported constants. */
  handshakeTimeoutMs?: number;
  echoTimeoutMs?: number;
}

export interface LoopbackCallbacks {
  onSnapshot?: (snapshot: LoopbackSnapshot) => void;
  onSettled?: (outcome: LoopbackOutcome) => void;
}

/** Median of a non-empty numeric list; null for an empty list (never 0). */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : Math.round(sorted[mid]);
}

function pingMessage(id: number): string {
  return `${PROTOCOL}|ping|${id}`;
}

function pongMessage(id: number): string {
  return `${PROTOCOL}|pong|${id}`;
}

/** Parse an inbound payload. Returns the echoed id, or null when the message is
 * not a well-formed reply to OUR protocol (a foreign payload, a binary frame,
 * or an id we never sent). */
export function parsePong(raw: unknown, sentIds: ReadonlySet<number>): number | null {
  if (typeof raw !== 'string') return null;
  const parts = raw.split('|');
  if (parts.length !== 3) return null;
  if (parts[0] !== PROTOCOL || parts[1] !== 'pong') return null;
  const id = Number(parts[2]);
  if (!Number.isInteger(id) || !sentIds.has(id)) return null;
  return id;
}

/** True when the payload is one of our pings awaiting an echo. */
export function parsePingId(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const parts = raw.split('|');
  if (parts.length !== 3) return null;
  if (parts[0] !== PROTOCOL || parts[1] !== 'ping') return null;
  const id = Number(parts[2]);
  return Number.isInteger(id) ? id : null;
}

export class WebRtcLoopback {
  /** Monotonic run token. Any callback captured by an older run is obsolete. */
  private run = 0;
  private settled = true;
  private pc1: PeerConnectionLike | null = null;
  private pc2: PeerConnectionLike | null = null;
  /** Sender channel (pc1 side). */
  private txChannel: DataChannelLike | null = null;
  /** Receiver channel (pc2 side) — the peer that actually echoes. */
  private rxChannel: DataChannelLike | null = null;
  private timers = new Set<unknown>();

  private steps: LoopbackStep[] = [];
  private candidateTypes = new Set<string>();
  private pendingCandidates: { from: 1 | 2; candidate: unknown }[] = [];
  private iceCandidateAddErrors = 0;
  private handshakeMs: number | null = null;
  private handshakeStartedAt: number | null = null;
  private echoes = 0;
  private echoedIds = new Set<number>();
  private duplicates = 0;
  private unrelated = 0;
  private samples: number[] = [];
  private sentAt = new Map<number, number>();
  private failure: string | null = null;
  private connected = false;
  private channelOpen = false;
  private pingsSent = false;
  private remoteDescriptionSet: Record<1 | 2, boolean> = { 1: false, 2: false };

  constructor(
    private readonly deps: LoopbackDeps,
    private readonly callbacks: LoopbackCallbacks = {}
  ) {}

  get isRunning(): boolean {
    return !this.settled;
  }

  start(): void {
    this.reset();
    const token = ++this.run;
    this.settled = false;
    this.steps = [];
    this.candidateTypes = new Set();
    this.pendingCandidates = [];
    this.iceCandidateAddErrors = 0;
    this.handshakeMs = null;
    this.handshakeStartedAt = null;
    this.echoes = 0;
    this.echoedIds = new Set();
    this.duplicates = 0;
    this.unrelated = 0;
    this.samples = [];
    this.sentAt = new Map();
    this.failure = null;
    this.connected = false;
    this.channelOpen = false;
    this.pingsSent = false;
    this.remoteDescriptionSet = { 1: false, 2: false };
    void this.execute(token);
  }

  /** Abort an in-flight run and release everything it owns. */
  reset(): void {
    this.run += 1; // every pending callback is now obsolete
    this.settled = true;
    this.teardown();
  }

  /** Unmount cleanup: same teardown, plus permanent invalidation. */
  dispose(): void {
    this.reset();
  }

  // -------------------------------------------------------------------------
  // internals
  // -------------------------------------------------------------------------

  /** True when the callback still belongs to the newest, unfinished run. */
  private live(token: number): boolean {
    return token === this.run && !this.settled;
  }

  private addStep(label: string, ok: boolean, detail?: string): void {
    this.steps.push({ label, ok, detail });
  }

  private arm(handler: () => void, ms: number): void {
    const handle = this.deps.setTimeout(() => {
      this.timers.delete(handle);
      handler();
    }, ms);
    this.timers.add(handle);
  }

  private snapshot(): void {
    this.callbacks.onSnapshot?.({
      running: !this.settled,
      echoesReceived: this.echoes,
      requiredEchoes: REQUIRED_ECHOES,
      connected: this.connected,
    });
  }

  /**
   * Release every resource this run owns: both peers, both channels, every
   * listener assignment and every timer. Idempotent.
   */
  private teardown(): void {
    for (const handle of this.timers) this.deps.clearTimeout(handle);
    this.timers.clear();

    for (const channel of [this.txChannel, this.rxChannel]) {
      if (!channel) continue;
      channel.onopen = null;
      channel.onmessage = null;
      channel.onerror = null;
      channel.onclose = null;
      try {
        channel.close();
      } catch {
        /* a channel that refuses to close is released anyway */
      }
    }
    this.txChannel = null;
    this.rxChannel = null;

    for (const pc of [this.pc1, this.pc2]) {
      if (!pc) continue;
      pc.onicecandidate = null;
      if ('onicecandidateerror' in pc) pc.onicecandidateerror = null;
      pc.onconnectionstatechange = null;
      pc.ondatachannel = null;
      try {
        pc.close();
      } catch {
        /* ignore teardown errors */
      }
    }
    this.pc1 = null;
    this.pc2 = null;
    this.pendingCandidates = [];
    this.remoteDescriptionSet = { 1: false, 2: false };
  }

  /** Idempotent settlement — the ONLY path that reports an outcome. */
  private finish(token: number, failure: string | null, ok: boolean): void {
    if (!this.live(token)) return;
    this.settled = true;
    this.failure = failure;
    // Timers die before the outcome is reported so nothing can fire into a
    // finished run; listeners survive until teardown() below.
    for (const handle of this.timers) this.deps.clearTimeout(handle);
    this.timers.clear();

    const outcome: LoopbackOutcome = {
      steps: this.steps,
      handshakeMs: this.handshakeMs,
      rttMs: median(this.samples),
      rttSamplesMs: this.samples.map((v) => Math.round(v)),
      candidateTypes: Array.from(this.candidateTypes),
      connected: this.connected,
      echoesReceived: this.echoes,
      requiredEchoes: REQUIRED_ECHOES,
      duplicatesIgnored: this.duplicates,
      unrelatedIgnored: this.unrelated,
      iceCandidateAddErrors: this.iceCandidateAddErrors,
      failure,
      ok,
    };
    // Final progress line: the run is over, whatever the verdict is.
    this.snapshot();
    this.teardown();
    this.callbacks.onSettled?.(outcome);
  }

  /** Buffer-then-flush: addIceCandidate rejects before the remote description. */
  private async routeCandidate(from: 1 | 2, candidate: unknown): Promise<void> {
    const target = from === 1 ? this.pc2 : this.pc1;
    if (!target) return;
    if (!this.remoteDescriptionSet[from]) {
      this.pendingCandidates.push({ from, candidate });
      return;
    }
    try {
      await target.addIceCandidate(candidate);
    } catch {
      // Never swallowed: the count is surfaced in the ICE step detail.
      this.iceCandidateAddErrors += 1;
    }
  }

  private async flushPendingCandidates(): Promise<void> {
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const item of queued) {
      await this.routeCandidate(item.from, item.candidate);
    }
  }

  private wireIce(token: number, side: 1 | 2): void {
    const pc = side === 1 ? this.pc1 : this.pc2;
    if (!pc) return;
    pc.onicecandidate = (event) => {
      if (!this.live(token)) return;
      const candidate = event?.candidate;
      if (!candidate) return; // end-of-candidates marker
      if (candidate.type) this.candidateTypes.add(candidate.type);
      void this.routeCandidate(side, candidate);
    };
    if ('onicecandidateerror' in pc) {
      pc.onicecandidateerror = (event) => {
        if (!this.live(token)) return;
        this.iceCandidateAddErrors += 1;
        const code = event?.errorCode != null ? ` (code ${event.errorCode})` : '';
        this.addStep('ICE candidate gathering error', false, `${event?.errorText || 'gathering failed'}${code}`);
      };
    }
  }

  private iceSummary(): { ok: boolean; detail: string } {
    const types = Array.from(this.candidateTypes);
    if (types.length === 0) {
      return { ok: false, detail: 'No candidates were gathered, so the peers had nothing to connect over.' };
    }
    const suffix =
      this.iceCandidateAddErrors > 0 ? ` · ${this.iceCandidateAddErrors} candidate(s) rejected when added` : '';
    return { ok: true, detail: `${types.join(', ')}${suffix}` };
  }

  private async execute(token: number): Promise<void> {
    let pc1: PeerConnectionLike;
    let pc2: PeerConnectionLike;
    try {
      pc1 = this.deps.createPeerConnection({ iceServers: [] });
      pc2 = this.deps.createPeerConnection({ iceServers: [] });
    } catch (err) {
      this.finish(token, describeError(err, 'Could not create RTCPeerConnection'), false);
      return;
    }
    this.pc1 = pc1;
    this.pc2 = pc2;
    this.addStep('Two local peers created', true, 'iceServers: [] — no STUN or TURN server is contacted');

    this.wireIce(token, 1);
    this.wireIce(token, 2);

    this.arm(() => {
      this.finish(
        token,
        `Timed out after ${this.deps.handshakeTimeoutMs ?? HANDSHAKE_TIMEOUT_MS} ms waiting for the local connection to open.`,
        false
      );
    }, this.deps.handshakeTimeoutMs ?? HANDSHAKE_TIMEOUT_MS);

    pc2.onconnectionstatechange = () => {
      if (!this.live(token)) return;
      const state = pc2.connectionState;
      if (state === 'connected') {
        this.markConnected(token);
        return;
      }
      if (state === 'failed') {
        this.finish(
          token,
          `Peer connection reported state "failed" (ICE connection: ${pc2.iceConnectionState ?? 'unknown'}).`,
          false
        );
        return;
      }
      if (state === 'closed') {
        this.finish(token, 'Peer connection was closed before it connected.', false);
      }
    };

    // The receiver is attached BEFORE any negotiation happens, so the echo
    // handler is already in place when the channel is announced.
    pc2.ondatachannel = (event) => this.attachReceiver(token, event.channel);

    try {
      const dc = pc1.createDataChannel(CHANNEL_LABEL);
      this.txChannel = dc;
      this.attachSender(token, dc);

      const offer = await pc1.createOffer();
      if (!this.live(token)) return;
      await pc1.setLocalDescription(offer);
      if (!this.live(token)) return;
      await pc2.setRemoteDescription(offer);
      this.remoteDescriptionSet[2] = true;
      await this.flushPendingCandidates();
      if (!this.live(token)) return;

      const answer = await pc2.createAnswer();
      if (!this.live(token)) return;
      await pc2.setLocalDescription(answer);
      if (!this.live(token)) return;
      await pc1.setRemoteDescription(answer);
      this.remoteDescriptionSet[1] = true;
      await this.flushPendingCandidates();
      if (!this.live(token)) return;
      this.addStep('SDP offer/answer exchanged', true);
    } catch (err) {
      this.finish(token, describeError(err, 'SDP negotiation failed'), false);
      return;
    }

    this.awaitHandshake(token);
  }

  /**
   * Some engines never fire onconnectionstatechange for an already-connected
   * pair, so the observable state is polled as well. The poll stops on the
   * first connected state, and every tick is released by teardown().
   */
  private awaitHandshake(token: number): void {
    const poll = () => {
      if (!this.live(token)) return;
      if (this.pc2?.connectionState === 'connected') {
        this.markConnected(token);
        return;
      }
      this.arm(poll, 25);
    };
    this.arm(poll, 25);
  }

  private markConnected(token: number): void {
    if (!this.live(token) || this.connected) return;
    this.connected = true;
    if (this.handshakeStartedAt === null) this.handshakeStartedAt = this.deps.now();
    this.handshakeMs = Math.max(0, Math.round(this.deps.now() - this.handshakeStartedAt));
    this.addStep('Local loopback connection established', true, `${this.handshakeMs} ms to connected`);
    const ice = this.iceSummary();
    this.addStep('ICE candidates exchanged', ice.ok, ice.detail);
    this.snapshot();
    // Messages only count once the peers are actually connected, so the
    // exchange waits for BOTH the connection and the open channel.
    this.maybeSendPings(token);
  }

  private maybeSendPings(token: number): void {
    if (this.pingsSent || !this.connected || !this.channelOpen || !this.live(token)) return;
    const channel = this.txChannel;
    if (!channel) return;
    this.pingsSent = true;

    // Every ping carries its own send timestamp; each reply is timed from the
    // timestamp of THAT message, so one slow reply cannot distort the others.
    for (let id = 0; id < REQUIRED_ECHOES; id++) {
      if (!this.live(token)) return;
      this.sentAt.set(id, this.deps.now());
      try {
        channel.send(pingMessage(id));
      } catch {
        this.finish(token, `The data channel closed before ping ${id + 1} could be sent.`, false);
        return;
      }
    }

    this.arm(() => {
      this.settleEchoes(
        token,
        `Only ${this.echoes} of ${REQUIRED_ECHOES} echo replies arrived within ${this.deps.echoTimeoutMs ?? ECHO_TIMEOUT_MS} ms.`
      );
    }, this.deps.echoTimeoutMs ?? ECHO_TIMEOUT_MS);
  }

  private onReply(token: number, raw: unknown): void {
    if (!this.live(token)) return;
    const id = parsePong(raw, new Set(this.sentAt.keys()));
    if (id === null) {
      this.unrelated += 1; // foreign payload or an id we never sent
      return;
    }
    if (this.echoedIds.has(id)) {
      this.duplicates += 1; // a second reply for the same ping proves nothing
      return;
    }
    const sentAt = this.sentAt.get(id);
    if (sentAt === undefined) return;
    this.echoedIds.add(id);
    this.echoes += 1;
    this.samples.push(Math.max(0, this.deps.now() - sentAt));
    this.snapshot();
    if (this.echoes >= REQUIRED_ECHOES) this.settleEchoes(token, null);
  }

  private settleEchoes(token: number, failure: string | null): void {
    if (!this.live(token)) return;
    const complete = this.echoes >= REQUIRED_ECHOES;
    const ignored: string[] = [];
    if (this.duplicates > 0) ignored.push(`${this.duplicates} duplicate(s) ignored`);
    if (this.unrelated > 0) ignored.push(`${this.unrelated} unrelated message(s) ignored`);
    const detail = `${this.echoes}/${REQUIRED_ECHOES} unique echo replies confirmed${ignored.length ? ` · ${ignored.join(' · ')}` : ''}`;
    this.addStep('Echoed data messages received', complete, detail);
    this.finish(token, complete ? null : failure ?? `Only ${this.echoes} of ${REQUIRED_ECHOES} echo replies arrived.`, complete);
  }

  /** Attach the echo receiver handed to us by the remote peer. */
  private attachReceiver(token: number, channel: DataChannelLike): void {
    if (!this.live(token)) {
      try {
        channel.close();
      } catch {
        /* ignore */
      }
      return;
    }
    this.rxChannel = channel;
    channel.onmessage = (event) => {
      if (!this.live(token)) return;
      const id = parsePingId(event?.data);
      if (id === null) return; // not our protocol — never echoed, never counted
      try {
        channel.send(pongMessage(id));
      } catch {
        /* the channel closed mid-flight; the sender's timeout reports it */
      }
    };
    channel.onerror = () => undefined;
    channel.onclose = () => undefined;
  }

  private attachSender(token: number, channel: DataChannelLike): void {
    channel.onopen = () => {
      if (!this.live(token) || this.channelOpen) return;
      this.channelOpen = true;
      this.addStep('DataChannel opened on both peers', true, CHANNEL_LABEL);
      this.maybeSendPings(token);
    };
    channel.onerror = (event) => {
      if (!this.live(token)) return;
      const detail = describeEvent(event);
      this.finish(token, `The data channel reported an error${detail ? `: ${detail}` : '.'}`, false);
    };
    channel.onclose = () => {
      if (!this.live(token)) return;
      this.finish(token, 'The data channel closed before the exchange completed.', false);
    };
    channel.onmessage = (event) => {
      if (!this.live(token)) return;
      this.onReply(token, event?.data);
    };
  }
}

function describeError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return `${fallback}: ${err.message}`;
  if (typeof err === 'string' && err) return `${fallback}: ${err}`;
  return fallback;
}

function describeEvent(event: unknown): string {
  if (event && typeof event === 'object' && 'error' in event) {
    const inner = (event as { error?: unknown }).error;
    if (inner instanceof Error && inner.message) return inner.message;
  }
  return '';
}

/** Factory wired to the real browser globals. */
export function browserLoopbackDeps(): LoopbackDeps {
  return {
    createPeerConnection: (config) => new RTCPeerConnection(config) as unknown as PeerConnectionLike,
    now: () => performance.now(),
    setTimeout: (handler, ms) => setTimeout(handler, ms),
    clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  };
}
