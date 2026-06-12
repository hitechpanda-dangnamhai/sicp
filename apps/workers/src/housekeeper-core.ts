/**
 * apps/workers/src/housekeeper-core.ts
 *
 * Pure logic của housekeeper (KHÔNG side-effect: không OTel/pg/cron) → unit-test
 * trực tiếp trong housekeeper.spec.ts mà không khởi động SDK. housekeeper.ts
 * import từ đây + ráp với I/O.
 */

import type Redis from 'ioredis';

export interface PartitionSpec {
  /** Tên partition: behavior_events_yYYYYmMM */
  name: string;
  /** Cận dưới inclusive, 'YYYY-MM-01' */
  from: string;
  /** Cận trên exclusive, 'YYYY-MM-01' của tháng kế */
  to: string;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');
const firstOfMonth = (y: number, m: number): string => `${y}-${pad2(m)}-01`; // m: 1..12

/**
 * Sinh spec partition cho tháng hiện tại + `monthsAhead` tháng tới (inclusive).
 * monthsAhead=3 lúc 2026-06 → m06,m07,m08,m09 (4 partition). Idempotent ở tầng
 * DDL (CREATE IF NOT EXISTS). PURE (nhận `now` để test deterministic).
 */
export function computeRollingPartitions(now: Date, monthsAhead: number): PartitionSpec[] {
  const specs: PartitionSpec[] = [];
  const baseYear = now.getUTCFullYear();
  const baseMonth0 = now.getUTCMonth(); // 0..11
  for (let i = 0; i <= monthsAhead; i++) {
    const d = new Date(Date.UTC(baseYear, baseMonth0 + i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1; // 1..12
    const next = new Date(Date.UTC(y, m, 1)); // tháng kế
    specs.push({
      name: `behavior_events_y${y}m${pad2(m)}`,
      from: firstOfMonth(y, m),
      to: firstOfMonth(next.getUTCFullYear(), next.getUTCMonth() + 1),
    });
  }
  return specs;
}

/** DDL idempotent tạo 1 partition. Identifier sinh từ số (không user input → an toàn). */
export function buildPartitionDDL(spec: PartitionSpec): string {
  return (
    `CREATE TABLE IF NOT EXISTS ${spec.name} PARTITION OF behavior_events ` +
    `FOR VALUES FROM ('${spec.from}') TO ('${spec.to}');`
  );
}

/**
 * Thử giành lock tick: SET key=instanceId NX PX ttl → 'OK' nếu giành được.
 * NX = chỉ set khi chưa tồn tại → ≤1 instance chạy job/tick. TTL = safety nếu
 * worker chết giữa chừng (lock tự hết hạn).
 */
export async function acquireLeaderLock(
  redis: Pick<Redis, 'set'>,
  key: string,
  instanceId: string,
  ttlMs: number,
): Promise<boolean> {
  const res = await redis.set(key, instanceId, 'PX', ttlMs, 'NX');
  return res === 'OK';
}

/** Release lock CHỈ khi value == instanceId (CAS qua Lua) — không xoá lock kẻ khác. */
export const RELEASE_LUA =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

export async function releaseLeaderLock(
  redis: Pick<Redis, 'eval'>,
  key: string,
  instanceId: string,
): Promise<void> {
  await redis.eval(RELEASE_LUA, 1, key, instanceId);
}
