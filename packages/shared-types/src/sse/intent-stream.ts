/**
 * `@icp/shared-types/sse` — Intent stream SSE event schemas.
 *
 * **S-02 T07 emit** — typed catalog for `POST /api/v1/intent` → `GET /api/v1/intent/stream`
 * Server-Sent Events (per ADR-019 cookie httpOnly auth + D-05 LOCK).
 *
 * **Locked decisions (S-02 T07):**
 * - **C-36**: 10 typed payload schemas + `heartbeat` = transport keepalive
 *   (server-only emit every 15s, no client schema needed; FE EventSource
 *   ignores via no `addEventListener('heartbeat', ...)`).
 * - **C-37**: Status phase enum = 7 values (superset of 03_API §3 + 08_FE_BE §6).
 * - **C-38**: Endpoint pattern = `POST /api/v1/intent → 202 {request_id}` then
 *   `GET /api/v1/intent/stream?id=<rid>` (native EventSource flow).
 *
 * **Phase 1 (S-02) wrapper scope:** Gateway emits `status:classifying →
 * status:analyzing → status:done → final` sequence from JSON response of
 * `AiClient.postIntent()` (D-03 router stub returns `intent:"unknown"`). Real
 * `tool_call`/`tool_result`/`products`/`card`/`chart`/`order_update` events
 * defer V-SLICE S-04..S-10 (per S-02_BRIEF §4 Non-Goals).
 *
 * **Dual access pattern (C-32 LOCKED post-T06):**
 * - **FE** subpath: `import { SseStatusEvent } from '@icp/shared-types/sse'`
 *   (tree-shaking via bundler).
 * - **BE** root: `import { SseStatusEvent } from '@icp/shared-types'`
 *   (CommonJS resolution via root barrel re-export).
 *
 * @see docs/03_API_CONTRACTS.md §1.2 + §3 (endpoint + 10 event catalog)
 * @see docs/08_FE_BE_CONTRACT.md §6 + §12 (typed schemas + cookie auth)
 * @see docs/DECISIONS.md ADR-019 (cookie httpOnly SSE auth)
 * @see slices/S-02_decisions-log.md Section 1 D-05 + Section 5 C-32/C-34/C-36/C-37/C-38
 */

import { z } from 'zod';

/**
 * `status` event — pipeline phase progression.
 *
 * **C-37 LOCKED**: 7 values (union of 03_API §3 minimal + 08_FE_BE §6 superset).
 * Phase 1 wrapper only emits `classifying`/`analyzing`/`done`; rest reserved
 * V-SLICE (`searching` S-04 search intent, `synthesizing` S-08 chart intent,
 * `committing` S-06 checkout, `awaiting_user_input` S-04 card confirm).
 */
export const SseStatusEvent = z.object({
  phase: z.enum([
    'classifying',
    'analyzing',
    'searching',
    'synthesizing',
    'committing',
    'awaiting_user_input',
    'done',
  ]),
});

/** `partial_text` event — incremental LLM token stream (V-SLICE S-08 first need). */
export const SsePartialTextEvent = z.object({
  delta: z.string(),
});

/** `tool_call` event — AI invoking MCP tool (V-SLICE S-04+ first need). */
export const SseToolCallEvent = z.object({
  tool: z.string(),
  args: z.record(z.unknown()),
});

/** `tool_result` event — MCP tool result summary (V-SLICE S-04+ first need). */
export const SseToolResultEvent = z.object({
  tool: z.string(),
  result_summary: z.string(),
});

/**
 * `products` event — product list payload.
 * `items` typed `unknown[]` Phase 1; V-SLICE S-04 will narrow to `Product[]`
 * once `packages/shared-types/src/domain/product.ts` ships (deferred per
 * `08_FE_BE_CONTRACT.md §3` folder layout C-10).
 */
export const SseProductsEvent = z.object({
  items: z.array(z.unknown()),
});

/**
 * `card` event — action card payload (V-SLICE S-04+ first need).
 * Typed `unknown` Phase 1; V-SLICE will replace with `ActionCardSchema` from
 * `domain/action-card.ts`.
 */
export const SseCardEvent = z.unknown();

/** `chart` event — chart spec payload (V-SLICE S-08 first need). */
export const SseChartEvent = z.object({
  type: z.enum(['line', 'bar', 'pie']),
  title: z.string(),
  x_axis: z.string(),
  y_axis: z.string(),
  series: z.array(
    z.object({
      name: z.string(),
      data: z.array(z.number()),
    }),
  ),
});

/** `order_update` event — order status change (V-SLICE S-06 checkout). */
export const SseOrderUpdateEvent = z.object({
  order_id: z.string(),
  status: z.enum(['pending', 'paid', 'failed', 'cancelled']),
});

/**
 * `final` event — end of stream payload.
 * Phase 1 wrapper emits: `{text: "Intent classified as <intent>", summary:
 * {request_id, intent, confidence}}`. V-SLICE narrows `summary` shape per
 * intent (currently `Record<string, unknown>` for forward-compat).
 */
export const SseFinalEvent = z.object({
  text: z.string(),
  summary: z.record(z.unknown()).optional(),
});

/** `error` event — error payload (retriable hint per 03_API §4). */
export const SseErrorEvent = z.object({
  code: z.string(),
  message: z.string(),
  retriable: z.boolean(),
});

/**
 * Typed event map — handler signature lookup for `streamIntent()` wrapper.
 *
 * **`heartbeat` NOT included** (C-36 LOCK): transport keepalive emitted by
 * gateway every 15s (`event: heartbeat\ndata: {"ts": <epoch_ms>}`); FE ignores
 * via no handler subscription. Browser EventSource still uses heartbeat to
 * detect connection liveness + auto-reconnect on idle timeout.
 */
export type IntentStreamEventMap = {
  status: z.infer<typeof SseStatusEvent>;
  partial_text: z.infer<typeof SsePartialTextEvent>;
  tool_call: z.infer<typeof SseToolCallEvent>;
  tool_result: z.infer<typeof SseToolResultEvent>;
  products: z.infer<typeof SseProductsEvent>;
  card: z.infer<typeof SseCardEvent>;
  chart: z.infer<typeof SseChartEvent>;
  order_update: z.infer<typeof SseOrderUpdateEvent>;
  final: z.infer<typeof SseFinalEvent>;
  error: z.infer<typeof SseErrorEvent>;
};

/** Union of typed event names — used in `streamIntent(handlers)` key constraint. */
export type IntentStreamEventType = keyof IntentStreamEventMap;

/** Runtime validator registry — used by gateway controller pre-emit + FE wrapper post-parse. */
export const IntentStreamSchemas = {
  status: SseStatusEvent,
  partial_text: SsePartialTextEvent,
  tool_call: SseToolCallEvent,
  tool_result: SseToolResultEvent,
  products: SseProductsEvent,
  card: SseCardEvent,
  chart: SseChartEvent,
  order_update: SseOrderUpdateEvent,
  final: SseFinalEvent,
  error: SseErrorEvent,
} as const;
