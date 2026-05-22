/**
 * apps/gateway/src/auth/application/forgot-password.use-case.ts
 *
 * Stub forgot-password use-case per S-03 C-03 RESOLVED — Phase 02 stub
 * (NO real SMTP, NO database query, NO user existence check).
 *
 * **Why stub now (rationale):**
 *   - Real password reset flow requires email service (SES/Sendgrid/SMTP) +
 *     reset token table + 1-time-use semantics + rate limiting. Out of
 *     scope Phase 02 per BACKLOG §4 Non-Goals.
 *   - Mockup state-A/B/C "Quên mật khẩu?" link (3 states per S-03 C-03)
 *     requires functional event — emit `auth.password_reset_requested`
 *     captures funnel signal for Phase 6 productionization.
 *
 * **No user enumeration (OWASP):** This use-case does NOT query the database
 * for user existence. Always returns success. AuthController handler likewise
 * swallows errors → always `{sent: true}`. Same shape regardless of:
 *   - email exists in users table
 *   - email is valid format but unknown
 *   - DB outage (use-case has no DB dependency anyway)
 *
 * **Output:** `{ emailHash }` — caller (AuthService) uses it for behavior
 * event properties (per `07_BEHAVIOR §3.1 auth.password_reset_requested`
 * schema requires `email_hash: string` length 16).
 *
 * S-03 T03 emit (Phiên 33 Batch 4).
 */

import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createLogger, type IcpLogPayload } from '../../observability';

export type ForgotPasswordCommand = {
  email: string;
};

export type ForgotPasswordResult = {
  emailHash: string;
};

@Injectable()
export class ForgotPasswordUseCase {
  private readonly log = createLogger({
    service: 'gateway',
    version: process.env.APP_VERSION ?? '0.0.1',
    env: process.env.NODE_ENV ?? 'dev',
  }).child({ component: 'forgot-password.use-case' });

  /**
   * Compute email_hash and log password reset request. No DB query, no SMTP.
   *
   * @param cmd.email — already normalized (trim + toLowerCase) by DTO
   * @returns `{ emailHash }` — SHA-256 hex truncated 16 chars per PII redact
   */
  async execute(cmd: ForgotPasswordCommand): Promise<ForgotPasswordResult> {
    const emailHash = this.hashEmail(cmd.email);

    this.log.info(
      {
        message: 'auth.password_reset_requested',
        extras: { email_hash: emailHash },
      } as IcpLogPayload,
      'auth.password_reset_requested',
    );

    return { emailHash };
  }

  private hashEmail(email: string): string {
    return createHash('sha256').update(email).digest('hex').slice(0, 16);
  }
}
