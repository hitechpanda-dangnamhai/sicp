/**
 * apps/gateway/src/auth/dto/switch-tenant.dto.ts
 *
 * S-P0-01 T02 (ADR-046 amendment c) — POST /api/v1/auth/switch-tenant.
 *
 * Request: `{ tenant_id }` (shop đích). Response: `{ tenant_id, slug,
 * redirect_url }` — KHÔNG token (switch chỉ đổi landing hint, FE router.push
 * redirect_url). nestjs-zod createZodDto → OpenAPI → FE PublicService.
 */

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SwitchTenantRequestSchema = z.object({
  tenant_id: z.string().uuid(),
});

export const SwitchTenantResponseSchema = z.object({
  tenant_id: z.string().uuid(),
  slug: z.string(),
  redirect_url: z.string(),
});

export type SwitchTenantRequestType = z.infer<typeof SwitchTenantRequestSchema>;
export type SwitchTenantResponseType = z.infer<typeof SwitchTenantResponseSchema>;

export class SwitchTenantRequestDto extends createZodDto(SwitchTenantRequestSchema) {}
export class SwitchTenantResponseDto extends createZodDto(SwitchTenantResponseSchema) {}
