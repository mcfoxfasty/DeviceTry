/**
 * WebRTC loopback regressions.
 *
 * These drive the REAL WebRtcLoopback class through a fake pair of peers, so
 * every protocol rule is exercised against the code the tester runs: the echo
 * receiver attached before negotiation, five unique matched replies, per-ping
 * timing, ICE candidate buffering, and full cleanup with stale callbacks
 * unable to report.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLoopbackMetrics,
  CHANNEL_LABEL,
  DataChannelLike,
  LoopbackOutcome,
  LoopbackSnapshot,
  PeerConnectionLike,
  REQUIRED_ECHOES,
  WebRtcLoopback,
  median,
  parsePong,
} from '../lib/testing/webrtcLoopback';

// ---------------------------------------------------------------------------
// Fake peers
// ---------------------------------------------------------------------------

type EchoMode = 'full' | 'partial' | 'none' | 'duplicates' | 'garbage' | 'throw-on-send';

class FakeChannel implements DataChannelLike {
  label = CHANNEL_LABEL;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  readonly sent: string[] = [];
  peer: FakeChannel | null = null;
  closed = false;

  /** How many more pings this channel will accept; null means unlimited. */
  echoBudget: number | null = null;
  /** Payloads the far end pushes at us unsolicited (junk / unknown ids). */
  extraDeliveries: string[] = [];
  /** Deliver every payload twice, so replies can arrive as duplicates. */
  duplicateInbound = false;

  constructor(private mode: EchoMode) {}

  /** A data channel delivers whatever was sent, verbatim, to the far side. */
  send(data: string): void {
    if (this.closed) return;
    this.sent.push(data);
    const peer = this.peer;
    if (!peer || peer.closed) return;
    if (this.mode === 'none') return;
    queueMicrotask(() => {
      // Unsolicited inbound payloads arrive once, regardless of what we sent.
      while (this.extraDeliveries.length > 0) {
        this.onmessage?.({ data: this.extraDeliveries.shift()! });
      }
      if (this.mode === 'garbage') {
        // The far side is fed a payload that is not our protocol at all.
        peer.onmessage?.({ data: 'not-our-protocol' });
        return;
      }
      // 'partial' models a channel that drops replies: the RECEIVING side
      // stops answering after its budget, which is what the sender observes.
      if (peer.echoBudget !== null && peer.echoBudget <= 0) return;
      if (peer.echoBudget !== null) peer.echoBudget -= 1;
      peer.onmessage?.({ data });
      // A duplicated inbound message makes the receiver echo the same id twice.
      if (peer.duplicateInbound) peer.onmessage?.({ data });
    });
  }

  close(): void {
    this.closed = true;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
  }
}

/**
 * Fake peer. The two sides of the data channel are SEPARATE objects, exactly
 * as a real engine hands pc2 its own channel through ondatachannel — sharing
 * one object would silently make the sender its own echo receiver.
 */
