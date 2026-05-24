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
 *
 * S-02 T02 emit. Global filter wiring DEFER → S-03 (first auth endpoint).
 */

import { z } from 'zod';

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
 */
export const ErrorResponseSchema = z.object({
  error: z.object({
    /** Machine-readable error code (UPPER_SNAKE). E.g. `VALIDATION_FAILED`, `IDEMPOTENCY_CONFLICT`, `UNAUTHORIZED`. */
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
