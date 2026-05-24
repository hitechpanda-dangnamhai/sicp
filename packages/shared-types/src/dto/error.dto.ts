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
 * @see docs/03_API_CONTRACTS.md §4 — Error code catalog (S-04 added 2 codes)
 *
 * S-02 T02 emit. Global filter wiring DEFER → S-03 (first auth endpoint).
 * S-04 T03 amendment (Phiên Sx04-8b per D-S04-03 LAW Adaptive Single Endpoint
 * + Graceful Degradation): ADD `E_LLM_TIMEOUT` + `E_LLM_RATE_LIMITED` codes
 * for Variant B `variant_degraded` SSE event payload.
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
 */
export const ErrorResponseSchema = z.object({
  error: z.object({
    /**
     * Machine-readable error code (UPPER_SNAKE). Existing codes per 03_API §4:
     * `VALIDATION_FAILED`, `IDEMPOTENCY_CONFLICT`, `UNAUTHORIZED`, `FORBIDDEN`,
     * `INVALID_INTENT`, `PRODUCT_NOT_FOUND`, etc.
     * S-04 NEW codes: `E_LLM_TIMEOUT`, `E_LLM_RATE_LIMITED` (per D-S04-03 LAW).
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
