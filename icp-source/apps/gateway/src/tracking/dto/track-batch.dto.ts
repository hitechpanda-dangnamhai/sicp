/**
 * apps/gateway/src/tracking/dto/track-batch.dto.ts
 *
 * NestJS DTO bridging Zod `TrackBatchSchema` (`@icp/shared-types/behavior`)
 * to NestJS validation + Swagger doc generation via `nestjs-zod`.
 *
 * **Pattern per `08_FE_BE §4.2`:** `createZodDto(...)` produces a class with
 * static schema metadata that nestjs-zod's body-validation pipe consumes.
 * No need to duplicate types in Nest-specific decorators (`@ApiProperty`).
 *
 * `patchNestJsSwagger()` (T01 main.ts line 27) makes Swagger module aware of
 * nestjs-zod DTOs — OpenAPI JSON output reflects exact Zod schema shape.
 *
 * @see docs/08_FE_BE_CONTRACT.md §4.2 — DTO Validation từ Zod
 *
 * S-02 T06 emit.
 */

import { createZodDto } from 'nestjs-zod';
import { TrackBatchSchema } from '@icp/shared-types';

/**
 * Request body for `POST /api/v1/track`.
 *
 * @example
 * ```json
 * {
 *   "events": [
 *     {
 *       "event_id": "550e8400-e29b-41d4-a716-446655440000",
 *       "event_type": "product.viewed",
 *       "occurred_at": "2026-05-21T13:04:00.000Z",
 *       "session_id": "sess_abc",
 *       "app_version": "0.0.1",
 *       "properties": { "product_id": "p_xxx", "source": "search" }
 *     }
 *   ]
 * }
 * ```
 */
export class TrackBatchDto extends createZodDto(TrackBatchSchema) {}