class FakePeer implements PeerConnectionLike {
  connectionState = 'new';
  iceConnectionState = 'new';
  onicecandidate: ((event: { candidate: { type?: string } | null }) => void) | null = null;
  onicecandidateerror: ((event: { errorCode?: number; errorText?: string }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  ondatachannel: ((event: { channel: DataChannelLike }) => void) | null = null;
  readonly addedCandidates: unknown[] = [];
  channel: FakeChannel | null = null;
  closed = false;

  constructor(
    private mode: EchoMode,
    private pair: { sender: FakePeer | null; receiver: FakePeer | null },
    private failAddCandidate: boolean
  ) {}

  createDataChannel(): DataChannelLike {
    const senderChannel = new FakeChannel(this.mode);
    if (this.mode === 'duplicates') {
      // One reply arrives for an id that was never sent.
      senderChannel.extraDeliveries = ['dt1|pong|999'];
    }
    if (this.mode === 'garbage') {
      // Unsolicited junk from the wire: one unknown id and one foreign payload.
      senderChannel.extraDeliveries = ['dt1|pong|4242', 'not-our-protocol'];
    }
    this.channel = senderChannel;
    const receiver = this.pair.receiver;
    if (receiver) queueMicrotask(() => receiver.announceChannel(senderChannel));
    return senderChannel;
  }

  /** pc2 side: build its own channel object and hand it to ondatachannel. */
  announceChannel(senderChannel: FakeChannel): void {
    if (this.closed) return;
    const receiverChannel = new FakeChannel(this.mode);
    // The receiver answers twice for every ping, which is what produces
    // duplicate replies at the sender.
    if (this.mode === 'duplicates') receiverChannel.duplicateInbound = true;
    if (this.mode === 'partial') receiverChannel.echoBudget = 2;
    // 'garbage' models a channel that carries no usable reply at all.
    if (this.mode === 'garbage') receiverChannel.echoBudget = 0;
    senderChannel.peer = receiverChannel;
    receiverChannel.peer = senderChannel;
    this.channel = receiverChannel;
    this.ondatachannel?.({ channel: receiverChannel });
    senderChannel.onopen?.({});
  }

  async createOffer() {
    return { type: 'offer', sdp: 'v=0' };
  }
  async createAnswer() {
    return { type: 'answer', sdp: 'v=0' };
  }
  async setLocalDescription() {
    /* no-op */
  }
  async setRemoteDescription() {
    /* no-op */
  }
  async addIceCandidate(candidate: unknown) {
    if (this.failAddCandidate) throw new Error('candidate rejected by fake peer');
    this.addedCandidates.push(candidate);
  }
  close() {
    this.closed = true;
    this.connectionState = 'closed';
    this.onicecandidate = null;
    this.onicecandidateerror = null;
    this.onconnectionstatechange = null;
    this.ondatachannel = null;
    this.channel?.close();
  }

  emitCandidate(type = 'host') {
    this.onicecandidate?.({ candidate: { type } });
  }

  connect() {
    this.connectionState = 'connected';
    this.iceConnectionState = 'connected';
    this.onconnectionstatechange?.();
  }
}

interface Harness {
  loop: WebRtcLoopback;
  outcomes: LoopbackOutcome[];
  snapshots: LoopbackSnapshot[];
  readonly peers: { sender: FakePeer; receiver: FakePeer };
  liveTimers: () => number;
  advance: (ms: number) => void;
}

function harness(
  options: {
    mode?: EchoMode;
    failAddCandidate?: boolean;
    autoConnect?: boolean;
    emitCandidates?: boolean;
    handshakeTimeoutMs?: number;
    echoTimeoutMs?: number;
    /** Freeze the clock so every measured duration is genuinely 0. */
    frozenClock?: boolean;
  } = {}
): Harness {
  const mode = options.mode ?? 'full';
  const pending = new Map<number, { at: number; handler: () => void }>();
  let clock = 0;
  let timerId = 0;
  let created: { sender: FakePeer; receiver: FakePeer } | null = null;

  // ONE pair is built and handed out: pc1 first, then pc2. Creating a fresh
  // pair per call would leave the module's two peers wired to different fakes.
  let peerIndex = 0;
  const createPeerConnection = () => {
    if (!created) {
      const pair: { sender: FakePeer | null; receiver: FakePeer | null } = { sender: null, receiver: null };
      const make = () => new FakePeer(mode, pair, options.failAddCandidate ?? false);
      const sender = make();
      const receiver = make();
      pair.sender = sender;
      pair.receiver = receiver;
      created = { sender, receiver };
      // Candidates are emitted immediately — i.e. BEFORE any remote description
      // exists, which is exactly the ordering the module has to buffer for.
      if (options.emitCandidates) {
        queueMicrotask(() => {
          sender.emitCandidate('host');
          receiver.emitCandidate('srflx');
        });
      }
    }
    peerIndex += 1;
    return peerIndex === 1 ? created.sender : created.receiver;
  };

  const deps = {
    createPeerConnection,
    now: () => (options.frozenClock ? 0 : clock),
    setTimeout: (handler: () => void, ms: number) => {
      const id = ++timerId;
      pending.set(id, { at: clock + ms, handler });
      return id;
    },
    clearTimeout: (handle: unknown) => {
      pending.delete(handle as number);
    },
    handshakeTimeoutMs: options.handshakeTimeoutMs ?? 200,
    echoTimeoutMs: options.echoTimeoutMs ?? 60,
  };

  const outcomes: LoopbackOutcome[] = [];
  const snapshots: LoopbackSnapshot[] = [];
  const loop = new WebRtcLoopback(deps, {
    onSnapshot: (snapshot) => snapshots.push(snapshot),
    onSettled: (outcome) => outcomes.push(outcome),
  });

  /** The connection comes up on the fake clock, as a real one eventually would. */
  const advance = (ms: number) => {
    clock += ms;
    if (options.autoConnect !== false && created) {
      const { sender, receiver } = created;
      if (sender.connectionState === 'new') sender.connect();
      if (receiver.connectionState === 'new') receiver.connect();
    }
    for (const [id, entry] of Array.from(pending.entries())) {
      if (entry.at <= clock) {
        pending.delete(id);
        entry.handler();
      }
    }
  };

  return {
    loop,
    outcomes,
    snapshots,
    get peers() {
      return created!;
    },
    liveTimers: () => pending.size,
    advance,
  };
}

/** Flush microtasks, then advance the fake clock until the run settles. */
async function settle(h: Harness, steps = 80, msPerStep = 20): Promise<LoopbackOutcome | null> {
  for (let i = 0; i < steps; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    h.advance(msPerStep);
    await new Promise((resolve) => setImmediate(resolve));
    if (h.outcomes.length > 0) return h.outcomes[0];
  }
  return h.outcomes[0] ?? null;
}

// ---------------------------------------------------------------------------
// Protocol helpers
// ---------------------------------------------------------------------------

test('webrtc loopback - parsePong only accepts a well-formed reply to a sent id', () => {
  const sent = new Set([0, 1]);
  assert.equal(parsePong('dt1|pong|1', sent), 1);
  assert.equal(parsePong('dt1|pong|9', sent), null, 'an id we never sent is not a match');
  assert.equal(parsePong('dt1|ping|1', sent), null, 'a ping is not a reply');
  assert.equal(parsePong('other|pong|1', sent), null, 'another protocol is ignored');
  assert.equal(parsePong(new ArrayBuffer(4), sent), null, 'a binary frame is ignored');
  assert.equal(parsePong('dt1|pong|1|extra', sent), null);
});

test('webrtc loopback - median returns null for no samples, never zero', () => {
  assert.equal(median([]), null);
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([4, 1, 3, 2]), 3);
});

// ---------------------------------------------------------------------------
// The loopback itself
// ---------------------------------------------------------------------------

test('webrtc loopback - five matched echoes complete the exchange', async () => {
  const h = harness({ mode: 'full' });
  h.loop.start();
  const outcome = await settle(h);

  assert.ok(outcome, 'the run must settle');
  assert.equal(outcome.ok, true);
  assert.equal(outcome.echoesReceived, REQUIRED_ECHOES);
  assert.equal(outcome.failure, null);
  assert.equal(outcome.duplicatesIgnored, 0);
  assert.equal(outcome.unrelatedIgnored, 0);
  assert.ok(outcome.handshakeMs !== null, 'the handshake is measured separately');
  assert.ok(outcome.rttMs !== null, 'a round trip exists when replies arrived');
  // Every ping must have been sent exactly once, with a unique id.
  const sentPings = h.peers.sender.channel!.sent;
  assert.equal(sentPings.length, REQUIRED_ECHOES);
  assert.equal(new Set(sentPings).size, REQUIRED_ECHOES);
  assert.deepEqual([...sentPings].sort(), [0, 1, 2, 3, 4].map((id) => `dt1|ping|${id}`).sort());
});

test('webrtc loopback - duplicate and unrelated replies never inflate the count', async () => {
  const h = harness({ mode: 'duplicates' });
  h.loop.start();
  const outcome = await settle(h);

  assert.ok(outcome);
  // The receiver answers twice for every ping, and one reply names an id that
  // was never sent. Only the five unique, matched replies may count.
  assert.equal(outcome.echoesReceived, REQUIRED_ECHOES, 'duplicates must not raise the count above the distinct replies');
  // The run settles on the fifth unique reply, so the last repeat necessarily
  // lands after teardown — every repeat seen before that is counted.
  assert.equal(outcome.duplicatesIgnored, REQUIRED_ECHOES - 1, 'every repeat received before completion is ignored');
  assert.equal(outcome.unrelatedIgnored, 1, 'the single reply to an id we never sent is ignored');
  assert.equal(outcome.ok, true);
  const step = outcome.steps.find((s) => s.label === 'Echoed data messages received');
  assert.match(String(step?.detail), /duplicate\(s\) ignored/);
  assert.match(String(step?.detail), /unrelated message\(s\) ignored/);
});

test('webrtc loopback - a channel that only carries junk can never report success', async () => {
  const h = harness({ mode: 'duplicates', echoTimeoutMs: 30 });
  h.loop.start();
  // Force the "junk only" variant: the receiver drops every ping, so the extra
  // deliveries are the only traffic the sender ever sees.
  await new Promise((resolve) => setImmediate(resolve));
  h.peers.sender.channel!.extraDeliveries = ['dt1|pong|4242', 'not-our-protocol'];
  h.peers.receiver.channel!.echoBudget = 0;
  const outcome = await settle(h);

  assert.ok(outcome);
  assert.equal(outcome.echoesReceived, 0);
  assert.ok(outcome.unrelatedIgnored > 0);
  assert.equal(outcome.ok, false);
});

test('webrtc loopback - unrelated payloads are counted, not accepted', async () => {
  const h = harness({ mode: 'garbage' });
  h.loop.start();
  const outcome = await settle(h);

  assert.ok(outcome);
  assert.equal(outcome.echoesReceived, 0, 'junk never counts as an echo');
  assert.equal(outcome.unrelatedIgnored, 2, 'both junk payloads are counted, not accepted');
  assert.equal(outcome.ok, false);
  assert.equal(outcome.rttMs, null, 'no valid replies means no round-trip figure at all');
});

test('webrtc loopback - zero replies settles as incomplete, not as a pass', async () => {
  const h = harness({ mode: 'none' });
  h.loop.start();
  const outcome = await settle(h);

  assert.ok(outcome);
  assert.equal(outcome.ok, false);
  assert.equal(outcome.echoesReceived, 0);
  assert.equal(outcome.rttMs, null);
  assert.match(String(outcome.failure), /0 of 5 echo replies/i);
  // The connection did complete, so the reason names the exchange, not the link.
  assert.ok(outcome.connected);
});

test('webrtc loopback - a partial exchange reports how many replies actually came back', async () => {
  const h = harness({ mode: 'partial' });
  h.loop.start();
  const outcome = await settle(h);

  assert.ok(outcome);
  assert.equal(outcome.ok, false);
  assert.equal(outcome.echoesReceived, 2);
  assert.match(String(outcome.failure), /2 of 5/);
});

test('webrtc loopback - a failed connection reports the state instead of swallowing it', async () => {
  const h = harness({ autoConnect: false });
  h.loop.start();
  await new Promise((resolve) => setImmediate(resolve));
  h.peers.receiver.connectionState = 'failed';
  h.peers.receiver.iceConnectionState = 'checking';
  h.peers.receiver.onconnectionstatechange?.();

  const outcome = await settle(h);
  assert.ok(outcome);
  assert.equal(outcome.ok, false);
  assert.match(String(outcome.failure), /state "failed"/i);
  assert.match(String(outcome.failure), /ICE connection: checking/i);
});

// ---------------------------------------------------------------------------
// Metrics policy: an unavailable measurement is absent, never a zero
// ---------------------------------------------------------------------------

test('webrtc metrics - a failure before connection records no handshake time at all', async () => {
  const h = harness({ autoConnect: false });
  h.loop.start();
  await new Promise((resolve) => setImmediate(resolve));
  h.peers.receiver.connectionState = 'failed';
  h.peers.receiver.iceConnectionState = 'checking';
  h.peers.receiver.onconnectionstatechange?.();
  const outcome = await settle(h);

  assert.ok(outcome);
  assert.equal(outcome.handshakeMs, null, 'the run never connected, so no handshake was measured');
  const metrics = buildLoopbackMetrics(outcome);
  // This is the defect this pins: the card renders no handshake measurement,
  // but `handshakeMs: 0` used to reach the banner, local history, the rerun
  // comparison store and every export.
  assert.equal('handshakeMs' in metrics, false, 'a handshake that never happened must not be recorded as 0');
  assert.equal('echoRttMs' in metrics, false, 'no replies means no round trip to record');
  assert.equal(metrics.echoRepliesConfirmed, 0);
  assert.equal(metrics.iceCandidateAddErrors, 0);
});

test('webrtc metrics - a run that connected but got no echoes keeps the handshake and drops the RTT', async () => {
  const h = harness({ mode: 'none' });
  h.loop.start();
  const outcome = await settle(h);

  assert.ok(outcome);
  assert.equal(outcome.handshakeMs !== null, true, 'the connection did reach connected');
  assert.equal(outcome.rttMs, null, 'no reply means no round trip');
  const metrics = buildLoopbackMetrics(outcome);
  assert.equal(typeof metrics.handshakeMs, 'number');
  assert.equal('echoRttMs' in metrics, false);
});

test('webrtc metrics - a genuinely measured zero handshake is kept, not treated as missing', async () => {
  const h = harness({ mode: 'full', frozenClock: true });
  h.loop.start();
  const outcome = await settle(h);

  assert.ok(outcome);
  assert.equal(outcome.handshakeMs, 0, 'an instantaneous local connection really can measure 0 ms');
  const metrics = buildLoopbackMetrics(outcome);
  assert.equal('handshakeMs' in metrics, true, 'a measured 0 must survive: the test is null, not falsiness');
  assert.equal(metrics.handshakeMs, 0);
  assert.equal(typeof metrics.echoRttMs, 'number');
});

test('webrtc metrics - nothing non-numeric can reach the comparison store', async () => {
  const h = harness({ mode: 'none' });
  h.loop.start();
  const outcome = await settle(h);
  assert.ok(outcome);
  const metrics = buildLoopbackMetrics(outcome);
  for (const value of Object.values(metrics)) {
    assert.equal(typeof value, 'number', 'comparison only accepts finite numbers');
    assert.equal(Number.isFinite(value), true);
  }
});

test('webrtc loopback - the handshake timeout settles instead of hanging', async () => {
  const h = harness({ autoConnect: false, handshakeTimeoutMs: 30 });
  h.loop.start();
  const outcome = await settle(h, 40, 10);

  assert.ok(outcome, 'a timeout must settle the run');
  assert.equal(outcome.ok, false);
  assert.match(String(outcome.failure), /Timed out after 30 ms/i);
});

test('webrtc loopback - candidates arriving before the remote description are buffered, then applied', async () => {
  const h = harness({ mode: 'none', emitCandidates: true });
  h.loop.start();
  const outcome = await settle(h);

  assert.ok(outcome);
  assert.equal(outcome.iceCandidateAddErrors, 0);
  assert.equal(outcome.candidateTypes.length, 2, 'host and srflx types were observed');
  // Every candidate that was emitted reached a peer as a real addIceCandidate.
  const added = h.peers.sender.addedCandidates.length + h.peers.receiver.addedCandidates.length;
  assert.equal(added, 2, 'each of the two emitted candidates was added exactly once');
});

test('webrtc loopback - rejected candidates are surfaced, not swallowed', async () => {
  const h = harness({ mode: 'none', emitCandidates: true, failAddCandidate: true });
  h.loop.start();
  const outcome = await settle(h);

  assert.ok(outcome);
  assert.ok(outcome.iceCandidateAddErrors > 0, 'the failure count must be non-zero');
  const iceStep = outcome.steps.find((step) => step.label === 'ICE candidates exchanged');
  assert.ok(iceStep, 'the ICE step reports the outcome');
  assert.match(String(iceStep?.detail), /candidate\(s\) rejected when added/);
});

test('webrtc loopback - completion releases both peers, both channels and every timer', async () => {
  const h = harness({ mode: 'full' });
  h.loop.start();
  await settle(h);

  assert.equal(h.peers.sender.closed, true, 'sender peer closed');
  assert.equal(h.peers.receiver.closed, true, 'receiver peer closed');
  assert.equal(h.peers.sender.channel!.closed, true, 'sender channel closed');
  assert.equal(h.peers.receiver.channel!.closed, true, 'receiver channel closed');
  assert.equal(h.peers.sender.ondatachannel, null, 'receiver handler released');
  assert.equal(h.peers.receiver.ondatachannel, null);
  assert.equal(h.peers.sender.onicecandidate, null);
  assert.equal(h.peers.receiver.onconnectionstatechange, null);
  assert.equal(h.liveTimers(), 0, 'no timer may outlive the run');
});

test('webrtc loopback - reset releases everything and invalidates the run', async () => {
  const h = harness({ mode: 'none', autoConnect: false });
  h.loop.start();
  await new Promise((resolve) => setImmediate(resolve));
  h.loop.reset();

  assert.equal(h.peers.sender.closed, true);
  assert.equal(h.peers.receiver.closed, true);
  assert.equal(h.liveTimers(), 0);

  // A late connection callback from the abandoned run must not report.
  h.peers.receiver.connect();
  h.peers.receiver.connectionState = 'connected';
  await settle(h, 5, 10);
  assert.equal(h.outcomes.length, 0, 'an obsolete run can never settle');
});

test('webrtc loopback - dispose (unmount) stops the run and silences late callbacks', async () => {
  const h = harness({ mode: 'full', autoConnect: false });
  h.loop.start();
  await new Promise((resolve) => setImmediate(resolve));
  h.loop.dispose();

  // The channel still holds a reply from before disposal; it must be ignored.
  const before = h.outcomes.length;
  h.peers.sender.channel!.peer?.onmessage?.({ data: 'dt1|pong|0' });
  h.peers.receiver.connect();
  await settle(h, 5, 10);
  assert.equal(h.outcomes.length, before, 'nothing may be reported after unmount');
  assert.equal(h.liveTimers(), 0);
});

test('webrtc loopback - a stale run cannot overwrite a newer run', async () => {
  const h = harness({ mode: 'none', autoConnect: false });
  h.loop.start();
  await new Promise((resolve) => setImmediate(resolve));
  // Start a second run while the first is still negotiating.
  h.loop.start();
  const outcome = await settle(h);
  assert.ok(outcome);
  assert.equal(h.outcomes.length, 1, 'only the newest run settles, exactly once');
});

test('webrtc loopback - snapshots expose live progress without claiming a verdict', async () => {
  const h = harness({ mode: 'full' });
  h.loop.start();
  await settle(h);
  assert.ok(h.snapshots.length > 0);
  const last = h.snapshots[h.snapshots.length - 1];
  assert.equal(last.requiredEchoes, REQUIRED_ECHOES);
  assert.equal(last.connected, true);
  assert.equal(last.running, false, 'the run is finished when it settles');
});
