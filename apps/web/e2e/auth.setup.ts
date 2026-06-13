/**
 * apps/web/e2e/auth.setup.ts
 *
 * S-P0-03/T02b-1 — Playwright setup project: login merchant1 MỘT LẦN → lưu
 * storageState. Tests cần auth (dashboard, cart) reuse → KHÔNG login lại.
 *
 * WHY: login throttle 5/min + 20/h/IP (W-60 brute-force guard, @Throttle
 * THROTTLE_LOGIN). Mỗi test login riêng → suite vượt giới hạn → 429. storageState
 * = 1 login dùng chung. Auth-flow.spec (test login-UI fresh) KHÔNG dùng state này.
 */

import { test as setup, expect } from '@playwright/test';

const AUTH_FILE = 'e2e/.auth/merchant1.json';

setup('authenticate merchant1', async ({ page }) => {
  const res = await page.request.post('/api/v1/auth/login', {
    data: { email: 'merchant1@demo.icp', password: 'demo1234', remember_me: false },
  });
  expect(res.status()).toBe(200);
  await page.context().storageState({ path: AUTH_FILE });
});
