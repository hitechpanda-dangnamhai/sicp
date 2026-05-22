/**
 * apps/gateway/src/intent/dto/intent-request.dto.ts
 *
 * Zod schema + DTO for `POST /api/v1/intent` request body.
 *
 * S-02 T07 emit. Mirrors `AiClient.PostIntentBody` shape (single source-of-truth
 * `apps/gateway/src/clients/ai.client.ts` from T05) for type symmetry through
 * the pipe.
 *
 * Pattern: `nestjs-zod` `createZodDto()` per T01 + T06 convention (NOT
 * class-validator — global pipe absent per main.ts comment).
 *
 * @see docs/03_API_CONTRACTS.md §1.2 (multipart for image/voice deferred V-SLICE)
 */

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const IntentRequestSchema = z.object({
  modality: z.enum(['text', 'image', 'voice']),
  content: z.string().min(1).max(5000).optional(),
  hint: z.enum(['import', 'buy', 'search', 'recommend']).optional(),
});

export class IntentRequestDto extends createZodDto(IntentRequestSchema) {}
