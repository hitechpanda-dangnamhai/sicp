/**
 * apps/gateway/src/auth/dto/landing.dto.ts
 *
 * S-P0-01 T02 (ADR-046 amendment c) — GET /api/v1/auth/landing response.
 *
 * User vào root URL (không có /s/<slug>) → BE đọc sessions.last_active_tenant_id
 * → trả nơi cần redirect: `/s/<slug>` (shop dùng gần nhất) hoặc `/onboarding`
 * (chưa từng switch / customer global / tenant đã xoá).
 */

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const LandingResponseSchema = z.object({
  redirect_url: z.string(),
  /** Nguồn quyết định: last_active (có hint) | onboarding (không hint). */
  source: z.enum(['last_active', 'onboarding']),
});

export type LandingResponseType = z.infer<typeof LandingResponseSchema>;

export class LandingResponseDto extends createZodDto(LandingResponseSchema) {}

/**
 * GET /api/v1/auth/tenants — danh sách shop user là member (onboarding/switcher).
 * FE không đọc được tenant_ids (httpOnly JWT) → endpoint join slug/name.
 */
export const MyTenantsResponseSchema = z.object({
  tenants: z.array(
    z.object({
      tenant_id: z.string().uuid(),
      slug: z.string(),
      name: z.string(),
    }),
  ),
});

export type MyTenantsResponseType = z.infer<typeof MyTenantsResponseSchema>;

export class MyTenantsResponseDto extends createZodDto(MyTenantsResponseSchema) {}
