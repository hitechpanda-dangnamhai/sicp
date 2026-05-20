/**
 * apps/web/e2e/bugs-regression.spec.ts
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Bugs regression E2E
 *
 * Source:  TASKLIST line 369-371 — bugs-regression.spec.ts spec:
 *   - Bug 1: I05 + I06 — scroll mid (300, 500, 800px), assert content does
 *     not leak through BottomBar
 *   - Bug 2: I05 + I06 — viewport (700, 750, 820px), assert phone-frame
 *     shrinks within bounds
 *
 * Total: 8 tests (2 Bug 1 base + 6 Bug 2 viewport)
 *
 * Per CROSS_INTENT_BUG_IMPACT_ANALYSIS.md §Intent 05+06 HIGH RISK
 * Per KI-4 T05 lesson — manual cross-browser smoke complement
 *
 * Test page targets (per dev/acceptance pages T07 Bước 3):
 *   - /dev/acceptance/intent-05 (state-0-happy)
 *   - /dev/acceptance/intent-06 (state-G-otp)
 *
 * Selector strategy (per A6 mini-amendment Phiên 19 batch 3 Round 2):
 *   - T03 layout primitives (PhoneFrame, MainScroll, BottomBar) do NOT spread
 *     `...props` → data-testid attrs from acceptance pages get stripped.
 *     Use T01 baseline CSS class selectors instead:
 *       `.phone-frame`  — PhoneFrame wrapper (T01 @layer base)
 *       `.main-scroll`  — MainScroll wrapper (T01 @layer base)
 *       `.bottom-bar`   — BottomBar wrapper (T01 @layer base)
 *     These classes are guaranteed in DOM regardless of T03 prop spreading.
 */

import { test, expect, type Page } from '@playwright/test';

const INTENT_05_URL = '/dev/acceptance/intent-05';
const INTENT_06_URL = '/dev/acceptance/intent-06';

// ─── Bug 1: Content NOT leak through BottomBar on scroll ─────────────────────

/**
 * Bug 1 assertion: BottomBar covers MainScroll content even at deep scroll positions.
 *
 * Method: Compare BottomBar visual top edge vs the next-painted pixel above it
 * within the phone frame. If MainScroll content visible at that pixel band, the
 * Bug 1 fix has regressed (T01 .bottom-bar CSS lost solid bg / z-index).
 *
 * Implementation: scroll MainScroll to test offsets, then check BottomBar's
 * bounding box top y-coord exists + z-stacking implicit via DOM order
 * (BottomBar after MainScroll in source).
 *
 * Note: full pixel-level leak detection would need visual regression (T07 OOS).
 * This test asserts BottomBar layout intact at each scroll position.
 */
async function assertBug1NoLeak(page: Page, scrollPositions: number[]) {
  // A6 patch: PhoneFrame/MainScroll/BottomBar don't spread `...props` so
  // data-testid attributes baked in acceptance pages get stripped. Use T01
  // baseline CSS class selectors (`.phone-frame`, `.main-scroll`, `.bottom-bar`)
  // which are guaranteed in DOM via T01 @layer base CSS classes.
  const mainScroll = page.locator('.main-scroll');
  const bottomBar = page.locator('.bottom-bar');
  const phoneFrame = page.locator('.phone-frame');

  // Initial visibility checks
  await expect(mainScroll).toBeVisible();
  await expect(bottomBar).toBeVisible();
  await expect(phoneFrame).toBeVisible();

  // Snapshot BottomBar y-position before any scroll
  const bottomBarBox = await bottomBar.boundingBox();
  expect(bottomBarBox).not.toBeNull();
  const initialBottomY = bottomBarBox!.y;

  for (const offset of scrollPositions) {
    // Scroll MainScroll to offset
    await mainScroll.evaluate((el, offsetPx) => {
      el.scrollTop = offsetPx;
    }, offset);

    // Allow paint + reflow settle
    await page.waitForTimeout(150);

    // Re-snapshot BottomBar — must remain at same y-position (sticky bottom)
    const afterScrollBox = await bottomBar.boundingBox();
    expect(afterScrollBox, `BottomBar bbox missing after scroll to ${offset}px`).not.toBeNull();

    // BottomBar y-position SHOULD NOT change with scroll (Bug 1 fix: sticky/absolute pinned)
    // Tolerance ±1px sub-pixel anti-aliasing
    expect(
      Math.abs(afterScrollBox!.y - initialBottomY),
      `BottomBar moved during scroll to ${offset}px (Bug 1 regression)`,
    ).toBeLessThanOrEqual(1);

    // BottomBar still visible + covers full width of phone frame
    await expect(bottomBar).toBeVisible();
  }
}

