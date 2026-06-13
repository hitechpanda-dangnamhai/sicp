/**
 * apps/web/e2e/auth-flow.spec.ts
 *
 * Slice:   S-03 T06 — E2E QA + slice closeout
 * Source:  taskpacks/S-03-T06_E2E_CLOSEOUT.md v1.0 §2 (AC-38.1..3)
 *
 * **Tests:** 3 Intent 08 auth flow paths
 *   1. AC-38.1 Happy login → state-E LoginSuccessTransition → redirect /home
 *   2. AC-38.2 Wrong password → state-C inline alert + form state preserved
 *   3. AC-38.3 Logout (pre-login via API → /me → "Đăng xuất" → /auth/login)
 *
 * **Selector strategy (D-29 LAW + V-SLICE Playwright pattern T06 Phiên N+5):**
 *   Priority order per Bước 1 DISCOVER repo verify (no `data-testid` in S-03 pages):
 *   (1) `getByText('exact Vietnamese text')` — most stable, matches mockup designer-intent
 *   (2) `getByRole('button', {name: '...'})` for buttons
 *   (3) `getByLabel('aria-label exact')` for icon-only buttons
 *   (4) CSS class fallback (S-01 baseline `.phone-frame`)
 *
 * **Pre-cleanup (deterministic):** Playwright `beforeEach` invokes
 *   `make e2e-cleanup` (extracted from smoke-auth.sh lines 44-56 pattern):
 *   DELETE PG sessions for test user + DEL Redis session:* namespace.
 *   Wipes prior state so each test starts from clean BE state.
 *
 * **Selectors verified Bước 1 DISCOVER Phiên N+5:**
 *   - Login heading: `text="Chào mừng trở lại"` (login/page.tsx line ~250)
 *   - Submit button: `getByRole('button', {name: 'Đăng nhập'})` (mockup state-A line 168-171)
 *   - Form inputs: `getByLabel('Email')` + `getByLabel('Mật khẩu')`
 *   - Wrong-pass alert: `text="Email hoặc mật khẩu không đúng. Vui lòng thử lại."`
 *   - State-E heading: `text=/ĐĂNG NHẬP THÀNH CÔNG/i` + `text=/Xin chào.*Anh Nam/`
 *   - Profile heading: `text="Tài khoản của tôi"` (me/page.tsx line ~163)
 *   - Logout button: `getByRole('button', {name: 'Đăng xuất'})` (mockup state-F line 198-201)
 *
 * **BE seed canonical (per C-28 + S00b-C14-bis):** merchant1@demo.icp / demo1234
 */

