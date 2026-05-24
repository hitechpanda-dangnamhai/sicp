#!/usr/bin/env tsx
/**
 * vespa-feed.ts — ICP Vespa bulk-feed runner (post-Postgres seed).
 *
 * Slice: S-04 First Product Discovery, Task T01 (Phiên Sx04-2).
 * Decisions: D-S04-10 LAW (Vespa native CLIP-multilingual embedder),
 *            D-S04-11 LAW (curated 55 products + behavioral signals formulas
 *            per 02_DATA_MODEL.md §X.0).
 *
 * Reads 55 products from Postgres (V001 + V002 columns) and POSTs each one
 * to Vespa Document API `/document/v1/icp/product/docid/<UUID>`. Per Vespa
 * schema indexing expression (product.sd line ~121 `embed clip_multilingual`),
 * the `text_embedding` 512-dim tensor field is AUTO-GENERATED at feed time
 * inside Vespa container — feed body OMITS text_embedding entirely (D-S04-10
 * LAW saves 1 RTT vs the retracted text.embed MCP tool approach per C-S04-K).
 *
 * Behavioral signals (11 Vespa-only fields per 02_DATA_MODEL.md §X.0 formulas
 * line 700-711) are derived deterministically from `sold_count` so re-feed is
 * idempotent (same UUID → same signals). Seed = hash of product.id.
 *
 * Also resolves co-purchase fixture (`infra/seed/co_purchase_category.json`):
 * the placeholder `REPLACE_AT_SEED_RUNTIME:<cat>:top1_trend_score` values get
 * resolved to actual UUIDs by querying PG top-1 product per category by
 * trend_score DESC, then writing back the fixture file with resolved UUIDs.
 *
 * Usage:
 *   pnpm --filter @icp/seed run vespa-feed             # canonical (via Makefile)
 *   VESPA_ENDPOINT=http://localhost:8080 tsx vespa-feed.ts  # direct
 *
 * Pre-requisite: `make seed` đã chạy xong (55 products in PG with V002 fields
 *                populated) + `make vespa-deploy` đã chạy xong (Vespa schema +
 *                clip_multilingual embedder component loaded).
 *
 * Idempotent: Vespa POST = upsert by docid; re-running overwrites cleanly.
 *
 * Note on logging: console.log/warn/error used here (NOT structured OTel
 * logger) following the precedent of seed.ts — both are 1-time CLI tools
 * not service runtime. Per 00_CONTEXT.md §10 #5 the structured logger
 * mandate applies to service code (gateway/ai/mcp/workers).
 */

