/**
 * apps/workers/vitest.config.ts
 *
 * S-P0-03/T01 (W-76): first explicit workers vitest config. Previously workers
 * ran on vitest defaults (`vitest run`). Added here to pin the coverage ratchet
 * config so CI reproduces the measured floor deterministically.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
    // S-P0-03/T01d-hotfix (ADR-057): exclude spec khỏi denominator (coverage SOURCE-only).
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**'],
      exclude: ['**/*.spec.ts', '**/*.test.ts'],
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: './coverage',
    },
  },
});