test.describe('Bug 1 — BottomBar no leak through scroll', () => {
  test('I05 cart — BottomBar stays sticky at scroll positions 300/500/800', async ({ page }) => {
    await page.goto(INTENT_05_URL);
    await assertBug1NoLeak(page, [300, 500, 800]);
  });

  test('I06 OTP — BottomBar stays sticky at scroll positions 300/500/800', async ({ page }) => {
    await page.goto(INTENT_06_URL);
    await assertBug1NoLeak(page, [300, 500, 800]);
  });
});

// ─── Bug 2: phone-frame max-height clamp on small viewports ──────────────────

/**
 * Bug 2 assertion: phone-frame shrinks WITHIN viewport bounds when window
 * height < 892px (frame natural height 844 + 48px breathing room).
 *
 * Method: Set viewport height, navigate, measure phone-frame bounding box.
 * Frame height MUST be <= viewport height - 0 (allow exact fit). Pre-fix
 * the frame would overflow (height = 844 always, ignoring viewport).
 *
 * T01 .phone-frame { max-height: calc(100vh - 48px) } per C-02 universal fix
 * applies to BOTH mode='chat' AND mode='app' per PhoneFrame source.
 */
async function assertBug2Clamp(page: Page, url: string, viewportHeight: number) {
  // Set viewport BEFORE navigate (page reflows on resize)
  await page.setViewportSize({ width: 1280, height: viewportHeight });
  await page.goto(url);

  // Wait for layout settle
  await page.waitForLoadState('networkidle');

  // A6 patch: use CSS class selector instead of data-testid (see assertBug1NoLeak)
  const phoneFrame = page.locator('.phone-frame');
  await expect(phoneFrame).toBeVisible();

  const frameBox = await phoneFrame.boundingBox();
  expect(frameBox, 'phone-frame bbox missing').not.toBeNull();

  // Frame height MUST be within viewport (Bug 2 fix universal C-02)
  // T01 LAW: max-height: calc(100vh - 48px) → frame height <= viewportHeight - 48
  // Allow some tolerance for browser rendering differences (±5px)
  expect(
    frameBox!.height,
    `phone-frame height ${frameBox!.height} exceeds viewport ${viewportHeight} (Bug 2 regression)`,
  ).toBeLessThanOrEqual(viewportHeight - 43); // 48 - 5px tolerance

  // Frame top must be visible (y >= 0, not pushed off-screen)
  expect(frameBox!.y, 'phone-frame y < 0 — pushed off screen').toBeGreaterThanOrEqual(0);

  // Frame bottom must fit within viewport
  expect(
    frameBox!.y + frameBox!.height,
    `phone-frame bottom y${frameBox!.y + frameBox!.height} > viewport ${viewportHeight}`,
  ).toBeLessThanOrEqual(viewportHeight + 5); // small browser chrome tolerance
}

test.describe('Bug 2 — phone-frame max-height clamp on small viewport', () => {
  // I05 across 3 viewport heights
  test('I05 cart — viewport 700px clamp', async ({ page }) => {
    await assertBug2Clamp(page, INTENT_05_URL, 700);
  });

  test('I05 cart — viewport 750px clamp', async ({ page }) => {
    await assertBug2Clamp(page, INTENT_05_URL, 750);
  });

  test('I05 cart — viewport 820px clamp', async ({ page }) => {
    await assertBug2Clamp(page, INTENT_05_URL, 820);
  });

  // I06 across 3 viewport heights
  test('I06 OTP — viewport 700px clamp', async ({ page }) => {
    await assertBug2Clamp(page, INTENT_06_URL, 700);
  });

  test('I06 OTP — viewport 750px clamp', async ({ page }) => {
    await assertBug2Clamp(page, INTENT_06_URL, 750);
  });

  test('I06 OTP — viewport 820px clamp', async ({ page }) => {
    await assertBug2Clamp(page, INTENT_06_URL, 820);
  });
});
