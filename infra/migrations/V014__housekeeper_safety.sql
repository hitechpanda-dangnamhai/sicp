-- ============================================================================
-- V014__housekeeper_safety.sql — gỡ bom W-66 (an toàn kép) — S-P0-02/T02
-- ============================================================================
-- Bối cảnh: V001:285-290 chỉ tạo partition behavior_events tới m07
-- (FOR VALUES ... TO '2026-08-01'). INSERT occurred_at >= 2026-08-01 → FAIL
-- "no partition of relation found" = HARD-FAIL POST /track từ 2026-08-01 (W-66).
--
-- Worker `apps/workers/src/housekeeper.ts` tạo partition rolling +3 tháng động.
-- V014 = AN TOÀN KÉP: bù sẵn partition tới 2026-12 ngay tại schema, phòng khi
-- worker chưa deploy prod kịp hạn. Idempotent (CREATE TABLE IF NOT EXISTS) →
-- chạy lại không lỗi; trùng với partition worker tạo cũng no-op.
--
-- forward-only. Rollback (chỉ khi partition RỖNG, mất data nếu có row):
--   DROP TABLE IF EXISTS behavior_events_y2026m08, behavior_events_y2026m09,
--     behavior_events_y2026m10, behavior_events_y2026m11, behavior_events_y2026m12;
--
-- ⚠️ STALE (deliverable T02.b "index partial events(published_at)"): index
-- `idx_events_unpublished ON events(created_at) WHERE published_at IS NULL` ĐÃ
-- TỒN TẠI (V001:154) — đã phục vụ relay drain (FIFO unpublished theo created_at).
-- Index `events(published_at) WHERE published_at IS NULL` là REDUNDANT + vô dụng
-- (cột published_at trong partial toàn NULL = 0 selectivity). KHÔNG tạo. (re-verify
-- S-P0-02/T02; ratify ở report).
-- ============================================================================

CREATE TABLE IF NOT EXISTS behavior_events_y2026m08 PARTITION OF behavior_events
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS behavior_events_y2026m09 PARTITION OF behavior_events
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS behavior_events_y2026m10 PARTITION OF behavior_events
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS behavior_events_y2026m11 PARTITION OF behavior_events
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS behavior_events_y2026m12 PARTITION OF behavior_events
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
