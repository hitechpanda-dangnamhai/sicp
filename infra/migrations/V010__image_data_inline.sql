-- V010__image_data_inline.sql
-- S-07 T01 migration per C-S07-B Option Β — ADD image_data TEXT column
-- inline base64 storage for Intent 01 import flow (~50KB JPEG → ~67KB base64).
--
-- Decision: ADR-01-01 (declared local handoff) — base64 inline simplicity for
-- hackathon; future CDN/external URLs would use existing image_url VARCHAR(500).
-- Cross-ref: docs/02_DATA_MODEL.md §1 products DDL (amended T01.G atomic batch).
--
-- Numbering: V001..V003, V005, V006, V008, V009 used; V004 (promotions) +
-- V007 (media_uploads) intentionally skipped per 09_FIELD_AUDIT §11. V010 next.
--
-- Idempotency: ADD COLUMN IF NOT EXISTS (Postgres 9.6+).
--
-- Reuse-max: image_url VARCHAR(500) reserved untouched for future CDN swap;
-- image_data nullable so pre-S-07 rows + non-image-flow imports remain valid.
-- Vespa schema unchanged (image_data NOT indexed — display-only column).

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_data TEXT NULL;

COMMENT ON COLUMN products.image_data IS
  'S-07 P03 base64-inline image data (~67KB for 50KB JPEG). NULL for products
   imported pre-S-07 or via non-image flows. image_url VARCHAR(500) reserved
   for future CDN/external URLs (NULL during S-07 hackathon).';
