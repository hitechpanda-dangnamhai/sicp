-- V005__payment_metadata.sql
-- Bổ sung payment context cho Intent 06 (failure_reason, payment_method, metadata)
-- Cần cho demo compensation flow (Phase 04): payment failed → SSE → toast → retry hoặc refund cart.

-- 1. ALTER transactions table
ALTER TABLE transactions
  ADD COLUMN payment_method  VARCHAR(40) NOT NULL DEFAULT 'mock',
  ADD COLUMN failure_reason  TEXT,
  ADD COLUMN metadata        JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN provider_txn_id VARCHAR(120),         -- External provider reference
  ADD COLUMN completed_at    TIMESTAMPTZ;          -- When provider acknowledged

-- 2. INDEX for retry query (find failed transactions per user)
CREATE INDEX idx_transactions_user_failed
  ON transactions(user_id, created_at DESC)
  WHERE status = 'failed';

-- 3. CHECK constraint payment_method (extensible)
ALTER TABLE transactions
  ADD CONSTRAINT chk_payment_method
  CHECK (payment_method IN ('mock', 'momo', 'zalopay', 'bank_transfer', 'cod'));

-- 4. COMMENTS
COMMENT ON COLUMN transactions.payment_method IS 'Provider used; for hackathon always "mock"';
COMMENT ON COLUMN transactions.failure_reason IS 'Human-readable reason for failed transactions (shown to user)';
COMMENT ON COLUMN transactions.metadata IS 'Provider-specific response data, retry counters, fraud signals';
COMMENT ON COLUMN transactions.provider_txn_id IS 'External transaction ID from provider for reconciliation';
COMMENT ON COLUMN transactions.completed_at IS 'Set when provider confirms paid or failed (different from updated_at)';

-- 5. Backfill (existing transactions get sensible defaults)
UPDATE transactions
SET payment_method = 'mock',
    completed_at = updated_at
WHERE payment_method IS NULL OR completed_at IS NULL;
