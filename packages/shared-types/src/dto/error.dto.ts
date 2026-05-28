/**
 * Global error response envelope.
 *
 * **Pattern:** Mọi error response Gateway emit phải có shape này. NestJS
 * global exception filter (S-03+ ownership) chuyển mọi `HttpException` +
 * uncaught error sang envelope này.
 *
 * **Why centralized:** FE chỉ cần 1 error handler (`if (data.error) ...`)
 * thay vì handle Nest default + custom + Zod parse error differently.
 *
 * @see docs/08_FE_BE_CONTRACT.md §4.3 — Standard Response Shape
 * @see docs/03_API_CONTRACTS.md §4 — Error code catalog (S-04 added 2 codes,
 *      S-07 added 1 code, S-08 added 4 codes)
 *
 * S-02 T02 emit. Global filter wiring DEFER → S-03 (first auth endpoint).
 * S-04 T03 amendment (Phiên Sx04-8b per D-S04-03 LAW Adaptive Single Endpoint
 * + Graceful Degradation): ADD `E_LLM_TIMEOUT` + `E_LLM_RATE_LIMITED` codes
 * for Variant B `variant_degraded` SSE event payload.
 * S-07 T01.F amendment (Phiên Sx07-D per C-S07-F + C-S07-J 3-threshold blur
 * check): ADD `E_VISION_BLUR` code documented in JSDoc only (no new Zod enum
 * per C-S07-F resolution Option ⓐ; reuses open `code: z.string()` pattern).
 * S-08 T01.H amendment (Phiên Sx08-D per D-S08-NN-11 LAW): ADD 4 voice error
 * codes documented in JSDoc only — `E_TRANSCRIBE_FAILED`,
 * `E_INTENT_PARSE_FAILED`, `E_PERMISSION_DENIED`, `E_NO_SPEECH`. Same
 * JSDoc-only treatment as S-07 `E_VISION_BLUR` (no new Zod enum, reuses
 * open `code: z.string()` pattern). Surfaced via SSE `error` event from AI
 * graph nodes in `apps/ai/src/graphs/intents/buying_by_voices.py` (Intent
 * 02 voice buy flow), NOT via HTTP error response.
 */

import { z } from 'zod';

/**
 * Error code enum (S-04 T03 NEW Phiên Sx04-8b per D-S04-03 LAW).
 *
 * Two NEW S-04 codes follow same pattern as existing codes from `03_API §4`:
 * - `E_LLM_TIMEOUT` — LLM provider timeout in Variant B path; triggers
 *   `variant_degraded` SSE event for graceful fallback to Variant A. NOT a
 *   hard error — user gets retry/continue choice via /action endpoint.
 * - `E_LLM_RATE_LIMITED` — LLM provider rate limit hit; same handling as
 *   `E_LLM_TIMEOUT`.
 *
 * Existing codes (S-02 T02 + S-03 T02) NOT enumerated here — they remain
 * as plain `code: string` in `ErrorResponseSchema` below (backward-compat).
 * This enum exists for S-04+ V-SLICE typed narrowing where LLM-error codes
 * are surfaced in `variant_degraded.error_code` field.
 *
 * S-07 NOTE: `E_VISION_BLUR` intentionally NOT added to this enum (per
 * C-S07-F Option ⓐ resolution). It surfaces only via SSE `error` event from
 * AI graph node `_node_vision_analyze` (Intent 01 importing_by_images flow),
 * NOT via Variant B fallback path; same open `code: z.string()` treatment
 * as `INVALID_INTENT` / `PRODUCT_NOT_FOUND` (S-02 T02 precedent).
 *
 * S-08 NOTE: 4 voice error codes (`E_TRANSCRIBE_FAILED`,
 * `E_INTENT_PARSE_FAILED`, `E_PERMISSION_DENIED`, `E_NO_SPEECH`)
 * intentionally NOT added to this enum (per D-S08-NN-11 LAW — S-07
 * `E_VISION_BLUR` precedent applied). They surface only via SSE `error`
 * event from AI graph nodes in `buying_by_voices.py` (Intent 02 voice buy
 * flow), NOT via Variant B fallback path. Same open `code: z.string()`
 * treatment.
 */
export const LlmErrorCodeSchema = z.enum(['E_LLM_TIMEOUT', 'E_LLM_RATE_LIMITED']);

