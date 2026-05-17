# 09 — UI Field Audit & Derivation Rules

> **Load khi:** thiết kế UI mới hoặc nghi ngờ "field này có trong DB không?" Doc này là **đối chiếu chính thức** UI fields ↔ data source.

## 1. Nguyên Tắc

Mọi field hiển thị trên UI **PHẢI có một trong các source sau:**

| Source | Khi nào |
|---|---|
| **Postgres column** | Persistent data, mutable (price, stock, title) |
| **Vespa summary field** | Search response (denormalized từ Postgres khi index) |
| **Redis cache** | Hot data ngắn hạn (cart, session) |
| **Derived (FE)** | Compute từ raw data (stock_status từ stock số) |
| **Derived (BE)** | Compute trên server trước khi trả về (discount_percent) |
| **Behavior aggregator** | Vespa counter signals (ctr_7d, trend_score) |

**KHÔNG ĐƯỢC** hiển thị field nào không có trong list trên. Nếu cần thêm → audit trước, migration sau, vẽ UI cuối.

## 2. Product Card — Field Mapping

| UI element | Field name | Source | Type | Derivation |
|---|---|---|---|---|
| Title 2 dòng | `title` | Postgres `products.title` + Vespa summary | string | — |
| Image | `image_url` | Postgres + Vespa summary | string nullable | NULL → fallback `image_gradient` + `icon_hint` |
| Image fallback gradient | `image_gradient` | Postgres + Vespa summary | string `"#c1,#c2"` | Set khi import nếu image_url NULL |
| Image fallback icon | `icon_hint` | Postgres + Vespa summary | string `'ti-bottle'` | AI tự suggest khi import từ vision, lưu Postgres |
| Brand | `brand` | Postgres + Vespa summary | string | Extract từ `attributes.brand` khi import → ALTER ADD column |
| Price VND | `price` | Postgres + Vespa | long | Format `Intl.NumberFormat('vi-VN')` ở FE |
| Original price | `original_price` | Postgres + Vespa | long nullable | NULL = không discount |
| Discount percent | — | **Derived BE** | int 0-100 | `Math.round((1 - price/original_price) * 100)` |
| Stock raw | `stock` | Postgres + Vespa | int | — |
| Stock status badge | — | **Derived FE** | enum | `stock === 0 ? 'out' : stock < 10 ? 'low' : 'available'` |
| Rating star value | `rating_avg` | Postgres + Vespa summary | float | Trigger Postgres tự update từ `product_reviews` |
| Rating count check | `rating_count` | Postgres + Vespa summary | int | Hide rating display nếu `< 3` (low confidence) |
| Sold count | `sold_count` | Postgres + Vespa summary | int | Worker-inventory tăng sau payment success |
| Badge HOT | — | **Derived BE** | bool | `sold_count > 1000` OR `trend_score > 0.8` |
| Badge ↑ TREND | — | **Derived BE** | bool | `trend_score > 0.7` AND tăng > 20% trong 7d |
| Badge NEW | — | **Derived BE** | bool | `created_at` < 14 ngày trước |
| Badge SALE | — | **Derived BE** | bool | `original_price != null AND original_price > price` |
| Heart wishlist | wishlist Redis key | Redis | bool | `wishlist:{user_id}:{product_id}` (Phase 06 optional) |
| Add button enabled | — | **Derived FE** | bool | `stock_status !== 'out'` |

## 3. Badge Derivation Rules (LOCKED)

Server tính badges theo priority. **Chỉ trả tối đa 2 badges per product** (tránh chen chúc trên card 138px):

```typescript
// apps/gateway/src/products/badge-deriver.ts
export function deriveBadges(p: ProductRaw): Badge[] {
  const badges: Badge[] = [];
  
  // Priority 1: SALE (commercial urgency)
  if (p.original_price && p.original_price > p.price) {
    badges.push('sale');
  }
  
  // Priority 2: HOT vs TREND (mutually exclusive)
  if (p.sold_count > 1000) {
    badges.push('hot');
  } else if (p.trend_score > 0.7 && p.velocity_score > 0.5) {
    badges.push('trending');
  }
  
  // Priority 3: NEW (only if no other commercial badge)
  if (badges.length === 0) {
    const daysOld = (Date.now() - new Date(p.created_at).getTime()) / 86400000;
    if (daysOld < 14) badges.push('new');
  }
  
  return badges.slice(0, 2);
}
```

