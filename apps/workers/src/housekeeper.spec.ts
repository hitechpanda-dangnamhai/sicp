/**
 * apps/workers/src/housekeeper.spec.ts — unit test pure logic housekeeper-core.
 * Test I/O (partition INSERT, matview refresh, idempotent 2×, CONCURRENTLY,
 * kill/restart) = integration bash `infra/migrations/tests/test_v014_housekeeper.sh`.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  computeRollingPartitions,
  buildPartitionDDL,
  acquireLeaderLock,
  releaseLeaderLock,
  RELEASE_LUA,
  PARTITIONED_TABLES,
} from './housekeeper-core';

describe('computeRollingPartitions', () => {
  it('sinh tháng hiện tại + N tháng tới (monthsAhead=3 → 4 partition)', () => {
    const specs = computeRollingPartitions(new Date('2026-06-13T10:00:00Z'), 3);
    expect(specs.map((s) => s.name)).toEqual([
      'behavior_events_y2026m06',
      'behavior_events_y2026m07',
      'behavior_events_y2026m08',
      'behavior_events_y2026m09',
    ]);
  });

  it('range from/to đúng biên tháng, exclusive cận trên', () => {
    const specs = computeRollingPartitions(new Date('2026-06-13T10:00:00Z'), 3);
    expect(specs[0]).toEqual({
      name: 'behavior_events_y2026m06',
      parent: 'behavior_events',
      from: '2026-06-01',
      to: '2026-07-01',
    });
    // partition phủ tới 2026-10-01 → INSERT dated 2026-09 thành công (gỡ W-66).
    expect(specs[3]).toEqual({
      name: 'behavior_events_y2026m09',
      parent: 'behavior_events',
      from: '2026-09-01',
      to: '2026-10-01',
    });
  });

  it('llm_traces (V015): parent override → tên + DDL theo llm_traces (W-93)', () => {
    const specs = computeRollingPartitions(new Date('2026-06-13T10:00:00Z'), 3, 'llm_traces');
    expect(specs.map((s) => s.name)).toEqual([
      'llm_traces_y2026m06',
      'llm_traces_y2026m07',
      'llm_traces_y2026m08',
      'llm_traces_y2026m09',
    ]);
    expect(specs[0]).toEqual({
      name: 'llm_traces_y2026m06',
      parent: 'llm_traces',
      from: '2026-06-01',
      to: '2026-07-01',
    });
  });

  it('vắt qua ranh giới năm (Dec → Jan kế)', () => {
    const specs = computeRollingPartitions(new Date('2026-12-01T00:00:00Z'), 1);
    expect(specs.map((s) => s.name)).toEqual([
      'behavior_events_y2026m12',
      'behavior_events_y2027m01',
    ]);
    expect(specs[0].to).toBe('2027-01-01');
    expect(specs[1]).toEqual({
      name: 'behavior_events_y2027m01',
      parent: 'behavior_events',
      from: '2027-01-01',
      to: '2027-02-01',
    });
  });

  it('deterministic — cùng now → cùng spec (idempotent danh tính partition)', () => {
    const now = new Date('2026-08-15T00:00:00Z');
    expect(computeRollingPartitions(now, 3)).toEqual(computeRollingPartitions(now, 3));
  });
});

describe('PARTITIONED_TABLES', () => {
  it('gồm behavior_events + llm_traces (V015) — Single Home danh sách', () => {
    expect(PARTITIONED_TABLES).toContain('behavior_events');
    expect(PARTITIONED_TABLES).toContain('llm_traces');
  });
});

describe('buildPartitionDDL', () => {
  it('CREATE TABLE IF NOT EXISTS ... PARTITION OF (idempotent)', () => {
    const ddl = buildPartitionDDL({
      name: 'behavior_events_y2026m10',
      parent: 'behavior_events',
      from: '2026-10-01',
      to: '2026-11-01',
    });
    expect(ddl).toBe(
      "CREATE TABLE IF NOT EXISTS behavior_events_y2026m10 PARTITION OF behavior_events " +
        "FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');",
    );
  });

  it('llm_traces partition DDL theo parent override (W-93)', () => {
    const ddl = buildPartitionDDL({
      name: 'llm_traces_y2026m10',
      parent: 'llm_traces',
      from: '2026-10-01',
      to: '2026-11-01',
    });
    expect(ddl).toBe(
      "CREATE TABLE IF NOT EXISTS llm_traces_y2026m10 PARTITION OF llm_traces " +
        "FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');",
    );
  });
});

describe('acquireLeaderLock', () => {
  it('SET NX PX → true khi giành được lock', async () => {
    const set = vi.fn().mockResolvedValue('OK');
    const ok = await acquireLeaderLock({ set } as never, 'housekeeper:lock:matview', 'inst-1', 240000);
    expect(ok).toBe(true);
    expect(set).toHaveBeenCalledWith('housekeeper:lock:matview', 'inst-1', 'PX', 240000, 'NX');
  });

  it('false khi lock đã bị instance khác giữ (SET trả null)', async () => {
    const set = vi.fn().mockResolvedValue(null);
    const ok = await acquireLeaderLock({ set } as never, 'k', 'inst-2', 1000);
    expect(ok).toBe(false);
  });
});

describe('releaseLeaderLock', () => {
  it('eval Lua CAS với key + instanceId (không xoá lock kẻ khác)', async () => {
    const evalFn = vi.fn().mockResolvedValue(1);
    await releaseLeaderLock({ eval: evalFn } as never, 'housekeeper:lock:partition', 'inst-1');
    expect(evalFn).toHaveBeenCalledWith(RELEASE_LUA, 1, 'housekeeper:lock:partition', 'inst-1');
  });
});
