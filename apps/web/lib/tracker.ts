/**
 * apps/web/lib/tracker.ts
 *
 * **Client-side Behavior Tracker SDK.**
 *
 * Singleton instance exported as `tracker`. Buffers events in memory, flushes
 * every 5s (per D-04) or on `beforeunload`/`pagehide` (via `navigator.sendBeacon`
 * for guaranteed unload delivery).
 *
 * **Type safety end-to-end:** `tracker.track('product.viewed', { product_id, ... })`
 * — TypeScript compile error if `product_id` missing or wrong shape, via
 * `PropertiesFor<T>` from `@icp/shared-types/behavior`.
 *
 * **Retry strategy:** On flush failure (network error or 5xx) the events
 * stay in queue + retry on next flush tick. After 3 consecutive failures
 * the oldest batch chunk is dropped + a console.error emitted (no
 * backend log path since FE OTel SDK not in S-02 scope per BRIEF §4
 * Non-Goals).
 *
 * **No queue persistence (Phase 06 polish):** events in-memory only. Hard
 * refresh during in-flight = up to 5s of events lost. Acceptable Hackathon
 * scope per BRIEF §11 (~25K events demo scale).
 *
 * @see docs/07_BEHAVIOR_LOGS.md §7 (Client SDK reference) + §9 (privacy)
 * @see docs/DECISIONS.md ADR-012 (behavior vs operational logs)
 * @see slices/S-02_decisions-log.md D-04 (flush 5s LOCKED)
 *
 * S-02 T06 emit.
 */

import {
  type BehaviorEvent,
  type BehaviorEventType,
  type PropertiesFor,
  type TrackBatch,
} from '@icp/shared-types/behavior';

// ─────────────────────────────────────────────────────────────────────
// Constants (per spec)
// ─────────────────────────────────────────────────────────────────────

/** Auto-flush interval ms. D-04 LOCKED Phase 1 (07_BEHAVIOR §7). */
const FLUSH_INTERVAL_MS = 5000;

/**
 * Max events per batch POST. Matches server `TrackBatchSchema.max(500)`.
 * Larger queue → multi-batch flush on next tick.
 */
const MAX_BATCH_SIZE = 500;

/** Max consecutive flush failures before oldest batch is dropped. */
const MAX_FLUSH_RETRIES = 3;

/** Gateway track endpoint path. */
const TRACK_ENDPOINT = '/api/v1/track';

// ─────────────────────────────────────────────────────────────────────
// Tracker class
// ─────────────────────────────────────────────────────────────────────

export interface TrackerInit {
  /** Stable pseudonymous user id. Optional pre-auth — events flushed as anonymous. */
  userId?: string;
  /** Per-browser-session id. SHOULD persist across navigations within tab. */
  sessionId: string;
  /** Stable device id across sessions. Optional. */
  deviceId?: string;
  /** App version from build (e.g. `process.env.NEXT_PUBLIC_APP_VERSION`). */
  appVersion: string;
  /**
   * Override default endpoint. Useful for tests or non-default deploys.
   * Defaults to `/api/v1/track` (same-origin Next.js → gateway rewrite).
   */
  endpoint?: string;
}

export class Tracker {
  private queue: BehaviorEvent[] = [];
  private failedFlushCount = 0;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private unloadListenersAttached = false;

  // Mutable identity (settable after auth completes)
  private userId: string | undefined;
  private readonly sessionId: string;
  private readonly deviceId: string | undefined;
  private readonly appVersion: string;
  private readonly endpoint: string;

  constructor(init: TrackerInit) {
    this.userId = init.userId;
    this.sessionId = init.sessionId;
    this.deviceId = init.deviceId;
    this.appVersion = init.appVersion;
    this.endpoint = init.endpoint ?? TRACK_ENDPOINT;
  }

  /**
   * Type-safe track call. Per-event-type properties shape enforced at
   * compile time via `PropertiesFor<T>`.
   *
   * @example
   * ```ts
   * tracker.track('product.viewed', {
   *   product_id: 'p_abc',
   *   source: 'search',
   * }, { type: 'product', id: 'p_abc' });
   * ```
   */
  track<T extends BehaviorEventType>(
    type: T,
    properties: PropertiesFor<T>,
    subject?: { type: BehaviorEvent['subject_type']; id: string },
  ): void {
    const event: BehaviorEvent = {
      event_id: generateUuid(),
      event_type: type,
      occurred_at: new Date().toISOString(),
      user_id: this.userId,
      session_id: this.sessionId,
      device_id: this.deviceId,
      subject_type: subject?.type,
      subject_id: subject?.id,
      properties,
      app_version: this.appVersion,
      // received_at omitted — server fills via DB DEFAULT NOW()
    } as BehaviorEvent;

    this.queue.push(event);
  }

