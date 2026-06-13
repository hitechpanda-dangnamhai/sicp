/**
 * apps/web/e2e/dashboard.spec.ts
 *
 * Slice:   S-03 T06 — E2E QA + slice closeout
 * Source:  taskpacks/S-03-T06_E2E_CLOSEOUT.md v1.0 §2 (AC-38.4..5)
 *
 * **Tests:** 2 Home Dashboard paths
 *   4. AC-38.4 /home loaded with header + StatBar + 2 Hero Tiles + 4 List Tiles
 *   5. AC-38.5 D-28 avatar tap (aria-label="Mở hồ sơ tài khoản") → /me
 *
 * **Selector strategy (per D-29 LAW + V-SLICE Playwright pattern T06 Phiên N+5):**
 *   - Header brand: `text="ICP"` + `text="Trợ lý kinh doanh thông minh"`
 *   - 2 Hero Tiles: `text="Nhập hàng"` + `text="Phân tích"` (golden-reference line 176, 198)
 *   - 4 List Tiles: `text="Tìm sản phẩm"` + `text="Mua hàng"` + others (golden-reference)
 *   - Avatar D-28: `getByLabel('Mở hồ sơ tài khoản')` (DashboardHeader.tsx line 109)
 *
 * **Pre-cleanup:** Reuses `make e2e-cleanup` Makefile target (deterministic).
 *
 * **Pre-auth:** Each test logs in via BE API helper (skip FE login overhead).
 */

import { test, expect, type Page } from '@playwright/test';

// ─── Constants ────────────────────────────────────────────────────────────

const ME_URL = '/me';

// ─── Helpers ────────────────────────────────────────────────────────────────
// Auth = storageState (setup project login MỘT LẦN — tránh login throttle W-60).

/**
 * S-P0-03/T02b-1 REWRITE-FLOW: S-P0-01 multi-tenant GỠ /home dashboard → nay
 * `/s/<slug>/home`. /onboarding luôn render picker (KHÔNG phụ thuộc last_active)
 * → pick "Demo Shop" → switch-tenant → /s/demo → /s/demo/home.
 */
async function enterDemoShop(page: Page): Promise<void> {
  await page.goto('/onboarding');
  await expect(page.getByRole('heading', { name: 'Chọn shop' })).toBeVisible();
  await page.getByRole('button', { name: /Demo Shop/ }).click();
  await page.waitForURL('**/s/demo/home', { timeout: 5000 });
}

// ─── Tests ────────────────────────────────────────────────────────────────

test.describe('S-03 T03b — Home Dashboard E2E', () => {

  test('AC-38.4 storefront /s/demo/home loaded with header + stats + tiles', async ({ page }) => {
    // Auth via storageState; enter shop (multi-tenant flow — storefront-scoped).
    await enterDemoShop(page);

    // Header: ICP brand + tagline (DashboardHeader.tsx:75-80)
    await expect(page.getByText('ICP', { exact: true })).toBeVisible();
    await expect(page.getByText('Trợ lý kinh doanh thông minh')).toBeVisible();

    // 2 Hero Tiles per D-11 + mockup lines 166-208
    // Tile 1: "Nhập hàng" hero pink-gradient HOT badge
    await expect(page.getByText('Nhập hàng')).toBeVisible();
    // Tile 2: "Phân tích" hero orange-gradient AI badge (exact — "phân tích"
    // substring xuất hiện ở HeroInsightCard/subtitle → strict-mode nếu loose).
    await expect(page.getByText('Phân tích', { exact: true })).toBeVisible();

    // 4 List Tiles per mockup lines 216-289 (R1 mapping per C-23)
    // List Tile 1: "Tìm sản phẩm" intent-03
    await expect(page.getByText('Tìm sản phẩm')).toBeVisible();
    // List Tile 2: "Mua hàng" intent-02
    await expect(page.getByText('Mua hàng')).toBeVisible();

    // StatBar — 3 KPI labels per D-10 + mockup lines 124-152
    // "đơn hôm nay" + "doanh thu" + "tồn kho"
    // KPI labels exact — "doanh thu"/"tồn kho" là substring trong HeroInsightCard
    // + subtitle "Trend, doanh thu, tồn kho" → strict-mode nếu loose.
    await expect(page.getByText('đơn hôm nay', { exact: true })).toBeVisible();
    await expect(page.getByText('doanh thu', { exact: true })).toBeVisible();
    await expect(page.getByText('tồn kho', { exact: true })).toBeVisible();

    // AI Insight Card section title per mockup line 100
    await expect(page.getByText('AI VỪA PHÁT HIỆN')).toBeVisible();
  });

  test('AC-38.5 D-28 avatar tap → /me navigation', async ({ page }) => {
    // Auth via storageState; enter shop (storefront-scoped dashboard).
    await enterDemoShop(page);

    // Verify dashboard loaded first (smoke check)
    await expect(page.getByText('ICP', { exact: true })).toBeVisible();

    // D-28 avatar promotion: aria-label="Mở hồ sơ tài khoản" per
    // DashboardHeader.tsx line 109 (verified Bước 1 Command 8)
    const avatarButton = page.getByRole('button', { name: 'Mở hồ sơ tài khoản' });
    await expect(avatarButton).toBeVisible();

    // Click avatar → home/page.tsx wires router.push('/me') per D-28
    await avatarButton.click();

    // Wait for navigation to /me
    await page.waitForURL(`**${ME_URL}`, { timeout: 5000 });

    // Verify /me profile page loaded (mockup state-F line 117 + me/page.tsx ~163)
    await expect(page.getByText('Tài khoản của tôi')).toBeVisible();
    await expect(page.getByText('Quản lý thông tin')).toBeVisible();
  });
});
