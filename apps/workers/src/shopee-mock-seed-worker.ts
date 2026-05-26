#!/usr/bin/env tsx
/**
 * shopee-mock-seed-worker.ts — Pattern A worker per C-S07-A (Phiên Sx07-B
 * LOCKED) — startup-time idempotent seeder for shopee_prices_mock table.
 *
 * Slice: S-07 Import Products by Image (Intent 01), Task T01.B (Phiên Sx07-D).
 *
 * Per C-S07-A 3-sources consensus (BACKLOG line 470 literal + ADR-032 line 301
 * "Worker chạy 1 lần lúc startup, idempotent" + apps/workers/src/index.ts comment
 * "shopee-mock-seed-worker pending"). NOT extension of infra/seed/seed.ts (which
 * is CLI per C14 amend Phiên 8 — wrong pattern for worker semantics per C-S07-A
 * resolution rationale line 77).
 *
 * Per C-S07-A Option ⓑ″ fixture scope:
 *   - 66 rows total = 55 specific (matching 55 PG products by category+brand+size)
 *     + 11 category-only fallback (empty attributes) for off-script categories
 *   - Each row has 3 samples (deterministic, no real Shopee crawl)
 *
 * V008 inline INSERT note (Maggi 200ml seed row, verified empirically Phiên Sx07-D
 * via `SELECT COUNT(*) FROM shopee_prices_mock` → 1 row already present BEFORE
 * worker first run). Worker uses ON CONFLICT (category, attributes) DO NOTHING
 * per V008 UNIQUE constraint line ~78, so V008 inline row coexists; resulting
 * total row count = 67 (1 V008 inline + 66 fixture rows; no row pair conflicts
 * since fixture has Maggi 700ml not 200ml). Flagged in S-07-T01_REPORT.md §6.
 *
 * Usage:
 *   pnpm --filter @icp/workers run seed-shopee
 *   DATABASE_URL=postgresql://... tsx shopee-mock-seed-worker.ts
 *
 * Pre-requisite: `make migrate` applied V001..V010 (incl. V008 shopee_prices_mock
 *                table + V001 products table). `make seed` populated 55 products
 *                so worker can match brand+size per fixture row (currently fixture
 *                is pre-built static JSON, but assertion log helps detect drift
 *                if PG products mutate).
 *
 * Idempotency contract:
 *   - Lần 1 (DB has 1 V008 inline row): worker inserts 66 fixture rows → total 67
 *   - Lần 2+ (DB has 67 rows): worker inserts 0, all 66 skipped via ON CONFLICT
 *
 * Logging style: console.log/warn/error (parity vespa-feed.ts pattern — 1-time
 * CLI tool, not service runtime; structured OTel logger mandate per 00_CONTEXT.md
 * §10 #5 only applies to service code).
 */

import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';

// ESM-compatible __dirname (matches seed.ts D-05 module: esnext + bundler).
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env từ repo root: 3 levels up (apps/workers/src/ → apps/workers/ →
// apps/ → repo root). Pattern parity với seed.ts but +1 level (seed at
// infra/seed/ vs worker at apps/workers/src/).
loadEnv({ path: join(__dirname, '../../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not set. Check .env or export the var.');
  process.exit(1);
}

// Fixture path: 4 levels up to repo root + infra/seed/shopee-mock-fixture.json
const FIXTURE_PATH = join(
  __dirname,
  '../../../infra/seed/shopee-mock-fixture.json',
);

// ─────────────────────────────────────────────────────────────────────────────
// Type definitions for fixture JSON (local — package boundary like seed.ts).
// Shape matches V008__shopee_prices_mock.sql DDL + C-S07-A Option ⓑ″ scope.
// ─────────────────────────────────────────────────────────────────────────────

interface ShopeeSampleEntry {
  title: string;
  store: string;
  price: number;
  rating: number | null;
  sold_count: number;
}

interface ShopeeFixtureRow {
  category: string;
  attributes: Record<string, string>; // {brand?, size?, variant?} — string vals
  min_price: number;
  avg_price: number;
  max_price: number;
  sample_count: number;
  review_count: number;
  samples: ShopeeSampleEntry[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`Shopee mock seed: source=${FIXTURE_PATH}`);

  // Load fixture (fails fast if missing).
  const fixture: ShopeeFixtureRow[] = JSON.parse(
    readFileSync(FIXTURE_PATH, 'utf-8'),
  );
  console.log(`Shopee mock seed: loaded ${fixture.length} fixture rows`);

  // Assertion guards (defensive — surface drift if fixture mutates).
  const specific = fixture.filter((r) => Object.keys(r.attributes).length > 0).length;
  const fallback = fixture.filter((r) => Object.keys(r.attributes).length === 0).length;
  console.log(`Shopee mock seed: composition specific=${specific} + fallback=${fallback}`);

  if (fixture.length !== 66) {
    console.warn(
      `Shopee mock seed: expected 66 rows per C-S07-A Option ⓑ″, got ${fixture.length}. ` +
        `Fixture drift — verify infra/seed/shopee-mock-fixture.json.`,
    );
  }

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of fixture) {
      // Per V008 schema CHECK constraints (line ~50-54):
      //   min_price >= 0
      //   avg_price >= min_price
      //   max_price >= avg_price
      //   sample_count > 0
      if (row.min_price < 0 || row.avg_price < row.min_price || row.max_price < row.avg_price) {
        errors.push(
          `Fixture row violates price ordering: cat=${row.category} attrs=${JSON.stringify(row.attributes)} ` +
            `min=${row.min_price} avg=${row.avg_price} max=${row.max_price}`,
        );
        continue;
      }
      if (row.sample_count <= 0) {
        errors.push(`Fixture row sample_count must be > 0: cat=${row.category}`);
        continue;
      }

      // ON CONFLICT (category, attributes) DO NOTHING per V008 UNIQUE
      // constraint. JSONB equality semantics: '{"brand":"Maggi"}' = '{"brand":"Maggi"}'
      // canonically (key-order insensitive in JSONB).
      const res = await client.query(
        `INSERT INTO shopee_prices_mock
           (category, attributes,
            min_price, avg_price, max_price, sample_count, review_count,
            samples)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (category, attributes) DO NOTHING
         RETURNING id`,
        [
          row.category,
          JSON.stringify(row.attributes),
          row.min_price,
          row.avg_price,
          row.max_price,
          row.sample_count,
          row.review_count,
          JSON.stringify(row.samples),
        ],
      );
      if (res.rowCount === 1) {
        inserted++;
      } else {
        skipped++;
      }
    }

    console.log(`Shopee mock seed: inserted ${inserted}, skipped ${skipped} (ON CONFLICT)`);

    if (errors.length > 0) {
      console.error(`Shopee mock seed: ${errors.length} validation errors:`);
      for (const err of errors) console.error(`  - ${err}`);
      process.exit(1);
    }

    // Verify final state (advisory only — does not fail worker).
    const verifyRes = await client.query<{ rows: string; cats: string }>(
      'SELECT COUNT(*)::text AS rows, COUNT(DISTINCT category)::text AS cats FROM shopee_prices_mock',
    );
    const { rows, cats } = verifyRes.rows[0];
    console.log(`Shopee mock seed: post-state rows=${rows} categories=${cats}`);
    console.log('Shopee mock seed complete.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Shopee mock seed failed:', err);
  process.exit(1);
});