  /**
   * Update user identity (e.g. after auth completes). Events queued before
   * this call retain `user_id: undefined` (anonymous). Acceptable per
   * 07_BEHAVIOR §9.1 (user_id optional, pseudonymized).
   */
  setUser(userId: string | undefined): void {
    this.userId = userId;
  }

  /**
   * Start auto-flush ticker + unload listeners. Idempotent; safe to call
   * multiple times.
   */
  start(): void {
    if (this.flushTimer === null && typeof window !== 'undefined') {
      this.flushTimer = setInterval(() => {
        void this.flush();
      }, FLUSH_INTERVAL_MS);
    }
    this.attachUnloadListeners();
  }

  /**
   * Stop auto-flush. Useful for tests + React StrictMode unmount cleanup.
   * Does NOT flush remaining events — call `flush()` separately if needed.
   */
  stop(): void {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Manually flush queue. Returns when batch resolved (success or retried).
   * Safe to await in tests.
   */
  async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, MAX_BATCH_SIZE);
    const body: TrackBatch = { events: batch };

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
        credentials: 'same-origin',
      });

      if (!res.ok) {
        throw new Error(`POST ${this.endpoint} → ${res.status}`);
      }
      this.failedFlushCount = 0;
    } catch (err) {
      this.failedFlushCount++;
      if (this.failedFlushCount > MAX_FLUSH_RETRIES) {
        // Drop the batch + log; reset counter so subsequent batches can retry.
        // eslint-disable-next-line no-console
        console.error(
          'tracker.client_drop',
          {
            dropped_count: batch.length,
            reason: 'max_retries_exceeded',
            error: err instanceof Error ? err.message : String(err),
          },
        );
        this.failedFlushCount = 0;
      } else {
        // Re-queue at front to preserve chronological order on retry.
        this.queue.unshift(...batch);
      }
    }
  }

  /**
   * Synchronous flush via `navigator.sendBeacon` — only works during page
   * unload + has 64KB payload size limit. Browser guarantees delivery
   * before page closes. Fallback to async fetch if Beacon unavailable.
   *
   * Public for tests; called internally on `beforeunload` + `pagehide`.
   */
  flushBeacon(): void {
    if (this.queue.length === 0) return;
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
      void this.flush();
      return;
    }
    const batch = this.queue.splice(0, MAX_BATCH_SIZE);
    const body: TrackBatch = { events: batch };
    const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
    const sent = navigator.sendBeacon(this.endpoint, blob);
    if (!sent) {
      // Beacon queue full / payload too big — re-queue and let next flush retry.
      this.queue.unshift(...batch);
    }
  }

  private attachUnloadListeners(): void {
    if (this.unloadListenersAttached || typeof window === 'undefined') return;
    const handler = (): void => this.flushBeacon();
    window.addEventListener('beforeunload', handler);
    window.addEventListener('pagehide', handler);
    this.unloadListenersAttached = true;
  }
}

// ─────────────────────────────────────────────────────────────────────
// UUID generator — prefers crypto.randomUUID() (browsers ≥2022), falls
// back to v4 polyfill for older runtimes (e.g. iOS <15.4, jsdom in tests).
// ─────────────────────────────────────────────────────────────────────
function generateUuid(): string {
  const c = (typeof globalThis !== 'undefined' ? globalThis.crypto : undefined) as
    | (Crypto & { randomUUID?: () => string })
    | undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  if (c && typeof c.getRandomValues === 'function') {
    const buf = new Uint8Array(16);
    c.getRandomValues(buf);
    // RFC 4122 v4
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
    return (
      hex.slice(0, 8) + '-' +
      hex.slice(8, 12) + '-' +
      hex.slice(12, 16) + '-' +
      hex.slice(16, 20) + '-' +
      hex.slice(20)
    );
  }
  // Last resort — non-cryptographic, only triggers in obscure environments.
  return 'fallback-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

// ─────────────────────────────────────────────────────────────────────
// Default singleton — lazy-init on first `getTracker()` call.
// Caller (Next.js root layout) responsible for calling `tracker.start()`
// after init to begin auto-flush ticker.
// ─────────────────────────────────────────────────────────────────────

let _tracker: Tracker | null = null;

/**
 * Lazy singleton getter. First call initializes with given `init` params.
 * Subsequent calls return cached instance regardless of params passed
 * (caller-side guard if re-init needed: call `tracker.stop()` + recreate).
 *
 * Consumers in tests can construct `new Tracker(...)` directly to avoid
 * shared global state.
 */
export function getTracker(init?: TrackerInit): Tracker {
  if (_tracker === null) {
    if (!init) {
      throw new Error('getTracker(): init params required on first call');
    }
    _tracker = new Tracker(init);
  }
  return _tracker;
}

/**
 * Test-only reset. NOT exported from public barrel — internal use.
 * @internal
 */
export function __resetTrackerForTests(): void {
  if (_tracker !== null) {
    _tracker.stop();
    _tracker = null;
  }
}
