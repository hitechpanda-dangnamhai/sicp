-- ============================================================================
-- V015__llm_traces.sql — durable LLM trace + cost spine (S-P0-03/T03a, W-93)
-- ============================================================================
-- Thi hành ADR-054 §2 (cost/trace spine). Bảng `llm_traces` ghi 1 row / LLM
-- call (gồm fallback) — nguồn dữ liệu cost-per-intent (NFR §1) + eval baseline.
--
-- Quyết định kiến trúc (ADR-054 §2 + ADR-040/046 multi-tenant):
--  - PARTITION BY RANGE (created_at) monthly NGAY TỪ ĐẦU — KHÔNG lặp lại W-66
--    (V001 behavior_events tạo 3 tháng rồi hết → INSERT FAIL). Housekeeper
--    (apps/workers) roll +N tháng; migration tự bù tới 2026m12 (an toàn kép,
--    bài học V014). PK PHẢI gồm partition key → PRIMARY KEY (id, created_at).
--  - tenant_id NOT NULL + RLS policy tenant_isolation (fail-closed:
--    current_setting('app.tenant_id', true)::uuid = NULL → 0 row) — mirror
--    V011. ENABLE RLS trên parent VÀ từng partition (defense-in-depth: query
--    partition trực tiếp không hưởng RLS của parent — V011 §3h).
--  - KHÔNG lưu raw prompt/response (PII + dung lượng — ADR-041). Cột
--    `payload_ref` NULL = chỗ cho object-store ref khi C4-media xong. Eval T04
--    dùng fixture riêng, không cần raw từ trace.
--  - `status` để VARCHAR KHÔNG CHECK constraint — enum thực ('ok'/'error'/
--    'fallback'…) do T03b (writer `traces.append` + llm_client) chốt; khoá
--    CHECK ở đây = ép T03b migration mới khi cần value khác (tránh STOP §4).
--  - cost_usd NUMERIC(12,6): tiền → không float (sai số luỹ kế). 6 chữ số thập
--    phân đủ cho giá $/1K-token (vd $0.000125/tok).
--
-- breaking: KHÔNG (bảng net-new, không đụng schema cũ).
-- forward-only (DoD §5). Idempotent: CREATE ... IF NOT EXISTS, policy/grant
-- guarded → re-apply an toàn.
--
-- ROLLBACK (chỉ khi llm_traces RỖNG — mất data nếu có row):
--   DROP TABLE IF EXISTS llm_traces CASCADE;   -- partitions drop theo CASCADE
-- ============================================================================

-- ── 1. Parent partitioned table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS llm_traces (
  id           UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id),
  intent_type  VARCHAR(80),                  -- intent của graph (NULL nếu chưa phân loại)
  rid          VARCHAR(64),                  -- request id (correlate Gateway→AI→MCP)
  node         VARCHAR(80),                  -- graph node phát ra call
  provider     VARCHAR(40)  NOT NULL,        -- 'gemini' | 'openai' | …
  model        VARCHAR(120) NOT NULL,        -- model id cụ thể
  tokens_in    INTEGER,                      -- usage_metadata (NULL nếu provider không trả)
  tokens_out   INTEGER,
  cost_usd     NUMERIC(12, 6),               -- tính từ bảng giá env/config (T03b)
  latency_ms   INTEGER,
  status       VARCHAR(20)  NOT NULL,        -- 'ok' | 'error' | 'fallback' (enum chốt ở T03b)
  error_code   VARCHAR(80),                  -- NULL khi status='ok'
  payload_ref  VARCHAR(255),                 -- ADR-041: NULL placeholder cho object-store ref
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)               -- PK gồm partition key (PG yêu cầu)
) PARTITION BY RANGE (created_at);

COMMENT ON TABLE llm_traces IS 'Durable LLM trace + cost spine (ADR-054 §2). 1 row/LLM call. Partition RANGE monthly. KHÔNG raw prompt/response (ADR-041).';

-- ── 2. Monthly partitions: tháng hiện tại (2026m06) → 2026m12 (an toàn kép) ──
-- Housekeeper roll +N tháng động về sau; migration bù sẵn tới cuối 2026 phòng
-- worker chưa deploy (bài học W-66 / V014). Idempotent CREATE IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS llm_traces_y2026m06 PARTITION OF llm_traces
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS llm_traces_y2026m07 PARTITION OF llm_traces
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS llm_traces_y2026m08 PARTITION OF llm_traces
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS llm_traces_y2026m09 PARTITION OF llm_traces
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS llm_traces_y2026m10 PARTITION OF llm_traces
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS llm_traces_y2026m11 PARTITION OF llm_traces
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS llm_traces_y2026m12 PARTITION OF llm_traces
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- ── 3. Index field query (apply lên parent → cascade xuống partitions PG11+) ─
CREATE INDEX IF NOT EXISTS idx_llm_traces_tenant_time
  ON llm_traces (tenant_id, created_at DESC);              -- time-series per tenant
CREATE INDEX IF NOT EXISTS idx_llm_traces_intent
  ON llm_traces (tenant_id, intent_type, created_at DESC); -- cost-by-intent
CREATE INDEX IF NOT EXISTS idx_llm_traces_model
  ON llm_traces (tenant_id, model, provider);              -- cost-by-model/provider
CREATE INDEX IF NOT EXISTS idx_llm_traces_rid
  ON llm_traces (rid);                                     -- correlate 1 request

-- ── 4. RLS — parent ─────────────────────────────────────────────────────────
ALTER TABLE llm_traces ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'llm_traces' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON llm_traces
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END
$$;

-- ── 5. RLS — từng partition trực tiếp (defense-in-depth, mirror V011 §3h) ────
-- ENABLE RLS trên parent KHÔNG tự áp khi query TRỰC TIẾP partition con
-- (relrowsecurity per-table). App chỉ query parent, nhưng bật trên mọi
-- partition để query partition trực tiếp cũng fail-closed.
DO $$
DECLARE
  part        regclass;
  part_name   text;
BEGIN
  FOR part IN
    SELECT inhrelid::regclass
    FROM pg_inherits
    WHERE inhparent = 'llm_traces'::regclass
  LOOP
    part_name := (SELECT relname FROM pg_class WHERE oid = part);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', part);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = part_name AND policyname = 'tenant_isolation'
    ) THEN
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %s '
        'USING (tenant_id = current_setting(''app.tenant_id'', true)::uuid) '
        'WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true)::uuid)',
        part
      );
    END IF;
  END LOOP;
END
$$;

-- ── 6. GRANT cho icp_app (runtime role, NOBYPASSRLS) ────────────────────────
-- ALTER DEFAULT PRIVILEGES (V011 §7) đã cấp DML cho object icp tạo về sau,
-- nhưng re-GRANT tường minh = idempotent + phủ cả partition direct-access.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO icp_app;

-- ============================================================================
-- END V015__llm_traces.sql
-- ============================================================================
