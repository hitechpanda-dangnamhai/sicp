-- V002__product_enrichment.sql
-- Bổ sung các fields cần thiết cho UI Product Card (Phase 02+)
-- Audit: rating, sold_count, original_price thiếu trong V001

-- 1. Bổ sung columns vào products (denormalized cho query nhanh)
ALTER TABLE products
  ADD COLUMN brand           VARCHAR(100),
  ADD COLUMN original_price  BIGINT,
  ADD COLUMN rating_avg      REAL DEFAULT 0,
  ADD COLUMN rating_count    INT DEFAULT 0,
  ADD COLUMN sold_count      INT DEFAULT 0,
  ADD COLUMN image_gradient  VARCHAR(50),       -- '#FB923C,#EA580C' fallback khi image_url NULL
  ADD COLUMN icon_hint       VARCHAR(40);       -- 'ti-bottle' Tabler icon name fallback

-- 2. Backfill brand từ attributes JSONB (existing rows)
UPDATE products
SET brand = attributes->>'brand'
WHERE attributes ? 'brand';

-- 3. Index cho sorted queries
CREATE INDEX idx_products_sold_count ON products(sold_count DESC) WHERE status = 'active';
CREATE INDEX idx_products_rating_avg ON products(rating_avg DESC) WHERE status = 'active' AND rating_count >= 3;

-- 4. PRODUCT_REVIEWS (Phase 03+ collect ratings)
CREATE TABLE product_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  order_id    UUID REFERENCES orders(id),         -- verified purchase
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, user_id, order_id)          -- 1 review per purchase
);
CREATE INDEX idx_reviews_product ON product_reviews(product_id, created_at DESC);

-- 5. Trigger auto-update rating_avg, rating_count
CREATE OR REPLACE FUNCTION update_product_rating() RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET rating_avg = (
        SELECT AVG(rating)::REAL FROM product_reviews WHERE product_id = NEW.product_id
      ),
      rating_count = (
        SELECT COUNT(*)::INT FROM product_reviews WHERE product_id = NEW.product_id
      ),
      updated_at = NOW()
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_review_update_product
  AFTER INSERT OR UPDATE OR DELETE ON product_reviews
  FOR EACH ROW EXECUTE FUNCTION update_product_rating();

-- 6. Sold_count được update bởi worker-inventory sau checkout.completed
-- Logic: cho mỗi order_item của order paid → UPDATE products SET sold_count = sold_count + qty
-- (KHÔNG dùng trigger Postgres vì cần async + idempotent)

-- 7. Helpful comments
COMMENT ON COLUMN products.brand IS 'Extracted từ attributes.brand cho query nhanh; backfill khi import';
COMMENT ON COLUMN products.original_price IS 'Giá gốc trước discount; NULL = không có giảm giá';
COMMENT ON COLUMN products.rating_avg IS 'Auto-updated qua trigger từ product_reviews';
COMMENT ON COLUMN products.rating_count IS 'Số review thực, dùng để skip display khi count < 3';
COMMENT ON COLUMN products.sold_count IS 'Updated bởi worker-inventory sau payment success';
COMMENT ON COLUMN products.image_gradient IS 'Format: "color1,color2" — UI fallback khi image_url NULL';
COMMENT ON COLUMN products.icon_hint IS 'Tabler icon name (ti-bottle, ti-meat,...) — UI fallback';