| Badge | Threshold | Color (locked) |
|---|---|---|
| `hot` | sold > 1000 | grad-badge-hot (cam đậm) |
| `trending` | trend_score > 0.7 | grad-badge-ai (hồng-cam) |
| `new` | < 14 ngày | grad-mint (#10B981→#059669) |
| `sale` | có original_price | grad-amber (#F59E0B→#D97706) |
| `premium` | manual flag merchant | grad-purple (Phase 06 optional) |

## 4. Stock Status Derivation

```typescript
// FE-only derivation, không cần BE field
function deriveStockStatus(stock: number): 'available' | 'low' | 'out' {
  if (stock === 0) return 'out';
  if (stock < 10) return 'low';
  return 'available';
}
```

UI impact:
- `out` → disable add button + opacity 0.5 card + overlay "Hết hàng"
- `low` → badge "Còn ít" amber góc dưới
- `available` → nothing extra

## 5. Money Formatting

```typescript
// packages/shared-types/src/lib/format.ts
export const formatVND = (n: number): string =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n) + '₫';

// Variants
formatVND(25000)    // "25.000₫"
formatVND(2400000)  // "2.400.000₫"

// Compact for stats
export const formatVNDCompact = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return String(n);
};
formatVNDCompact(2400000)  // "2.4M"
```

## 6. Search Response — Complete Field List

`SseProductsEvent` payload phải có exact fields sau:

```typescript
export const SearchProductSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  brand: z.string().nullable(),
  category: z.string(),
  
  // Pricing
  price: z.number().int().nonnegative(),
  original_price: z.number().int().nonnegative().nullable(),
  discount_percent: z.number().int().min(0).max(100).nullable(),  // Server-computed
  
  // Image
  image_url: z.string().url().nullable(),
  image_gradient: z.string().nullable(),       // "color1,color2"
  icon_hint: z.string().nullable(),             // "ti-bottle"
  
  // Stock
  stock: z.number().int().nonnegative(),
  
  // Social proof
  rating_avg: z.number().min(0).max(5),
  rating_count: z.number().int().nonnegative(),
  sold_count: z.number().int().nonnegative(),
  
  // Badges (server-derived)
  badges: z.array(z.enum(['hot','trending','new','sale','premium'])).default([]),
  
  // Behavior signals (optional, không hiển thị direct)
  trend_score: z.number().optional(),
  
  // Search context (per-result)
  rank_score: z.number().optional(),            // Vespa score
  rank_profile: z.string().optional(),          // 'hybrid_with_behavior'
});
```

Trong MCP tool `vespa.hybrid_search` response, các fields trên là **summary fields** từ Vespa, không cần JOIN Postgres.

## 7. Other UI Elements Audit (Main Screen)

### Stat Bar (3 cells)

| Cell | UI value | Source | Query |
|---|---|---|---|
| Đơn hôm nay | int | Postgres `orders` | `SELECT COUNT(*) WHERE user_id=$1 AND status='paid' AND DATE(created_at)=CURRENT_DATE` |
| Doanh thu | "2.4M" | Postgres `orders + order_items` | `SELECT SUM(total) WHERE user_id=$1 AND status='paid' AND DATE(created_at)=CURRENT_DATE` |
| Tồn kho | int | Postgres `products` | `SELECT COUNT(*) WHERE merchant_id=$1 AND status='active' AND stock > 0` |

→ Cần endpoint `GET /api/v1/me/dashboard-stats` trả 3 numbers + tránh 3 query riêng. Caching Redis 60s.

```typescript
export const DashboardStatsSchema = z.object({
  orders_today: z.number().int(),
  revenue_today: z.number().int(),  // VND
  active_products: z.number().int(),
  
  // Optional deltas vs yesterday (Phase 06)
  orders_delta: z.number().optional(),
  revenue_delta: z.number().optional(),
});
```

### Hero AI Insight Card

| UI value | Source |
|---|---|
| "AI VỪA PHÁT HIỆN" label | Static |
| "Doanh thu tuần này giảm 12%" | **Insight engine** generates |
| "12%" highlight | Number from insight |
| "Tôi tìm ra 2 nguyên nhân chính..." | Insight description |
| 2 CTAs (Xem phân tích / Để sau) | Insight actions array |

→ Cần table `insights`:

```sql
-- Add to V003__insights.sql
CREATE TABLE insights (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id),
  type         VARCHAR(60) NOT NULL,        -- 'REVENUE_DROP', 'STOCK_LOW', 'TREND_SHIFT'
  severity     VARCHAR(20) NOT NULL CHECK (severity IN ('info','warning','critical')),
  
  -- Display
  label        VARCHAR(50) NOT NULL,        -- "AI VỪA PHÁT HIỆN"
  title        TEXT NOT NULL,               -- "Doanh thu tuần này giảm 12%"
  highlight    VARCHAR(50),                 -- "12%" — gradient amber
  description  TEXT NOT NULL,               -- "Tôi tìm ra 2 nguyên nhân..."
  
  -- Actions (JSONB array of {label, intent, payload})
  actions      JSONB NOT NULL DEFAULT '[]',
  
  -- Lifecycle
  status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','viewed','acted','dismissed','expired')),
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_insights_user_status ON insights(user_id, status, created_at DESC);
```

→ Endpoint `GET /api/v1/me/insights/latest` trả 1 insight `pending` hoặc null. Generated bởi worker-analytics (Phase 05) khi detect anomaly trong analytics_aggregations.

### Quick Action Tiles & List Rows

| UI | Source | Note |
|---|---|---|
| Tile "Nhập hàng" "5 giây" tagline | Static config | Hardcoded marketing copy |
| Tile "Phân tích" mini chart | Server: `last_7d_revenue` array | `GET /me/dashboard-stats` extend |
| List row "Tìm sản phẩm" "50+ mặt hàng" | Postgres count | `SELECT COUNT(*) FROM products WHERE merchant_id=$1 AND status='active'` |
| List row "Giỏ hàng" "100.000 ₫ · 3 món" | Redis cart | `GET cart:{user_id}` |
| Badge số "3" trên giỏ | Redis cart count | Cùng key |

## 7.5. Intent 01 — Market Trend Card (Google Trends)

Hiển thị trong State B (form prefilled) compact + State E mới (expanded). 
Tất cả fields transient, không persist DB.

| UI element | Field name | Source | Type | Derivation |
|---|---|---|---|---|
| Trajectory icon | `trajectory` | MCP `gtrends.interest_over_time` | enum `'rising'\|'stable'\|'falling'` | Map enum → emoji ở FE: rising=📈, stable=➡️, falling=📉 |
| Delta percentage | `delta_pct` | MCP `gtrends.interest_over_time` | float | Format FE: `Tăng X%` (rising/mango) hoặc `Giảm X%` (falling/rose) |
| Current score | `current_score` | MCP `gtrends.interest_over_time` | int 0-100 | — |
| Sparkline 90 ngày | `series[]` | MCP `gtrends.interest_over_time` | array of `{date, value}` | Max 90 points, render SVG polyline FE |
| Window label "90 ngày qua" | — | **Static i18n** | string | Hardcoded copy, không từ DB |
| Related rising chips | `related_rising[]` | MCP `gtrends.interest_over_time` | string[] (max 5) | Render mỗi chip tap → add vào form attributes |
| AI reasoning strip | — | **Derived BE** (LLM) | string | LLM tổng hợp từ {trajectory, delta_pct, related_rising} sau khi MCP trả về |
| `fetched_at` timestamp | `fetched_at` | MCP | ISO datetime | Hiển thị "Cập nhật 5 phút trước" nếu cũ > 1h |

→ **0 migration cần thêm** — transient data, không persist Postgres/Vespa.
→ Depends on: MCP tool `gtrends.interest_over_time` (xem `03_API_CONTRACTS.md` Section 5).

## 8. CHỐT — Quy Trình Khi Vẽ UI Mới

Bước check trước khi vẽ:

```
1. Liệt kê mọi text/number/icon trên mockup
2. Mỗi item: đối chiếu Section 2/6/7 của doc này
   → OK nếu match
   → NEW nếu chưa có
3. NEW items:
   a. Persistent? → propose migration V00X
   b. Derived? → write rule trong doc này
   c. Static? → put trong i18n config
4. Audit trước khi present UI để client/dev không hiểu nhầm là có sẵn
```

## 9. Anti-Pattern (Đừng Làm)

### ❌ Anti-1: Vẽ field "wishlist count" mà chưa thiết kế table
- UI: "1.2k người đã thích"
- Source: ❌ chưa có
- Hậu quả: code FE xong, BE bảo "không có data" → rework

### ❌ Anti-2: "AI confidence score" hiện ở mọi product
- UI: badge "AI 92% match"
- Source: ⚠️ chỉ tồn tại trong recommend intent, không có trong search intent
- Đúng: chỉ show ở Intent 04 Recommend, không reuse cho Intent 03

### ❌ Anti-3: Hardcode hex color đặc biệt cho 1 product
- UI: "Maggi" có viền đỏ riêng
- Source: ❌ không có field `border_color`
- Đúng: Derive từ `badges[]` enum, không tự ý tạo color riêng

## 10. Phase Mapping

| Phase | What to do |
|---|---|
| **Phase 01** | Migration V001 (existing) + V002 (this doc) trước khi seed data |
| **Phase 02** | Search endpoint dùng đúng SearchProductSchema. Vespa schema includes display fields |
| **Phase 03** | Import flow set image_gradient + icon_hint khi vision analyze |
| **Phase 04** | Worker-inventory update sold_count sau payment success |
| **Phase 05** | Insight engine generate hero card content. Worker-analytics tính deltas |
| **Phase 06** | Wishlist Redis nếu time cho phép |

---

**END OF FIELD AUDIT DOC.**

---

## 11. Migration Status Final (After Audit Done)

| Migration | Phase | Status | Notes |
|---|---|---|---|
| V001 | P01 | ✅ Existing | Base schema |
| V002 | P01 | ✅ Done | Product enrichment (brand, rating, sold_count, image fallback) |
| **V003** | P01 (run với V001+V002) | ✅ Done | Insights table cho hero card + analytics action cards |
| V004 | — | ⏭️ Skipped | Promotions cut cho hackathon |
| **V005** | P04 | ✅ Done | Payment metadata (failure_reason, payment_method) |
| **V006** | P05 | ✅ Done | Materialized views analytics aggregations |
| V007 | — | ⏭️ Skipped | Image storage dùng base64 inline |

**Decision: Image storage**
- Hackathon: dùng base64 inline trong `products.image_url` (text column, không cần ALTER)
- Mock data 50 products × ~50KB = 2.5MB total → Postgres handle fine
- Frontend dùng `<img src="data:image/jpeg;base64,..."/>` không cần CDN

**Decision: Analytics refresh strategy**
- Cron worker (Phase 05 `worker-analytics`) gọi `SELECT refresh_analytics_aggregations()` mỗi giờ
- App startup: nếu MV empty (first boot) → trigger refresh ngay
- Trên-demand fallback: nếu insight cần data fresher, query trực tiếp `orders` table (chậm hơn nhưng accurate)

## 12. Endpoint Spec Final (Hero Card + Dashboard)

### `GET /api/v1/me/dashboard-stats`
Stat bar 3 cells trên home screen. Cache Redis 60s.

```typescript
export const DashboardStatsResponse = z.object({
  orders_today: z.number().int().nonnegative(),
  revenue_today: z.number().int().nonnegative(),  // VND
  active_products: z.number().int().nonnegative(),
  
  // Optional deltas vs yesterday for trend arrows
  orders_delta_pct: z.number().nullable(),
  revenue_delta_pct: z.number().nullable(),
});
```

Backend query:
```sql
SELECT
  (SELECT COUNT(*) FROM orders 
    WHERE user_id = $1 AND status = 'paid' 
    AND DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = CURRENT_DATE) AS orders_today,
  (SELECT COALESCE(SUM(total),0) FROM orders 
    WHERE user_id = $1 AND status = 'paid' 
    AND DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = CURRENT_DATE) AS revenue_today,
  (SELECT COUNT(*) FROM products 
    WHERE merchant_id = $1 AND status = 'active' AND stock > 0) AS active_products;
```

### `GET /api/v1/me/insights/latest`
Hero AI card data.

```typescript
export const InsightResponse = z.object({
  id: z.string().uuid(),
  type: z.enum(['REVENUE_DROP','REVENUE_SPIKE','STOCK_LOW','TREND_SHIFT','...']),
  severity: z.enum(['info','warning','critical']),
  
  label: z.string(),         // "AI VỪA PHÁT HIỆN"
  title: z.string(),          // "Doanh thu tuần này giảm 12%"
  highlight: z.string().nullable(),  // "12%"
  description: z.string(),    // "Tôi tìm ra 2 nguyên nhân..."
  
  actions: z.array(z.object({
    label: z.string(),
    intent: z.string().nullable(),
    payload: z.record(z.unknown()).nullable(),
  })),
  
  created_at: z.string().datetime(),
}).nullable();  // null = chưa có insight pending
```

Backend query:
```sql
SELECT * FROM insights
WHERE user_id = $1 AND status = 'pending' AND expires_at > NOW()
ORDER BY 
  CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
  created_at DESC
LIMIT 1;
```

Side effect khi GET: nếu found, UPDATE `viewed_at = NOW()` (không thay status, chỉ track).
