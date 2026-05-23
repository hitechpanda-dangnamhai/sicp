/**
 * apps/gateway/src/auth/dto/auth-response.dto.ts
 *
 * Response body shapes for auth endpoints — used by `@ApiResponse({type: ...})`
 * Swagger decorators to document response contract per `03_API_CONTRACTS §1.1`
 * (post Phase 1 inline reconcile).
 *
 * Pattern: nestjs-zod `createZodDto` — same single-source-of-truth as request
 * DTOs. Generates OpenAPI schema → consumed by `pnpm openapi:export` →
 * `@icp/shared-types` FE typed client.
 *
 * IMPORTANT — NO tokens in body per S-03 C-01 + ADR-019:
 *   - LoginResponse: ONLY `{user: PublicUser}`. Tokens in 2 Set-Cookie headers.
 *   - /auth/refresh: 200 + new Set-Cookies; body is empty `{}` (or omitted).
 *   - /auth/logout: 204 No Content; no body.
 *
 * S-03 T02 emit.
 */

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const PublicUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['merchant', 'customer', 'admin']),
  display_name: z.string().min(1).max(100),
  avatar_initials: z.string().min(1).max(2),
});

export const LoginResponseSchema = z.object({
  user: PublicUserSchema,
});

export const MeResponseSchema = PublicUserSchema.extend({
  last_login_at: z.string().datetime().nullable(),
});

export type PublicUserType = z.infer<typeof PublicUserSchema>;
export type LoginResponseType = z.infer<typeof LoginResponseSchema>;
export type MeResponseType = z.infer<typeof MeResponseSchema>;

export class LoginResponseDto extends createZodDto(LoginResponseSchema) {}
export class MeResponseDto extends createZodDto(MeResponseSchema) {}
