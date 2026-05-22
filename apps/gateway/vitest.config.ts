/**
 * apps/gateway/vitest.config.ts
 *
 * Vitest configuration for ICP Gateway tests.
 *
 * S-03 T02 emit — first gateway test config.
 *
 * Settings:
 *   - environment: node — Gateway is Node-only (no DOM)
 *   - globals: false — explicit imports (vitest convention)
 *   - testTimeout: 15s — accommodates PG/Redis round-trips in integration
 *     tests (login bcrypt compare ~100ms + 3 PG queries + 2 Redis ops + JWT
 *     sign per scenario)
 *   - include: `**\/*.spec.ts` under src/
 *   - reporter: default (verbose for CI grep)
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    testTimeout: 15_000,
    hookTimeout: 15_000,
    include: ['src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
    pool: 'forks',
    poolOptions: {
      forks: {
        // Run sequentially to avoid PG/Redis state collisions across files
        // (we share Postgres `sessions` table + Redis DB 0).
        singleFork: true,
      },
    },
  },
});