import { Client } from 'pg';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { config as loadEnv } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadEnv({ path: join(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;
const VESPA_ENDPOINT = process.env.VESPA_ENDPOINT ?? 'http://localhost:8080';

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not set. Check .env or export the var.');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PgProductRow {
  id: string;                          // UUID
  merchant_id: string;
  title: string;
  description: string | null;
  category: string;
  attributes: Record<string, unknown>;
  price: string | number;              // PG BIGINT → string via pg driver
  stock: number;
  image_url: string | null;
  trend_score: number;
  brand: string | null;
  original_price: string | number | null;
  rating_avg: number;
  rating_count: number;
  sold_count: number;
  image_gradient: string | null;
  icon_hint: string | null;
  status: string;
  created_at: Date;
}

interface CoPurchaseEntry {
  _comment?: string;
  anchor_category: string;
  anchor_brand_filter: string | null;
  suggested_category: string;
  suggested_product_id_seed: string;
  co_purchase_rate_pct: number;
  reason_template: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic pseudo-random from product UUID (idempotent across runs)
// ─────────────────────────────────────────────────────────────────────────────

function seededRandom(seed: string, salt: string): number {
  const h = createHash('sha256').update(seed + ':' + salt).digest('hex');
  // First 8 hex chars → uint32 → [0, 1)
  return parseInt(h.substring(0, 8), 16) / 0x100000000;
}

function rangeRandom(seed: string, salt: string, min: number, max: number): number {
  return min + seededRandom(seed, salt) * (max - min);
}

// ─────────────────────────────────────────────────────────────────────────────
// Derive 11 behavioral signals from sold_count per §X.0 line 700-711 formulas
// ─────────────────────────────────────────────────────────────────────────────

function deriveBehavioralSignals(row: PgProductRow) {
  const sold = row.sold_count;
  const seedId = row.id;

  // §X.0 formulas (deterministic via seededRandom)
  const impressions_7d = Math.round(sold * rangeRandom(seedId, 'imp7', 20, 40));
  const ctr = rangeRandom(seedId, 'ctr', 0.05, 0.12);
  const clicks_7d = Math.round(impressions_7d * ctr);
  const cart_rate = rangeRandom(seedId, 'cart', 0.15, 0.30);
  const add_to_cart_7d = Math.round(clicks_7d * cart_rate);
  const purchases_7d = Math.round(sold / 4);
  const dismiss_rate = rangeRandom(seedId, 'dis', 0.05, 0.10);
  const dismissals_7d = Math.round(clicks_7d * dismiss_rate);

  // 30d aggregates: ~3.5× 7d with mild decay variance
  const decay = rangeRandom(seedId, 'dec', 3.2, 3.8);
  const impressions_30d = Math.round(impressions_7d * decay);
  const clicks_30d = Math.round(clicks_7d * decay);
  const purchases_30d = Math.round(purchases_7d * decay);

  // Derived ratios
  const ctr_7d = impressions_7d > 0 ? clicks_7d / impressions_7d : 0;
  const cvr_7d = clicks_7d > 0 ? purchases_7d / clicks_7d : 0;

  // Composite velocity_score: trend_score × 0.7 + ctr × 100 × 0.3
  const velocity_score = row.trend_score * 0.7 + ctr_7d * 100 * 0.3;

  return {
    impressions_7d,
    clicks_7d,
    add_to_cart_7d,
    purchases_7d,
    dismissals_7d,
    impressions_30d,
    clicks_30d,
    purchases_30d,
    ctr_7d: Number(ctr_7d.toFixed(4)),
    cvr_7d: Number(cvr_7d.toFixed(4)),
    velocity_score: Number(velocity_score.toFixed(4)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Build Vespa Document API feed payload (one product → one HTTP POST body)
// ─────────────────────────────────────────────────────────────────────────────

function buildVespaPayload(row: PgProductRow) {
  const signals = deriveBehavioralSignals(row);

  // Vespa Document API JSON format: { "fields": { ... } }
  // text_embedding OMITTED — Vespa schema indexing expression auto-generates
  // via `embed clip_multilingual` (D-S04-10 LAW).
  // image_embedding OMITTED — S-07 forward-compat (no S-04 work).
  return {
    fields: {
      // Core identity
      id: row.id,
      merchant_id: row.merchant_id,

      // Searchable text (BM25 + auto-embedded)
      title: row.title,
      description: row.description ?? '',

      // Structured attrs (Vespa expects map<string,string>; coerce values)
      category: row.category,
      price: Number(row.price),
      stock: row.stock,
      attributes: Object.fromEntries(
        Object.entries(row.attributes ?? {}).map(([k, v]) => [k, String(v)]),
      ),

      // Display fields (denormalized per ADR-024)
      brand: row.brand ?? '',
      image_url: row.image_url ?? '',
      original_price: row.original_price != null ? Number(row.original_price) : 0,
      rating_avg: row.rating_avg,
      rating_count: row.rating_count,
      sold_count: row.sold_count,
      image_gradient: row.image_gradient ?? '',
      icon_hint: row.icon_hint ?? '',
      status: row.status,

      // Trend + temporal
      trend_score: row.trend_score,
      created_at: Math.floor(row.created_at.getTime() / 1000),

      // 11 behavioral signals (D-S04-11 LAW §X.0 formulas, deterministic)
      ...signals,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolve co-purchase fixture placeholders to actual product UUIDs
// ─────────────────────────────────────────────────────────────────────────────

async function resolveCoPurchaseFixture(client: Client): Promise<void> {
  const fixturePath = join(__dirname, 'co_purchase_category.json');
  const fixture: CoPurchaseEntry[] = JSON.parse(
    readFileSync(fixturePath, 'utf-8'),
  );

  let resolved = 0;
  let skipped = 0;

  for (const entry of fixture) {
    if (!entry.suggested_product_id_seed.startsWith('REPLACE_AT_SEED_RUNTIME:')) {
      // Already resolved on a prior run; leave as-is (idempotent).
      continue;
    }
    const parts = entry.suggested_product_id_seed.split(':');
    // pattern: REPLACE_AT_SEED_RUNTIME:<category>:top1_trend_score
    const targetCategory = parts[1];

    const res = await client.query<{ id: string }>(
      `SELECT id FROM products
        WHERE category = $1 AND status = 'active'
        ORDER BY trend_score DESC
        LIMIT 1`,
      [targetCategory],
    );
    if (res.rowCount && res.rowCount > 0) {
      entry.suggested_product_id_seed = res.rows[0].id;
      resolved++;
    } else {
      console.warn(
        `co_purchase fixture: category="${targetCategory}" not found in products table — leaving placeholder. ` +
          `Expected for "trung" (S-04 scope has only 11 categories per §X.0; "trung" is §X.2 example coverage).`,
      );
      skipped++;
    }
  }

  // Write back (preserves _comment lines + updated UUIDs)
  writeFileSync(
    fixturePath,
    JSON.stringify(fixture, null, 2) + '\n',
    { encoding: 'utf-8' },
  );

  console.log(
    `Co-purchase fixture: resolved ${resolved} UUIDs, skipped ${skipped} (missing category — expected).`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`Vespa feed: source=Postgres, target=${VESPA_ENDPOINT}`);
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    // 1. Resolve co-purchase fixture UUIDs from PG (idempotent — replaces
    //    placeholder strings on first run; no-op subsequent runs).
    await resolveCoPurchaseFixture(client);

    // 2. Read all active products
    const res = await client.query<PgProductRow>(
      `SELECT id, merchant_id, title, description, category, attributes,
              price, stock, image_url, trend_score, brand, original_price,
              rating_avg, rating_count, sold_count, image_gradient, icon_hint,
              status, created_at
         FROM products
        WHERE status = 'active'
        ORDER BY trend_score DESC`,
    );
    const products = res.rows;
    console.log(`Vespa feed: fetched ${products.length} products from Postgres`);

    // 3. POST each product to Vespa Document API
    //    Endpoint: /document/v1/icp/product/docid/<UUID>
    //    Method: POST (Vespa upserts by docid)
    const startMs = Date.now();
    let fed = 0;
    let failed = 0;
    for (const row of products) {
      const payload = buildVespaPayload(row);
      const url = `${VESPA_ENDPOINT}/document/v1/icp/product/docid/${row.id}`;
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          const text = await resp.text();
          console.error(`Feed failed ${row.id} "${row.title}": ${resp.status} ${text.slice(0, 200)}`);
          failed++;
          continue;
        }
        fed++;
      } catch (err) {
        console.error(`Feed error ${row.id} "${row.title}":`, err);
        failed++;
      }
    }

    const durationMs = Date.now() - startMs;
    console.log(`Vespa: indexed ${fed} products in ${durationMs}ms (failed: ${failed})`);

    if (failed > 0) {
      console.error(`Vespa feed PARTIAL FAILURE: ${failed}/${products.length} products failed`);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Vespa feed failed:', err);
  process.exit(1);
});
