/**
 * apps/web/e2e/cart-flow.spec.ts
 *
 * Slice: S-P0-03 / T02b-1 (W-75 e2e deterministic) — cart 7-route + cross-tenant
 * storefront isolation. API-level (page.request) → DETERMINISTIC, **0 LLM call**
 * (cart REST không qua AI; intent-05 cart-by-text LLM là T02b-2).
 *
 * **7 routes** (cart.controller.ts): POST /cart/items · GET /cart ·
 *   PATCH /cart/items/:id · POST /cart/promo · DELETE /cart/promo ·
 *   DELETE /cart/items/:id · DELETE /cart.
 *
 * **Auth/tenant:** JwtAuthGuard (cookie) + X-Tenant-Id (storefront). KHÔNG
 *   TenantMembershipGuard (customer global). Mutations cần Idempotency-Key UUIDv4.
 *
 * **Isolation (tenant-gate ADR-052, Note carry):** cart Redis-key
 *   `cart:{tenant}:{user}` — CÙNG user, demo cart ≠ demo2 cart. Subject =
 *   STOREFRONT cart (customer-facing), KHÔNG merchant2 (dual-tenant → che leak).
 *   Cart là Redis (KHÔNG PG-RLS) → isolation namespace-based; PG-RLS isolation
 *   đã cover ở tenant-isolation.spec (T01b) + seed-foundation.spec (T02a).
 *
 * **Product fixture:** `E2E_CART_PRODUCT_ID` (local: product demo có sẵn) HOẶC
 *   default fixed-id `ci-min.sql` (CI). Stock 999 → add/patch không OUT_OF_STOCK.
 */

import { test, expect, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { CartSchema, type Cart } from '@icp/shared-types/cart';

const DEMO_TENANT = '11111111-1111-1111-1111-111111111111';
const DEMO2_TENANT = 'a2a2a2a2-0000-4000-8000-000000000002';

// ci-min.sql fixed-id e2e product (demo). Local override: existing demo product.
const PRODUCT_ID =
  process.env.E2E_CART_PRODUCT_ID ?? 'e2e00001-0000-4000-8000-000000000001';

// ─── Helpers ────────────────────────────────────────────────────────────────
// Auth = storageState (setup project — tránh login throttle W-60).

/** Headers cho cart op: storefront tenant + (mutation) idempotency UUIDv4. */
function hdr(tenant: string, mutation = false): Record<string, string> {
  const h: Record<string, string> = { 'X-Tenant-Id': tenant };
  if (mutation) h['Idempotency-Key'] = randomUUID();
  return h;
}

// W-81 (T02c): parse cart response qua Zod CartSchema từ @icp/shared-types —
// contract THẬT (không chỉ shape ad-hoc). BE đổi field cart → parse throw → e2e
// đỏ thật. Đây là contract-assert route chính (cart) của hard-gate MODE B.
async function getCart(req: APIRequestContext, tenant: string): Promise<Cart> {
  const res = await req.get('/api/v1/cart', { headers: hdr(tenant) });
  expect(res.status()).toBe(200);
  return CartSchema.parse(await res.json());
}

async function clearCart(req: APIRequestContext, tenant: string): Promise<void> {
  await req.delete('/api/v1/cart', { headers: hdr(tenant, true) });
}

// ─── Tests ────────────────────────────────────────────────────────────────

test.describe('S-P0-03 T02b-1 — cart 7-route + cross-tenant isolation (0 LLM)', () => {
  // Serial — 2 test cùng dùng merchant1+demo cart; parallel (workers>1 local) →
  // race beforeEach-clear vs add. CI workers=1 đã serial; ép serial cho robust.
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Auth = storageState. Clean slate cả 2 tenant (deterministic isolation).
    await clearCart(page.request, DEMO_TENANT);
    await clearCart(page.request, DEMO2_TENANT);
  });

  test('exercises all 7 cart routes (add→get→patch→promo→del-promo→del-item→clear)', async ({
    page,
  }) => {
    const req = page.request;

    // 1. POST /cart/items — add (qty 2).
    const add = await req.post('/api/v1/cart/items', {
      headers: hdr(DEMO_TENANT, true),
      data: { product_id: PRODUCT_ID, qty: 2 },
    });
    expect(add.status()).toBe(201);

    // 2. GET /cart — item present qty 2.
    let cart = await getCart(req, DEMO_TENANT);
    const line = cart.items.find((i) => i.product_id === PRODUCT_ID);
    expect(line?.qty).toBe(2);

    // 3. PATCH /cart/items/:id — update qty → 5.
    const patch = await req.patch(`/api/v1/cart/items/${PRODUCT_ID}`, {
      headers: hdr(DEMO_TENANT, true),
      data: { qty: 5 },
    });
    expect(patch.status()).toBe(200);
    cart = await getCart(req, DEMO_TENANT);
    expect(cart.items.find((i) => i.product_id === PRODUCT_ID)?.qty).toBe(5);

    // 4. POST /cart/promo — route responds (unknown code → 2xx + INVALID_CODE;
    //    không seed promo hợp lệ → assert route hoạt động, không assert discount).
    const promo = await req.post('/api/v1/cart/promo', {
      headers: hdr(DEMO_TENANT, true),
      data: { code: 'E2E_NO_SUCH_PROMO' },
    });
    expect(promo.ok()).toBe(true); // 2xx

    // 5. DELETE /cart/promo — remove promo.
    const delPromo = await req.delete('/api/v1/cart/promo', { headers: hdr(DEMO_TENANT, true) });
    expect(delPromo.status()).toBe(200);

    // 6. DELETE /cart/items/:id — remove line.
    const delItem = await req.delete(`/api/v1/cart/items/${PRODUCT_ID}`, {
      headers: hdr(DEMO_TENANT, true),
    });
    expect(delItem.status()).toBe(200);
    cart = await getCart(req, DEMO_TENANT);
    expect(cart.items.find((i) => i.product_id === PRODUCT_ID)).toBeUndefined();

    // 7. DELETE /cart — clear (idempotent empty).
    const clear = await req.delete('/api/v1/cart', { headers: hdr(DEMO_TENANT, true) });
    expect(clear.status()).toBe(200);
    cart = await getCart(req, DEMO_TENANT);
    expect(cart.items).toHaveLength(0);
  });

  test('cross-tenant isolation: demo cart item NOT visible under demo2 (storefront)', async ({
    page,
  }) => {
    const req = page.request;

    // Add product vào cart STOREFRONT demo.
    const add = await req.post('/api/v1/cart/items', {
      headers: hdr(DEMO_TENANT, true),
      data: { product_id: PRODUCT_ID, qty: 3 },
    });
    expect(add.status()).toBe(201);

    // demo cart THẤY item (positive).
    const demoCart = await getCart(req, DEMO_TENANT);
    expect(demoCart.items.find((i) => i.product_id === PRODUCT_ID)?.qty).toBe(3);

    // demo2 cart KHÔNG thấy — cùng user, tenant khác → cart:{tenant}:{user} cô lập.
    // Đây là assert leak-catch: nếu isolation vỡ, item demo lọt sang demo2.
    const demo2Cart = await getCart(req, DEMO2_TENANT);
    expect(demo2Cart.items.find((i) => i.product_id === PRODUCT_ID)).toBeUndefined();
    expect(demo2Cart.items).toHaveLength(0);

    await clearCart(req, DEMO_TENANT);
  });
});
