/**
 * apps/gateway/src/common/throttler/throttle.config.ts
 *
 * S-P0-02/T03 W-60 — per-route throttle override config. @Throttle decorator
 * nhận metadata STATIC lúc class-load → đọc process.env trực tiếp (container
 * env_file đã set TRƯỚC khi node start; fallback = default khớp env.schema).
 * Global short/long (per-min/per-hour) định nghĩa ở throttler-app.module.
 *
 * Caveat (ratify Plan KI#1 T03): key=IP ở perimeter là ĐÚNG — chặn brute-force
 * phải xảy ra TRƯỚC khi tốn công auth. Hệ quả: nhiều user sau 1 NAT chia chung
 * quota /intent per-IP. Limit env-tunable (đủ); true per-user/per-tenant quota
 * = tầng app W-99/C-tenant (KHÔNG phải tầng edge). resolveTracker giữ `u:<id>`.
 */

const n = (key: string, dflt: number): number => {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? v : dflt;
};

const MIN = 60_000;
const HOUR = 3_600_000;

/** /auth/login: 5/min/IP + 20/h/IP (pre-auth → tracker=IP, xem throttler.guard). */
export const THROTTLE_LOGIN = {
  short: { limit: n('THROTTLE_LOGIN_LIMIT', 5), ttl: MIN },
  long: { limit: n('THROTTLE_LOGIN_HOURLY_LIMIT', 20), ttl: HOUR },
};

/** /auth/forgot-password: 3/h/IP (chỉ cửa sổ giờ — kèm @SkipThrottle({short:true})). */
export const THROTTLE_FORGOT = {
  long: { limit: n('THROTTLE_FORGOT_HOURLY_LIMIT', 3), ttl: HOUR },
};

/** POST /intent: 20/min (per-user nếu authed, else IP — xem throttler.guard). */
export const THROTTLE_INTENT = {
  short: { limit: n('THROTTLE_INTENT_LIMIT', 20), ttl: MIN },
};
