/**
 * apps/web/playwright.config.ts
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Playwright config for bugs-regression E2E
 *
 * Source:  Task Pack §2.3 Q2 decision — @playwright/test Chromium-only
 *
 * Strategy (per Bước 2 ACK + ST-NEW-2):
 * - Browser: Chromium only (skip Firefox/Webkit for hackathon budget)
 * - Chromium install location: ~/.cache/ms-playwright/ (OUTSIDE node_modules)
 *   Preserves 100MB threshold per ST-NEW-2 strategy (a)
 * - webServer: auto-start `next start` on port 3000 before tests
 * - testDir: `./e2e/` (apps/web/e2e/)
 * - Use playwright official defaults; no custom retries (hackathon scope)
 *
 * Decisions applied:
 * - C-07 navigation-agnostic — tests use page.goto(url) only
 * - C-14 acceptance pages at `/dev/acceptance/intent-0{1..8}`
 * - C-24 Bug 1/Bug 2 critical scenarios on I05 + I06 per KI-4 T05 lesson
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',

  // Run tests in parallel within a single file
  fullyParallel: true,

  // Fail build on CI if test.only left in source
  forbidOnly: !!process.env.CI,

  // Retry on CI only (single attempt locally)
  retries: process.env.CI ? 2 : 0,

  // Single worker on CI for stability; default cores locally
  workers: process.env.CI ? 1 : undefined,

  // Reporter — list for stdout + html for local debugging
  reporter: process.env.CI ? 'github' : 'list',

  // Shared settings for all projects
  use: {
    baseURL: 'http://localhost:3000',

    // Capture trace on first retry (debugging)
    trace: 'on-first-retry',

    // Screenshot only on failure (avoid disk usage during dev)
    screenshot: 'only-on-failure',

    // Default action timeout (5s — fast fail for layout assertions)
    actionTimeout: 5000,
  },

  // Test projects — Chromium only per Q2 + ST-NEW-2 strategy (a).
  // S-P0-03/T02b-1: 'setup' login MỘT LẦN → storageState (auth-shared, tránh
  // login throttle 5/min W-60). 'chromium' reuse state; auth.setup.ts chạy trước.
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Default authed state (merchant1). Auth-flow.spec override = unauth
        // (test login-UI fresh) qua test.use({ storageState: ... }).
        storageState: 'e2e/.auth/merchant1.json',
      },
      dependencies: ['setup'],
    },
  ],

  // Auto-start Next.js dev server before tests
  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 60000, // 60s — Next.js cold start tolerance
  },
});
