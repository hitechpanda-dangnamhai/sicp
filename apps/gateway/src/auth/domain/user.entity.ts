/**
 * apps/gateway/src/auth/domain/user.entity.ts
 *
 * Domain layer types — `User` + `Session` representing PG schema shapes per
 * `02_DATA_MODEL.md §1` (post-V009). No class, no behavior — pure types per
 * Clean Architecture light. Repos (infrastructure/) return these shapes;
 * use-cases (application/) consume; controller maps to response DTOs.
 *
 * Why pure types not classes:
 *   - Hackathon scope: zero benefit from class-based entities (no domain
 *     methods, no invariant enforcement beyond DB constraints).
 *   - TypeScript types compile to nothing → smaller bundle.
 *   - Matches S-02 T06 `BehaviorEvent` pattern in @icp/shared-types.
 *
 * S-03 T02 emit.
 */

/**
 * User aggregate root — mirrors PG `users` table post-V009.
 * `password_hash` stays in domain layer; controller MUST NOT leak it in
 * response. Use `PublicUser` shape (omit password_hash) for serialization.
 */
export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: 'merchant' | 'customer' | 'admin';
  display_name: string;
  created_at: Date;
}

/**
 * User shape safe to serialize over HTTP (`/auth/login` response + `/auth/me`).
 * Omits `password_hash` + adds derived `avatar_initials` computed server-side
 * per S-03 C-05.
 */
export interface PublicUser {
  id: string;
  email: string;
  role: 'merchant' | 'customer' | 'admin';
  display_name: string;
  avatar_initials: string;
}

/**
 * /auth/me response shape — `PublicUser` + `last_login_at` + `session_expires_at`
 * from sessions MAX(issued_at) / MAX(expires_at) queries.
 *
 * S-03 T02: `last_login_at` per C-05 + C-07.
 * S-03 T05 (Phiên N+2): `session_expires_at` per D-24 + C-33 — additive field
 * for FE state-F profile page "Phiên: Còn Xh" countdown (computed-on-render).
 */
export interface MeResponse extends PublicUser {
  last_login_at: string | null; // ISO8601 or null if no prior session
  /** ISO8601 UTC of MAX(sessions.expires_at) where user has active session;
   *  null if no active session. Pattern: D-24 BE additive extension. */
  session_expires_at: string | null;
}

/**
 * Session aggregate — mirrors PG `sessions` table post-V009.
 * `refresh_token_hash` is SHA-256 hex(64) of raw refresh UUID — raw token
 * lives only in Set-Cookie header to client, NEVER persisted.
 */
export interface Session {
  id: string;
  user_id: string;
  jti: string;
  refresh_token_hash: string;
  issued_at: Date;
  expires_at: Date;         // access JWT expiry (24h default)
  refresh_expires_at: Date; // refresh token expiry (30d default)
  revoked_at: Date | null;
}

/**
 * Cached session value stored in Redis under key `session:{jti}` — denormalized
 * subset for fast Guard verify without PG hop. TTL = JWT_ACCESS_TTL_HOURS *
 * 3600s. On logout: DEL `session:{jti}` immediately → Guard falls back to PG
 * revoked_at check (safer than relying on TTL expiry alone).
 */
export interface CachedSession {
  user_id: string;
  email: string;
  role: 'merchant' | 'customer' | 'admin';
  display_name: string;
}

/**
 * Compute avatar initials per S-03 C-05 LOCKED algorithm.
 * NFD-normalize Vietnamese diacritics → strip combining marks → split words
 * → first 2 word-initials uppercased.
 *
 * Examples:
 *   "Anh Nam"        → "AN"
 *   "Đặng Hữu Khoa"  → "DH"  (post-NFD: "Dang Huu Khoa")
 *   "admin"          → "A"
 *   ""               → "?"   (fallback — display_name NOT NULL post-V009,
 *                              this defensive only)
 */
export function computeAvatarInitials(displayName: string): string {
  const normalized = displayName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Vietnamese đ/Đ is NOT a combining mark — handle explicitly
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim();
  if (!normalized) return '?';
  const words = normalized.split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';
}