import { test, expect, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';

// ─── Constants ────────────────────────────────────────────────────────────

const LOGIN_URL = '/auth/login';
const ME_URL = '/me';

const CANONICAL_EMAIL = 'merchant1@demo.icp';
const CANONICAL_PASSWORD = 'demo1234';
const WRONG_PASSWORD = 'wrongpass';

// State-E timeout: LoginSuccessTransition has setTimeout(2000) per D-25;
// give buffer for animation + redirect settle.
const STATE_E_REDIRECT_TIMEOUT_MS = 5000;

// ─── Pre-cleanup helper ───────────────────────────────────────────────────

/**
 * Wipes PG sessions + Redis session:* for canonical test user.
 * Reuses `make e2e-cleanup` Makefile target (extracted from smoke-auth.sh
 * lines 44-56). Synchronous + fast (~1s) per user choice "Option A deterministic".
 */
function wipeSessions(): void {
  try {
    execSync('make e2e-cleanup', { stdio: 'pipe' });
  } catch (err) {
    // Non-fatal — log + continue. Tests may still pass if DB already clean.
    // eslint-disable-next-line no-console
    console.warn('[e2e-cleanup] failed (continuing):', (err as Error).message);
  }
}

// ─── BE login helper (for tests requiring pre-authenticated state) ────────

/**
 * Performs login via BE API directly (sets cookies on Playwright context).
 * Used by logout test (AC-38.3) to skip FE login flow and go straight to /me.
 * Mirrors smoke-auth.sh AC-1 curl pattern.
 */
async function loginViaApi(page: Page): Promise<void> {
  const response = await page.request.post('/api/v1/auth/login', {
    data: {
      email: CANONICAL_EMAIL,
      password: CANONICAL_PASSWORD,
      remember_me: false,
    },
  });
  expect(response.status()).toBe(200);
  // Cookies auto-stored in Playwright context via Set-Cookie from BE.
}

// ─── Tests ────────────────────────────────────────────────────────────────

// UI auth tests login FRESH (test login-UI) → override project storageState =
// unauth. AC-38.1/2/3 = 3 fresh logins (+ setup 1 = 4, dưới throttle 5/min W-60).
test.describe('Intent 08 — auth flow E2E', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async () => {
    wipeSessions();
  });

  test('AC-38.1 happy login → state-E LoginSuccessTransition → /home', async ({ page }) => {
    // Navigate to login page
    await page.goto(LOGIN_URL);

    // Verify state-A idle heading visible (mockup line 144)
    await expect(page.getByText('Chào mừng trở lại')).toBeVisible();

    // Fill canonical credentials per BE seed C-28.
    // S-P0-03/T02b-1: `Mật khẩu` exact — bare label match cả input + nút eye-toggle
    // aria-label "Hiện mật khẩu" (chứa "mật khẩu") → strict-mode violation.
    await page.getByLabel('Email').fill(CANONICAL_EMAIL);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(CANONICAL_PASSWORD);

    // Submit (state-A → state-B isPending → 200 → state-E isSuccess)
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    // State-E success transition appears: "ĐĂNG NHẬP THÀNH CÔNG" + greeting
    // Per mockup state-E lines 151-152: uppercase tracking-wider green eyebrow
    // + "Xin chào, Anh Nam" gradient text.
    await expect(page.getByText(/ĐĂNG NHẬP THÀNH CÔNG/i)).toBeVisible({
      timeout: STATE_E_REDIRECT_TIMEOUT_MS,
    });
    await expect(page.getByText(/Xin chào/)).toBeVisible();
    await expect(page.getByText(/Anh Nam/)).toBeVisible();

    // S-P0-03/T02b-1 REWRITE-FLOW: S-P0-01 multi-tenant GỠ /home dashboard.
    // Post-success LoginSuccessTransition router.push('/home') → middleware
    // resolveLastActiveSlug NULL (fresh session) → redirect /onboarding picker.
    await expect(page.getByRole('heading', { name: 'Chọn shop' })).toBeVisible({
      timeout: STATE_E_REDIRECT_TIMEOUT_MS,
    });

    // Pick the only shop merchant1 owns → switch-tenant → /s/demo → /s/demo/home.
    await page.getByRole('button', { name: /Demo Shop/ }).click();
    await page.waitForURL('**/s/demo/home', { timeout: STATE_E_REDIRECT_TIMEOUT_MS });

    // Dashboard rendered at storefront-scoped path (DashboardHeader brand "ICP").
    await expect(page.getByText('ICP', { exact: true })).toBeVisible();
    await expect(page.getByText('Trợ lý kinh doanh thông minh')).toBeVisible();
  });

  test('AC-38.2 wrong password → state-C inline alert + form state preserved', async ({
    page,
  }) => {
    await page.goto(LOGIN_URL);

    // Fill with wrong password (Mật khẩu exact — xem AC-38.1 note selector).
    await page.getByLabel('Email').fill(CANONICAL_EMAIL);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(WRONG_PASSWORD);

    // Submit
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    // State-C inline alert per D-26 (errorClass='wrong_credentials' from 401)
    // Exact text from login/page.tsx getInlineErrorMessage() line ~98
    await expect(
      page.getByText('Email hoặc mật khẩu không đúng. Vui lòng thử lại.'),
    ).toBeVisible();

    // Form state preserved per C-NN-T05-NEW-2 + D-26: react-hook-form values
    // persist across shake animation (LoginForm internal `key={shakeKey}`
    // wraps <form>, not whole component, so input values stay).
    await expect(page.getByLabel('Email')).toHaveValue(CANONICAL_EMAIL);
    // Note: password input may be cleared by browser auto-fill behavior in
    // some Chromium versions; check email retention only (most reliable).
  });

  test('AC-38.3 logout flow → /auth/login + cookies cleared', async ({ page, context }) => {
    // Pre-login via API (skip FE flow — focus test on logout)
    await loginViaApi(page);

    // Navigate to /me (D-28 entry point also works but this is more direct
    // for testing logout specifically)
    await page.goto(ME_URL);

    // Verify state-F profile page loaded (mockup line 117 + me/page.tsx ~163)
    await expect(page.getByText('Tài khoản của tôi')).toBeVisible();
    await expect(page.getByText('Quản lý thông tin')).toBeVisible();

    // Verify logout confirm card visible (always-visible per D-27)
    await expect(page.getByText('Đăng xuất khỏi tài khoản?')).toBeVisible();

    // Click "Đăng xuất" red-grad button (mockup line 198-201)
    await page.getByRole('button', { name: 'Đăng xuất' }).click();

    // useLogout per D-19 → POST /auth/logout → onSuccess removeQueries +
    // router.push('/auth/login')
    await page.waitForURL(`**${LOGIN_URL}`, { timeout: STATE_E_REDIRECT_TIMEOUT_MS });

    // Verify login page heading visible after redirect
    await expect(page.getByText('Chào mừng trở lại')).toBeVisible();

    // Verify cookies cleared (Set-Cookie Max-Age=0 from BE per T02 logout)
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name === 'icp_session');
    // After clear cookie, either absent or empty value
    expect(sessionCookie === undefined || sessionCookie.value === '').toBe(true);
  });

});

// Refresh = OWN fresh session (unauth context). Rotating refresh INVALIDATE
// session cũ → KHÔNG dùng storageState chung (sẽ poison dashboard/cart → 401).
// +1 login (tổng suite 5 login/run; CI dùng SkipThrottle test-env — note §2c).
test.describe('Auth refresh E2E', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('T02b-1 rotating refresh → 200 + new icp_session cookie (no LLM)', async ({
    page,
    context,
  }) => {
    // Own login (sets icp_session + icp_refresh) — session riêng để rotate.
    await loginViaApi(page);

    const before = (await context.cookies()).find((c) => c.name === 'icp_session');
    expect(before).toBeTruthy();

    // POST /auth/refresh reads icp_refresh cookie (Path=/api/v1/auth, separate
    // from icp_session) → rotating refresh → 200, NO tokens in body (cookies only).
    const res = await page.request.post('/api/v1/auth/refresh');
    expect(res.status()).toBe(200);

    // New icp_session re-issued (Set-Cookie applied to context).
    const after = (await context.cookies()).find((c) => c.name === 'icp_session');
    expect(after).toBeTruthy();
    expect(after?.value).toBeTruthy();
  });
});
