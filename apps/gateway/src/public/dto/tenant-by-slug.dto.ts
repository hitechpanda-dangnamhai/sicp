/**
 * apps/gateway/src/public/dto/tenant-by-slug.dto.ts
 *
 * S-P0-01 T02 — response cho GET /api/v1/public/tenant-by-slug/:slug.
 * nestjs-zod createZodDto → OpenAPI → FE PublicService (`pnpm openapi:sync`).
 *
 * Public, KHÔNG auth, KHÔNG tenant context — đây CHÍNH LÀ endpoint FE gọi để
 * lấy tenant_id từ slug rồi attach X-Tenant-Id (ADR-046 amendment b).
 */

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const TenantBySlugResponseSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string(),
});

export type TenantBySlugResponseType = z.infer<typeof TenantBySlugResponseSchema>;

export class TenantBySlugResponseDto extends createZodDto(TenantBySlugResponseSchema) {}
