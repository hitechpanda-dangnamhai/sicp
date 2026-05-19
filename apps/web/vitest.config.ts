/**
 * apps/web/vitest.config.ts — Vitest test runner config
 *
 * Slice:    S-01 UI Foundation
 * Task:     T01 Tokens + Utility Foundation
 * AC:       AC-19
 *
 * Decisions:
 * - C-09 — Vitest substituted for jest (TASKLIST AC line 40 originally said
 *          jest). Rationale: jest setup for Next.js 14 ESM is painful (requires
 *          next/jest preset + transformIgnorePatterns whitelist for ESM
 *          packages). Vitest is ESM-native, Vite-native for Next.js 14, and
 *          exposes a jest-compatible API (describe/it/expect) so future
 *          migration to jest is mechanical if needed.
 *
 * Setup:
 * - jsdom environment for React component testing.
 * - `@` alias matches tsconfig.json paths (apps/web/ root).
 * - @vitejs/plugin-react enables JSX + Fast Refresh.
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
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