/** Inferred TypeScript type for LlmErrorCode. */
export type LlmErrorCode = z.infer<typeof LlmErrorCodeSchema>;

/**
 * Error response envelope.
 *
 * @example
 * ```json
 * {
 *   "error": {
 *     "code": "VALIDATION_FAILED",
 *     "message": "Idempotency-Key header is required",
 *     "details": { "field": "Idempotency-Key" },
 *     "request_id": "550e8400-e29b-41d4-a716-446655440000"
 *   }
 * }
 * ```
 *
 * @example S-04 NEW LLM timeout (surfaced via SSE `variant_degraded` event,
 * NOT as HTTP error response — kept here for OpenAPI catalog completeness):
 * ```json
 * { "error": { "code": "E_LLM_TIMEOUT", "message": "LLM provider timed out",
 *              "request_id": "..." } }
 * ```
 *
 * @example S-07 NEW vision blur (surfaced via SSE `error` event from AI graph
 * `_node_vision_analyze`, NOT as HTTP error — Intent 01 importing_by_images
 * flow state-E terminal; mockup line 393 displays code verbatim):
 * ```json
 * { "error": { "code": "E_VISION_BLUR", "message": "Ảnh mờ hoặc thiếu ánh sáng",
 *              "details": { "retriable": true }, "request_id": "..." } }
 * ```
 *
 * @example S-08 NEW voice transcribe failure (surfaced via SSE `error` event
 * from AI graph `_node_speech_transcribe` in buying_by_voices.py — Intent 02
 * voice buy flow state-G terminal; FE displays Vietnamese message per
 * mockup intent-02-state-G-error.html):
 * ```json
 * { "error": { "code": "E_TRANSCRIBE_FAILED",
 *              "message": "Không nghe được, bạn nói lại nhé?",
 *              "details": { "retriable": true, "timeout_s": 15.0 },
 *              "request_id": "..." } }
 * ```
 */
export const ErrorResponseSchema = z.object({
  error: z.object({
    /**
     * Machine-readable error code (UPPER_SNAKE). Existing codes per 03_API §4:
     * `VALIDATION_FAILED`, `IDEMPOTENCY_CONFLICT`, `UNAUTHORIZED`, `FORBIDDEN`,
     * `INVALID_INTENT`, `PRODUCT_NOT_FOUND`, etc.
     * S-04 NEW codes: `E_LLM_TIMEOUT`, `E_LLM_RATE_LIMITED` (per D-S04-03 LAW).
     * S-07 NEW code: `E_VISION_BLUR` (per C-S07-F + C-S07-J 3-threshold check:
     * overall conf<0.3 OR category='unknown'/'unreadable'/'' OR max field conf<0.4).
     * S-08 NEW codes (per D-S08-NN-11 LAW — JSDoc-only, no Zod enum per S-07
     * E_VISION_BLUR precedent):
     *   - `E_TRANSCRIBE_FAILED` — speech.transcribe MCP call timed out (>15s)
     *     OR Gemini 2.5 Flash audio API returned error. Surfaced from
     *     `_node_speech_transcribe` in buying_by_voices.py. FE state-G
     *     terminal; user may retry mic press.
     *   - `E_INTENT_PARSE_FAILED` — LLMClient.generate_json returned empty
     *     or malformed JSON in `_node_parse_voice_intent`. Surfaced when
     *     prompt parse_voice_intent.txt fails to produce {action, items[],
     *     confidence} per D-S08-NN-B contract.
     *   - `E_PERMISSION_DENIED` — Browser mic permission rejected; FE-side
     *     constraint enforced before POST /intent fires. Documented here
     *     for FE-BE contract completeness — BE never raises this code
     *     itself (T02 FE state-G handles).
     *   - `E_NO_SPEECH` — Audio duration < 0.5s OR Gemini returned empty
     *     transcription (silence detected). Surfaced from
     *     `_node_speech_transcribe` after MIN_AUDIO_BYTES guard or
     *     post-Gemini empty-text check.
     */
    code: z.string(),
    /** Human-readable message. Localizable in future (currently English). */
    message: z.string(),
    /** Optional structured context (field name, expected vs actual, etc.). */
    details: z.record(z.unknown()).optional(),
    /** Request correlation ID — pair with OTel trace_id for debugging. */
    request_id: z.string(),
  }),
});

/** Inferred TypeScript type for ErrorResponse. */
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
