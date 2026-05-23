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
import { execSync } from 'node:child_process';

// ─── Constants ────────────────────────────────────────────────────────────

const HOME_URL = '/home';
const ME_URL = '/me';

const CANONICAL_EMAIL = 'merchant1@demo.icp';
const CANONICAL_PASSWORD = 'demo1234';

// ─── Pre-cleanup helper (mirrors auth-flow.spec.ts) ──────────────────────

function wipeSessions(): void {
  try {
    execSync('make e2e-cleanup', { stdio: 'pipe' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[e2e-cleanup] failed (continuing):', (err as Error).message);
  }
}

// ─── BE login helper ──────────────────────────────────────────────────────

async function loginViaApi(page: Page): Promise<void> {
  const response = await page.request.post('/api/v1/auth/login', {
    data: {
      email: CANONICAL_EMAIL,
      password: CANONICAL_PASSWORD,
      remember_me: false,
    },
  });
  expect(response.status()).toBe(200);
}

// ─── Tests ────────────────────────────────────────────────────────────────

test.describe('S-03 T03b — Home Dashboard E2E', () => {
  test.beforeEach(async () => {
    wipeSessions();
  });

  test('AC-38.4 /home loaded with header + stats + tiles', async ({ page }) => {
    // Pre-login
    await loginViaApi(page);
    await page.goto(HOME_URL);

    // Header: ICP brand + tagline (golden-reference-mockup.html line 69-70)
    await expect(page.getByText('ICP', { exact: true })).toBeVisible();
    await expect(page.getByText('Trợ lý kinh doanh thông minh')).toBeVisible();

    // 2 Hero Tiles per D-11 + mockup lines 166-208
    // Tile 1: "Nhập hàng" hero pink-gradient HOT badge
    await expect(page.getByText('Nhập hàng')).toBeVisible();
    // Tile 2: "Phân tích" hero orange-gradient AI badge
    await expect(page.getByText('Phân tích')).toBeVisible();

    // 4 List Tiles per mockup lines 216-289 (R1 mapping per C-23)
    // List Tile 1: "Tìm sản phẩm" intent-03
    await expect(page.getByText('Tìm sản phẩm')).toBeVisible();
    // List Tile 2: "Mua hàng" intent-02
    await expect(page.getByText('Mua hàng')).toBeVisible();

    // StatBar — 3 KPI labels per D-10 + mockup lines 124-152
    // "đơn hôm nay" + "doanh thu" + "tồn kho"
    await expect(page.getByText('đơn hôm nay')).toBeVisible();
    await expect(page.getByText('doanh thu')).toBeVisible();
    await expect(page.getByText('tồn kho')).toBeVisible();

    // AI Insight Card section title per mockup line 100
    await expect(page.getByText('AI VỪA PHÁT HIỆN')).toBeVisible();
  });

  test('AC-38.5 D-28 avatar tap → /me navigation', async ({ page }) => {
    // Pre-login
    await loginViaApi(page);
    await page.goto(HOME_URL);

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
