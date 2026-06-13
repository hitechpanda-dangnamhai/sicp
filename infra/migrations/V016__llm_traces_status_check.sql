-- ============================================================================
-- V016__llm_traces_status_check.sql — lock llm_traces.status enum (S-P0-03/T03b)
-- ============================================================================
-- T03a (V015) cố ý hoãn CHECK constraint trên `status` để T03b — writer
-- (traces.append + llm_client.py) — chốt enum. Writer ghi 1 row / provider
-- attempt: 'ok' (call thành công) | 'error' (call lỗi, error_code giữ chi tiết
-- E_LLM_TIMEOUT/E_LLM_ERROR/...). Provider field phân biệt fallback (gemini vs
-- openai) → KHÔNG cần status='fallback' riêng.
--
-- CHECK áp lên parent partitioned table → cascade mọi partition (PG11+).
-- Guarded (ADD CONSTRAINT không có IF NOT EXISTS <PG16) → idempotent re-apply.
--
-- breaking: KHÔNG (bảng llm_traces chưa có data prod; writer chỉ ghi 'ok'/'error').
-- forward-only.
-- ROLLBACK:
--   ALTER TABLE llm_traces DROP CONSTRAINT IF EXISTS chk_llm_traces_status;
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_llm_traces_status'
  ) THEN
    ALTER TABLE llm_traces
      ADD CONSTRAINT chk_llm_traces_status CHECK (status IN ('ok', 'error'));
  END IF;
END
$$;

-- ============================================================================
-- END V016__llm_traces_status_check.sql
-- ============================================================================
