-- V008__shopee_prices_mock.sql
-- Mock Shopee price reference data for Intent 01 (Import by Image).
-- Seeded by apps/workers/src/shopee-mock-seed-worker.ts at startup (idempotent).
-- Real Shopee crawler is OUT OF SCOPE for ICP project — separate project handles crawling.
-- 
-- Decision: ADR-032 (supersedes ADR-008 JSON file approach).
-- Date: 2026-05-18
-- 
-- Numbering note: V004 (promotions) and V007 (media_uploads) skipped per
-- PHASE_00_HANDOFF.md "Items deferred". V008 is the next available slot.

-- ============================================================================
-- 1. SHOPEE_PRICES_MOCK
-- ============================================================================

CREATE TABLE shopee_prices_mock (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Categorization (query key for MCP shopee.price_range tool)
  category      VARCHAR(100) NOT NULL,
  attributes    JSONB NOT NULL DEFAULT '{}',
    -- {brand?: string, size?: string, variant?: string}
    -- Match logic in MCP tool: WHERE category = $1 AND attributes @> $2::jsonb

  -- Aggregates (for Intent 01 state B — Shopee compact card on prefilled form)
  min_price     BIGINT NOT NULL CHECK (min_price >= 0),
  avg_price     BIGINT NOT NULL CHECK (avg_price >= min_price),
  max_price     BIGINT NOT NULL CHECK (max_price >= avg_price),
  sample_count  INT    NOT NULL CHECK (sample_count > 0),
  review_count  INT    NOT NULL DEFAULT 0,

  -- Sample products (for Intent 01 state D — Shopee expanded panel)
  -- Display-only data, not queried independently
  samples       JSONB NOT NULL DEFAULT '[]',
    -- Format:
    -- [
    --   {
    --     "title": "Nước tương Maggi đậu nành nguyên chất 200ml",
    --     "store": "Maggi Official",
    --     "price": 22000,
    --     "rating": 4.9,         -- nullable (use null if no rating)
    --     "sold_count": 8500
    --   },
    --   ...
    -- ]
    -- Typically 3-5 entries, ordered by price ASC

  -- Lifecycle
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Uniqueness: 1 row per (category, attributes) combo
  UNIQUE (category, attributes)
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

-- Query pattern 1: "find by category" (broad fallback when attributes don't match)
CREATE INDEX idx_shopee_category ON shopee_prices_mock(category);

-- Query pattern 2: "find by attributes containment" (MCP shopee.price_range hot path)
-- Example: WHERE attributes @> '{"brand":"Maggi"}'::jsonb
CREATE INDEX idx_shopee_attrs ON shopee_prices_mock USING GIN (attributes);

-- ============================================================================
-- 3. COMMENTS
-- ============================================================================

COMMENT ON TABLE shopee_prices_mock IS
  'Mock Shopee price reference for Intent 01 Import by Image. Seeded at startup by shopee-mock-seed-worker. Per ADR-032 (supersedes ADR-008). Real crawler is out of scope for ICP project.';

COMMENT ON COLUMN shopee_prices_mock.attributes IS
  'Match key via JSONB containment; MCP shopee.price_range query: WHERE attributes @> {"brand":"Maggi","size":"200ml"}';

COMMENT ON COLUMN shopee_prices_mock.samples IS
  'Display-only data for state D expanded panel; not queried independently. Schema validated by seed worker (TypeScript Zod), not by Postgres CHECK.';

COMMENT ON COLUMN shopee_prices_mock.updated_at IS
  'Set by seed worker on insert; can be re-run to refresh demo data with deterministic timestamps.';

-- ============================================================================
-- 4. EXAMPLE SEED DATA (1 row for reference)
-- ============================================================================
-- Actual seed worker (apps/workers/src/shopee-mock-seed-worker.ts) generates
-- ~200 rows covering 10 categories × ~20 attribute combos.
-- This example matches the Intent 01 state D mockup (Maggi nước tương 200ml).

INSERT INTO shopee_prices_mock (
  category, attributes,
  min_price, avg_price, max_price, sample_count, review_count,
  samples
)
VALUES (
  'nuoc_tuong',
  '{"brand":"Maggi","size":"200ml"}'::jsonb,
  22000, 24500, 28000, 5, 1247,
  '[
    {
      "title": "Nước tương Maggi đậu nành nguyên chất 200ml",
      "store": "Maggi Official",
      "price": 22000,
      "rating": 4.9,
      "sold_count": 8500
    },
    {
      "title": "Maggi nước tương đậu nành chai 200ml",
      "store": "SiêuThị Online",
      "price": 24000,
      "rating": 4.7,
      "sold_count": 3200
    },
    {
      "title": "Nước tương Maggi cao cấp 200ml + tặng kèm",
      "store": "Premium Store",
      "price": 26000,
      "rating": 4.8,
      "sold_count": 1500
    },
    {
      "title": "Maggi nước tương đậu nành 200ml combo 3 chai",
      "store": "Vinmart+",
      "price": 28000,
      "rating": 5.0,
      "sold_count": 920
    }
  ]'::jsonb
)
ON CONFLICT (category, attributes) DO NOTHING;
