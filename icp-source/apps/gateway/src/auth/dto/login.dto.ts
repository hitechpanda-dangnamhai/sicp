/**
 * apps/gateway/src/auth/dto/login.dto.ts
 *
 * POST /api/v1/auth/login request body DTO.
 *
 * Pattern: nestjs-zod `createZodDto` — Zod schema is single source of truth;
 * `LoginDto` class extends generated base for `@Body() body: LoginDto` typed
 * binding + Swagger introspection (per S-02 T01 nestjs-zod pattern).
 *
 * Field semantics per `03_API_CONTRACTS §1.1` (post Phase 1 inline reconcile):
 *   - `email`: trimmed lowercase RFC 5322 basic
 *   - `password`: ≥6 chars per S-01 LoginForm constraint
 *   - `remember_me`: optional boolean; default false. Controls cookie Max-Age
 *     only (per S-03 C-04 + AC-2). JWT TTL stays fixed 24h regardless.
 *
 * S-03 T02 emit.
 */

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: 'Invalid email format' })
    .max(255, { message: 'Email exceeds 255 chars' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters' })
    .max(255, { message: 'Password exceeds 255 chars' }),
  remember_me: z.boolean().optional().default(false),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export class LoginDto extends createZodDto(LoginSchema) {}
