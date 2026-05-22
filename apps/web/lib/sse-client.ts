/**
 * apps/web/lib/sse-client.ts
 *
 * S-02 T07 emit. Type-safe EventSource wrapper for `GET /api/v1/intent/stream`.
 *
 * **Pattern**: native browser `EventSource` API with `{withCredentials: true}`
 * per ADR-019 (cookie httpOnly auth). Caller supplies typed handler map keyed
 * by `IntentStreamEventType`; wrapper auto-parses `data: <json>` per W3C SSE
 * spec and dispatches to matching handler.
 *
 * **Heartbeat (C-36)**: not in `IntentStreamEventMap` (transport keepalive
 * only). Browser EventSource still receives `event: heartbeat\ndata: {ts:...}`
 * but no handler subscription → frame is dropped silently. EventSource auto-
 * reconnects on idle timeout using the keepalive.
 *
 * **Error handling**: `onError` callback fires on `EventSource.onerror`
 * (network drop, connection close). For server-emitted `event: error` typed
 * payload, subscribe via `handlers.error` instead.
 *
 * @see docs/08_FE_BE_CONTRACT.md §6.1
 * @see docs/03_API_CONTRACTS.md §3
 *
 * Usage (Phase 1 stub flow):
 * ```ts
 * const close = streamIntent('/api/v1/intent/stream?id=' + rid, {
 *   status: (e) => setPhase(e.phase),
 *   final: (f) => setResult(f.text),
 *   error: (err) => toast.error(err.message),
 * }, { onError: (e) => console.warn('SSE dropped', e) });
 * // ... later
 * close();
 * ```
 */

import type {
  IntentStreamEventMap,
  IntentStreamEventType,
} from '@icp/shared-types/sse';

/** Handler signature — per typed event payload. */
export type IntentStreamHandlers = {
  [K in IntentStreamEventType]?: (data: IntentStreamEventMap[K]) => void;
};

/** Optional wrapper-level callbacks (lifecycle, parse errors, network errors). */
export interface StreamIntentOptions {
  /** Called when EventSource opens (HTTP 200 headers received). */
  onOpen?: () => void;
  /** Called on EventSource `onerror` (connection failure / drop / close). */
  onError?: (event: Event) => void;
  /** Called when a frame's JSON.parse fails (server emitted malformed data). */
  onParseError?: (event: IntentStreamEventType, raw: string, err: unknown) => void;
}

/**
 * Open SSE stream + subscribe typed handlers.
 *
 * @returns cleanup function — call to `EventSource.close()`.
 */
export function streamIntent(
  url: string,
  handlers: IntentStreamHandlers,
  options: StreamIntentOptions = {},
): () => void {
  const es = new EventSource(url, { withCredentials: true });

  if (options.onOpen) es.onopen = options.onOpen;
  if (options.onError) es.onerror = options.onError;

  (Object.keys(handlers) as IntentStreamEventType[]).forEach((eventName) => {
    const handler = handlers[eventName];
    if (!handler) return;
    es.addEventListener(eventName, (e) => {
      const messageEvent = e as MessageEvent<string>;
      try {
        const parsed = JSON.parse(messageEvent.data) as IntentStreamEventMap[typeof eventName];
        // `as never` cast required because TS narrows handler signature per key
        // but loop iterates union — runtime correctness guaranteed by keyof map.
        (handler as (data: IntentStreamEventMap[typeof eventName]) => void)(parsed);
      } catch (err) {
        if (options.onParseError) {
          options.onParseError(eventName, messageEvent.data, err);
        } else {
          // eslint-disable-next-line no-console
          console.error('[sse-client] parse error', { eventName, raw: messageEvent.data, err });
        }
      }
    });
  });

  return () => es.close();
}
