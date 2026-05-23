/**
 * `@icp/shared-types/behavior/auth-events.ts`
 *
 * **Behavior Event Properties Schemas — Auth & Session subset (07_BEHAVIOR §3.1).**
 *
 * Auth events emitted server-side by Gateway `AuthService` via `TrackingService`
 * loopback per S-03 T03 (NOT FE-emit per ADR-019 + Rule 6 — server is single
 * source of truth for `signed_in`/`signed_out`; FE `auth.password_reset_requested`
 * via Server Action callback to Gateway endpoint, server emits).
 *
 * **Append rule (per ADR-014 catalog-first):** New event type registered here →
 * append entry to `PROPERTIES_SCHEMA_MAP` in `./catalog.ts` → append Section A/B
 * row to `LOG_CATALOG.md` (ops + behavior catalog) → emit via tracker.
 *
 * @see docs/07_BEHAVIOR_LOGS.md §3.1 (Auth & Session event catalog — LOCKED)
 * @see docs/LOG_CATALOG.md Section B "Session & Auth" (registry alignment)
 *
 * S-03 T03 emit (Phiên 33).
 */

import { z } from 'zod';

/**
 * `auth.signed_in` — emitted post-login_succeeded by Gateway AuthService.
 *
 * Currently single auth method: `password` (BCrypt cost 10 per S00b-D-01).
 * Future methods (OAuth/passkey/etc) extend enum per Phase 6+ ADR.
 */
export const AuthSignedInPropertiesSchema = z
  .object({
    method: z.enum(['password']),
  })
  .strict();

/**
 * `auth.signed_out` — emitted post-logout_succeeded by Gateway AuthService.
 *
 * Intentionally empty properties — `user_id` + `session_id` (jti) on the
 * envelope already capture all needed dimensions for analytics. No reason
 * field per session LAW (UI logout button is the only trigger Phase 02).
 */
export const AuthSignedOutPropertiesSchema = z.object({}).strict();

/**
 * `auth.password_reset_requested` — emitted post-forgot-password handler by
 * Gateway AuthService (stub Phase 02 per S-03 C-03 — NO real SMTP).
 *
 * `email_hash` = SHA-256 hex truncated 16 chars per PII redact rules
 * (matches T02 `auth.service.ts` `hashEmail()` helper). Raw email NEVER
 * stored in behavior_events table per 07_BEHAVIOR §9.1 PII Handling.
 */
export const AuthPasswordResetRequestedPropertiesSchema = z
  .object({
    email_hash: z.string().length(16),
  })
  .strict();
