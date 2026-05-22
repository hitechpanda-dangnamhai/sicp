/**
 * `@icp/shared-types/behavior/error-events.ts`
 *
 * **Behavior Event Properties Schemas — Error subset (07_BEHAVIOR §3.8).**
 *
 * Error events emitted FE-side by tracker SDK when user clicks "Báo lỗi"
 * button in state-D network-error UI per V-SLICE S-03 T04+T05 stub (copy
 * trace_id to clipboard + emit event + toast "Trace đã copy"). NO real
 * email/Slack/PagerDuty integration Phase 02 per S-03 C-09.
 *
 * **Section 3.8 added Phiên 30 C-09** — mockup state-D "Báo lỗi" + trace ID
 * functional UI per Rule 6 session LAW. trace_id from response headers
 * `traceparent` (W3C — Gateway auto-instrument T01 emits). error_code from
 * client-side error.code mapping (TanStack Query timeout → "E_NETWORK_TIMEOUT"
 * etc).
 *
 * @see docs/07_BEHAVIOR_LOGS.md §3.8 (Error — added S-03 Phiên 30 C-09)
 * @see docs/LOG_CATALOG.md Section B "Error" (NEW subsection per C-15)
 *
 * S-03 T03 emit (Phiên 33).
 */

import { z } from 'zod';

/**
 * `error.report_requested` — emitted FE-side when user taps "Báo lỗi" button
 * in state-D ErrorState UI. trace_id + error_code carry minimal diagnostic
 * payload for ops investigation correlation (Loki search by trace_id).
 *
 * Length bounds (max 64 chars each):
 *   - trace_id: W3C traceparent format `00-{32hex}-{16hex}-{2hex}` → 55 chars;
 *     or truncated 8-char prefix display per mockup "trace: c9f2...41" → 8 chars
 *   - error_code: SCREAMING_SNAKE convention, longest realistic ~40 chars
 *     (e.g. `E_NETWORK_TIMEOUT`, `E_INVALID_CREDENTIALS`).
 */
export const ErrorReportRequestedPropertiesSchema = z
  .object({
    trace_id: z.string().min(1).max(64),
    error_code: z.string().min(1).max(64),
  })
  .strict();
