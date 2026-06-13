/**
 * apps/web/e2e/intent-03.spec.ts
 *
 * S-P0-03/T02b-hotfix — REGRESSION e2e: intent-03 search POST /intent → 202 LIVE
 * sau fix X-Tenant-Id. Bắt regression S-P0-01 (FE intent POST thiếu X-Tenant-Id →
 * 400 TENANT_CONTEXT_MISSING; resolver header-only ADR-046 amend c).
 *
 * SCOPE = hotfix X-Tenant-Id: assert POST /api/v1/intent → 202 (BE accept tenant).
 * KHÔNG assert reach result-state vì downstream Vespa hybrid_search 400
 * (rank_profile cross_encoder_rerank) → "Search service unavailable" — gap
 * SEPARATE pre-existing (AI/MCP/Vespa), ngoài scope hotfix. Auth = storageState.
 *
 * Pre-cond: web build có fix (X-Tenant-Id attach). Build cũ → 400 → test ĐỎ.
 */

import { test, expect } from '@playwright/test';

test.describe('S-P0-03 T02b-hotfix — intent-03 POST /intent → 202 (X-Tenant-Id, live)', () => {
  test('search POST /intent → 202 (X-Tenant-Id attached, KHÔNG 400 TENANT)', async ({ page }) => {
    // Active tenant qua onboarding picker (storefront flow chuẩn). Sau đó FE
    // tenantHeaders() đọc getActiveTenantId (sessionStorage icp.tenant.demo do
    // TenantProvider resolve /public/tenant-by-slug) → intent POST kèm X-Tenant-Id.
    await page.goto('/onboarding');
    await expect(page.getByRole('heading', { name: 'Chọn shop' })).toBeVisible();
    await page.getByRole('button', { name: /Demo Shop/ }).click();
    await page.waitForURL('**/s/demo/home', { timeout: 5000 });

    await page.goto('/s/demo/intent/03');
    await page.waitForLoadState('networkidle'); // chờ TenantProvider cache tenant_id

    // Input bar functional Enter (D-S04-06 LAW). Query có sản phẩm trong seed demo.
    const input = page.getByLabel('Ô tìm kiếm');
    await expect(input).toBeVisible();
    await input.fill('nước mắm');

    // HOTFIX-SCOPED assert: POST /api/v1/intent → 202 (X-Tenant-Id attached, BE
    // resolve OK). PRE-fix = 400 TENANT_CONTEXT_MISSING → test ĐỎ (bắt regression).
    // KHÔNG assert reach result-state vì downstream Vespa hybrid_search trả 400
    // (rank_profile cross_encoder_rerank) → "Search service unavailable"
    // (searching_by_text.py:465) — gap SEPARATE, ngoài scope hotfix X-Tenant-Id.
    const t0 = Date.now();
    const [res] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/intent') && r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      input.press('Enter'),
    ]);
    const elapsed = Date.now() - t0;
    // eslint-disable-next-line no-console
    console.log(`[intent-03] POST /intent → ${res.status()} in ${elapsed}ms`);
    expect(res.status()).toBe(202); // 202 accepted (KHÔNG 400 TENANT_CONTEXT_MISSING)
  });
});
