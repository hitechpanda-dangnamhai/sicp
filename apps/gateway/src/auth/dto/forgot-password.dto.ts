/**
 * apps/gateway/src/auth/dto/forgot-password.dto.ts
 *
 * Request + Response DTOs for `POST /api/v1/auth/forgot-password` stub
 * endpoint per `03_API_CONTRACTS.md §1.1` line 42-44 (S-03 C-03 RESOLVED).
 *
 * **Phase 02 stub semantics (no real SMTP):**
 *   - Always returns `{ sent: true }` regardless of email existence (no user
 *     enumeration per OWASP — matches `login.dto.ts` no-enumeration pattern).
 *   - Emits `auth.password_reset_requested` behavior event with `{email_hash}`
 *     for analytics correlation.
 *
 * `email` validation: same canonical normalization as `login.dto.ts` (trim +
 * toLowerCase + email format + max 255) — ensures consistent `email_hash`
 * computation across login attempts.
 *
 * S-03 T03 emit (Phiên 33 Batch 4).
 */

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ForgotPasswordSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(255),
  })
  .strict();

export class ForgotPasswordDto extends createZodDto(ForgotPasswordSchema) {}

export const ForgotPasswordResponseSchema = z
  .object({
    sent: z.literal(true),
  })
  .strict();

export class ForgotPasswordResponseDto extends createZodDto(ForgotPasswordResponseSchema) {}
