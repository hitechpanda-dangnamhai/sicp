/**
 * `@icp/shared-types/products.ts`
 *
 * S-07 T02 NEW (Phiên Sx07-F per Q5 option b resolution per C-S07-Q):
 * Closes the C-S07-Q gap — T01.F deliverable claimed `ProductDraftSchema`
 * but Phiên Sx07-D actually shipped only `error.dto.ts` + `intent-stream.ts`
 * (no products schema). T02 emits it here as canonical Single Source of Truth.
 *
 * Per `docs/08_FE_BE_CONTRACT.md` §4.2 Single Source of Truth LAW — Zod
 * schemas governing FE-BE contracts live in `@icp/shared-types`.
 *
 * **Consumed by:**
 * - `apps/web/components/icp/molecules/PrefillForm.tsx` (zodResolver) —
 *   IMMEDIATE consumer (S-07 T02.A)
 * - `apps/mcp/src/tools/products.py` `create()` / `update()` — future Phase 3
 *   maintainer batch when closing C-S07-P Gateway ZodValidationPipe gap
 *   (BE currently dict-based; FE Zod is single live consumer in Sx07-F)
 * - S-09 Reco by Image confirm form — forward-compat (Phase 3+)
 * - Post-MVP `/products/:id/edit` page (T01 REVIEW recommendation line 225)
 *
 * **Mirror invariants** (sync-required if backend shape changes):
 * - `CANONICAL_CATEGORIES` mirrors `apps/mcp/src/tools/vision.py` line 52-54
 * - `ProductDraftSchema` mirrors `MCP products.create` 11-field signature
 *   (minus auto-fill: `merchant_id`, `trend_score`)
 * - `ProductSchema` extends draft with server-set fields (id, merchant_id,
 *   timestamps, ratings, vespa_doc_id)
 *
 * **Dual access pattern** (S-02 T06 C-32 + C-34 LOCKED — same as
 * `behavior/` + `sse/` + `cart`):
 * - FE subpath: `import { ProductDraftSchema } from '@icp/shared-types/products'`
 * - BE root: `import { ProductDraftSchema } from '@icp/shared-types'`
 *
 * **Why brand top-level (NOT nested in attributes):**
 * Per D-S04-11 LAW — `products.brand VARCHAR(100)` is a top-level Postgres
 * column + dedicated Vespa field `field brand type string`. The `vision.analyze`
 * prompt template returns `attributes.brand` (nested), so FE PrefillForm
 * MUST remap: read `form_prefill.attributes.brand` → render in dedicated
 * "Nhãn hiệu" input → submit as TOP-LEVEL `brand` field. See Warning #2 in
 * Sx07-F_T02_EXECUTION handoff Section 2.4.
 */

import { z } from 'zod';

/**
 * Canonical product categories — 11 entries.
 *
 * **MIRROR** of `apps/mcp/src/tools/vision.py` line 52-54
 * `CANONICAL_CATEGORIES` tuple. Adding new category requires sync edit
 * in BOTH files (no codegen because vision.py is the LLM prompt source).
 *
 * Value `'unknown'` is also accepted by `ProductDraftSchema.category` (when
 * Gemini cannot disambiguate confidently — confidence < 0.3 per C-S07-L).
 */
export const CANONICAL_CATEGORIES = [
  'nuoc_tuong',
  'tuong_ot',
  'dau_an',
  'mi_tom',
  'gia_vi',
  'sua',
  'banh_keo',
  'nuoc_giai_khat',
  'do_dong_hop',
  'gao',
  'banh_mi',
] as const;

export type CanonicalCategory = (typeof CANONICAL_CATEGORIES)[number];

/**
 * `ProductDraftSchema` — FE submit payload shape for Intent 01 import.
 *
 * Mirrors `apps/mcp/src/tools/products.py:122` `create()` signature MINUS
 * server auto-fill fields (`merchant_id` from session cookie, `trend_score`
 * from enrich phase). FE never sends these.
 *
 * **Field constraints:**
 * - `title` 1-255 chars (Postgres `products.title VARCHAR(255) NOT NULL`)
 * - `brand` 0-100 chars top-level (D-S04-11 LAW — NOT nested in attributes)
 * - `category` canonical OR 'unknown' (vision.analyze fallback)
 * - `attributes` `Record<string, string>` (chips editor — all values stringified)
 * - `price` non-negative integer VND (matches `products.price INT NOT NULL`)
 * - `stock` non-negative integer (default 0; merchant may set later)
 * - `sku` optional 0-50 chars (merchant inventory key)
 * - `description` optional text (Gemini-generated; merchant may edit)
 * - `image_data` optional base64 (inline preserved per ADR-01-NN)
 * - `image_url` optional URL (post-upload S3/CDN URL — Phase 3+)
 */
export const ProductDraftSchema = z.object({
  title: z
    .string()
    .min(1, 'Tên sản phẩm không được để trống')
    .max(255, 'Tên sản phẩm tối đa 255 ký tự'),
  brand: z.string().max(100).optional().nullable(),
  category: z
    .string()
    .min(1, 'Vui lòng chọn danh mục')
    .max(100),
  attributes: z.record(z.string(), z.string()),
  price: z
    .number()
    .int('Giá phải là số nguyên')
    .min(0, 'Giá không được âm'),
  stock: z
    .number()
    .int('Số lượng phải là số nguyên')
    .min(0, 'Số lượng không được âm'),
  sku: z.string().max(50).optional(),
  description: z.string().optional().nullable(),
  image_data: z.string().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
});

/** TypeScript inferred type for ProductDraft. */
export type ProductDraft = z.infer<typeof ProductDraftSchema>;

/**
 * `ProductSchema` — full Product entity (server response shape).
 *
 * Extends `ProductDraftSchema` with server-set fields. Used by future:
 * - `GET /api/v1/products/:id` response typing (post-MVP)
 * - PATCH `/api/v1/products/:id` response (already shipped Phiên Sx07-D)
 * - `cards.suggestion.product` snapshot fields (forward-compat S-09)
 */
export const ProductSchema = ProductDraftSchema.extend({
  id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  status: z.enum(['active', 'inactive', 'archived', 'draft']),
  trend_score: z.number().default(0),
  original_price: z.number().int().optional().nullable(),
  rating_avg: z.number().default(0),
  rating_count: z.number().int().default(0),
  sold_count: z.number().int().default(0),
  image_gradient: z.string().optional().nullable(),
  icon_hint: z.string().optional().nullable(),
  vespa_doc_id: z.string().optional().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

/** TypeScript inferred type for full Product. */
export type Product = z.infer<typeof ProductSchema>;
