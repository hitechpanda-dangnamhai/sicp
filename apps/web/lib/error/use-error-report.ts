'use client';

/**
 * apps/web/lib/error/use-error-report.ts
 *
 * `useErrorReport` + `reportError` — small helper for state-D "Báo lỗi" button.
 *
 * Slice:    S-03 T05 — /me Profile + Logout Flow + State-D ErrorState integration
 *
 * **Responsibilities** (state-D mockup line 173 "Báo lỗi"):
 *   1. Emit `error.report_requested{trace_id, error_code}` via tracker SDK
 *      (S-02 T06 + T03 schema catalog already registered — see
 *      `packages/shared-types/src/behavior/error-events.ts`).
 *   2. Copy `trace_id` to clipboard via `navigator.clipboard.writeText` so user
 *      can paste it into Slack/Zalo when reporting to ops team.
 *   3. NO real email/Slack/PagerDuty integration (BRIEF non-goal — Phase 6).
 *
 * Decisions applied:
 * - **D-26** — Strict error classification: trace_id stub generated FE-side
 *   via `crypto.randomUUID().slice(0, 8)` (8-char hex) at error capture time
 *   in login page state machine. NOT real W3C `traceparent` (Phase 6 polish
 *   per BRIEF non-goal "W3C traceparent propagation").
 * - **C-09 closure** — Mockup state-D "Báo lỗi" button per Rule 6 session LAW
 *   now functional (event emit + clipboard copy stub). Pre-T05 was unwired.
 *
 * **Trace ID convention**:
 *   - Generated in login page `catch` branch when `classifyLoginError(err)`
 *     returns `'network'` (no HTTP status response → fetch reject TypeError).
 *   - Stored in component state (`useState<string | null>`) → passed as prop
 *     to ErrorState `actions` slot for Báo lỗi button.
 *   - 8-char hex `crypto.randomUUID().slice(0, 8)` (e.g. "c9f241a8") — matches
 *     mockup display "trace: c9f2...41" semantic short ID.
 *
 * **Browser support** (`navigator.clipboard.writeText`):
 *   - Requires HTTPS or localhost (clipboard API gated).
 *   - Graceful degradation: if `navigator.clipboard` undefined OR throws
 *     (insecure context), event still fires; only the copy step skipped.
 *     `clipboardError` resolves to `null` instead of throwing.
 *
 * Public API (functional helper, NOT a hook unless needed for tracker context):
 *   ```ts
 *   import { reportError } from '@/lib/error/use-error-report';
 *   <Button onClick={() => reportError('c9f241a8', 'E_NETWORK_TIMEOUT')}>
 *     Báo lỗi
 *   </Button>
 *   ```
 *
 * S-03 T05 emit (Phiên N+2 Batch 2).
 */

import { getTracker } from '@/lib/tracker';

export interface ReportErrorResult {
  /** Whether tracker.track call succeeded (in-memory buffer push — sync, no fail). */
  tracked: boolean;
  /** Whether clipboard.writeText resolved successfully (false if API unavailable). */
  copied: boolean;
}

/**
 * Emit `error.report_requested` behavior event + copy `trace_id` to clipboard.
 *
 * **Fire-and-forget** (async but returns immediately to caller; clipboard
 * promise resolves out-of-band). Returns Promise<ReportErrorResult> for tests
 * or consumers that want to show a toast "Trace đã copy" only when copy
 * succeeded. T05 consumer (login page state-D Báo lỗi button) ignores the
 * result — fire-and-forget acceptable per mockup (no toast UI mockup).
 *
 * @param traceId   8-char hex trace stub per D-26 stub (or full W3C traceparent
 *                  string in future Phase 6 once propagation lands)
 * @param errorCode SCREAMING_SNAKE error code (e.g. `E_NETWORK_TIMEOUT`)
 */
export async function reportError(traceId: string, errorCode: string): Promise<ReportErrorResult> {
  // 1. Emit behavior event — sync push to tracker queue (auto-flush 5s per D-04).
  let tracked = false;
  try {
    getTracker().track('error.report_requested', {
      trace_id: traceId,
      error_code: errorCode,
    });
    tracked = true;
  } catch (err) {
    // Tracker not initialized OR Zod schema rejected (shouldn't happen — schema
    // is min(1).max(64) for both fields, and we control both inputs).
    if (typeof console !== 'undefined') {
      console.error('reportError: tracker.track failed', err);
    }
  }

  // 2. Copy to clipboard — graceful degradation if API unavailable.
  let copied = false;
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(traceId);
      copied = true;
    } catch {
      // Insecure context, permission denied, etc — silent fail per fire-and-forget.
      copied = false;
    }
  }

  return { tracked, copied };
}
