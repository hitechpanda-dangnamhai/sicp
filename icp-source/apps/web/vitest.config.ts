/**
 * apps/web/vitest.config.ts — Vitest test runner config
 *
 * Slice:    S-01 UI Foundation
 * Task:     T01 Tokens + Utility Foundation
 *           T03 PATCH (Phiên 15) — add setupFiles per C-19 (jest-dom matchers).
 * AC:       AC-19 (T01) + AC-21 (T03 layout tests require jest-dom matchers)
 *
 * Decisions:
 * - C-09 — Vitest substituted for jest (TASKLIST AC line 40 originally said
 *          jest). Rationale: jest setup for Next.js 14 ESM is painful (requires
 *          next/jest preset + transformIgnorePatterns whitelist for ESM
 *          packages). Vitest is ESM-native, Vite-native for Next.js 14, and
 *          exposes a jest-compatible API (describe/it/expect) so future
 *          migration to jest is mechanical if needed.
 * - C-19 — T03 Phiên 15 fix-in-place patch. T01 setup did not include
 *          `setupFiles` reference loading @testing-library/jest-dom matchers.
 *          T02 atoms.test.tsx did not surface gap (didn't use jest-dom
 *          matchers). T03 layout.test.tsx uses toHaveClass /
 *          toBeInTheDocument / toHaveAttribute / toHaveTextContent — exposed
 *          missing setup. Resolution: add ./vitest.setup.ts reference; T02
 *          tests continue PASS unchanged.
 *
 * Setup:
 * - jsdom environment for React component testing.
 * - `@` alias matches tsconfig.json paths (apps/web/ root).
 * - @vitejs/plugin-react enables JSX + Fast Refresh.
 * - setupFiles: vitest.setup.ts — loads jest-dom matchers globally per C-19.
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['**/__tests__/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
