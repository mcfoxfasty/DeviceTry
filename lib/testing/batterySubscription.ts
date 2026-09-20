/**
 * Battery subscription lifecycle — extracted from BatteryTester so the
 * refresh/re-subscribe semantics can be regression-tested without a browser.
 *
 * Token ownership: the LIFECYCLE OWNER (the tester via startRun) is the
 * single source of truth for tokens. The controller never invents its own
 * counter — `subscribe(token)` and `refresh(newToken)` always receive the
 * lifecycle token captured at operation start. A subscription therefore
 * binds its listeners to the same immutable token the tester will validate
 * against, so the two can never diverge.
 *
 * - `refresh(newToken)` starts a new observation on the SAME manager: it
 *   re-attaches listeners bound to the fresh token. Old listeners stay
 *   rejected forever (their captured token no longer matches), while fresh
 *   events report again — clearing the result does not permanently kill
 *   reporting.
 * - `unsubscribeAll()` is pure teardown: it removes listeners and touches no
 *   tokens and no host state, so an unmount never clears a completed result.
 */

export interface BatterySnapshotLike {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
}

export interface BatteryEventSink {
  /** Called on each live event with the reading snapshot and its token. */
  onEvent(token: number, snapshot: BatterySnapshotLike): void;
  /**
   * Called at most once per refresh when the superseded subscription had
   * already reported, so the host can drop its stale entry. Lifecycle
   * invalidation remains the caller's job (startRun/emitRunRich guards).
   */
  onSuperseded(): void;
}

export interface BatteryListener {
  (event: { type: string }): void;
}

export interface BatterySource {
  read(): BatterySnapshotLike;
  addEventListener(type: string, listener: BatteryListener): void;
  removeEventListener(type: string, listener: BatteryListener): void;
}

const EVENT_TYPES = ['chargingchange', 'levelchange', 'chargingtimechange', 'dischargingtimechange'] as const;

export class BatterySubscriptionController {
  private source: BatterySource;
  private sink: BatteryEventSink;
  private currentToken: number;
  private listener: BatteryListener | null = null;
  private listenerToken: number | null = null;
  private reportedForToken: number | null = null;

  constructor(source: BatterySource, sink: BatteryEventSink, initialToken: number) {
    this.source = source;
    this.sink = sink;
    this.currentToken = initialToken;
  }

  get liveToken(): number {
    return this.currentToken;
  }

  get hasListener(): boolean {
    return this.listener !== null;
  }

  /** Subscribe with the caller's lifecycle token. Returns false if out of order. */
  subscribe(token: number): boolean {
    if (token < this.currentToken) return false;
    this.currentToken = token;
    this.attach();
    return true;
  }

  /**
   * Start a new observation on the same manager using the caller's freshly
   * captured lifecycle token (from startRun — never a locally invented one).
   * If the superseded subscription had already reported, onSuperseded fires
   * exactly once; the host drops the stale entry and the new observation
   * reports again with the new token.
   */
  refresh(newToken: number): boolean {
    if (newToken < this.currentToken) return false; // out of order: ignore
    this.currentToken = newToken;
    if (this.reportedForToken !== null) {
      this.reportedForToken = null;
      this.sink.onSuperseded();
    }
    this.attach();
    return true;
  }

  /**
   * Battery event dispatch. Validates the LISTENER's captured token — not a
   * re-read of external state — so a listener belonging to an older
   * observation can never report, even if it still fires after a refresh.
   */
  handleEvent(snapshot: BatterySnapshotLike): void {
    if (this.listenerToken === null || this.listenerToken !== this.currentToken) {
      return; // stale listener (pre-refresh or post-teardown): rejected
    }
    this.reportedForToken = this.currentToken;
    this.sink.onEvent(this.currentToken, snapshot);
  }

  /** Remove all listeners. Pure teardown: does not touch tokens or the host. */
  unsubscribeAll(): void {
    this.detach();
    this.listenerToken = null;
  }

  private attach(): void {
    this.detach();
    // Bind the listener to the token captured AT ATTACH TIME: even if a
    // removeEventListener raced and an old listener object keeps firing after
    // a refresh, its captured token no longer matches and it reports nothing.
    const boundToken = this.currentToken;
    const listener: BatteryListener = () => {
      if (boundToken !== this.currentToken) return; // stale listener: rejected
      this.handleEvent(this.source.read());
    };
    this.listener = listener;
    this.listenerToken = boundToken;
    for (const type of EVENT_TYPES) {
      try {
        this.source.addEventListener(type, listener);
      } catch {
        // ignore individual registration failures
      }
    }
  }

  private detach(): void {
    if (this.listener) {
      for (const type of EVENT_TYPES) {
        try {
          this.source.removeEventListener(type, this.listener);
        } catch {
          // ignore
        }
      }
      this.listener = null;
    }
  }
}
