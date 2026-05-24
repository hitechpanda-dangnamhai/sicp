#!/usr/bin/env tsx
/**
 * seed.ts — ICP development seed runner.
 *
 * Loads users.json, products.json, policies.json; bcrypt-hashes user passwords;
 * inserts to Postgres idempotently. Designed to be re-runnable: second run
 * produces 0 inserts (all skipped).
 *
 * Usage:
 *   pnpm --filter @icp/seed run seed                 # canonical (per Makefile target)
 *   DATABASE_URL=postgresql://... tsx seed.ts        # direct invocation
 *
 * Pre-requisite: `make migrate` (apply.sh chain V001→V008) đã run xong, schema
 * tables (users, products, policies) đã tồn tại.
 *
 * Decision references:
 * - D-01: bcrypt cost 10 via `bcryptjs` (pure JS, no native binding for CI).
 * - D-05: TypeScript ESM module + bundler resolution (extends tsconfig.base).
 * - C13 (Phiên 7): transactions table có user_id + updated_at; KHÔNG seed
 *   transactions trong T05 scope (deferred S-02).
 * - C14 (Phiên 8): Makefile `seed:` target dùng `pnpm --filter @icp/seed run seed`
 *   để invoke tsx (this file).
 * - C14-bis (Phiên 8): users.json composition = 2 merchant + 2 customer + 1
 *   admin per PHASE_01_INFRA canonical spec.
 * - C15 (Phiên 8): policies.json rule_dsl shape = Path ε compromise — simple
 *   `trigger / condition / action` shape + canonical event vocab
 *   `ProductDraftSubmitted` / `StockChanged`.
 *
 * Idempotency contract (per execution guide §4.5 line 1310 test scenario):
 * - Lần 1: 5 users + 50 products + 2 policies inserted
 * - Lần 2: 0 inserted, all skipped
 *
 * Idempotency mechanism per table:
 * - users:    `ON CONFLICT (email) DO NOTHING` (UNIQUE constraint V001:70)
 * - policies: `ON CONFLICT (code) DO NOTHING` (UNIQUE constraint V001:152)
 * - products: SELECT pre-check guard on (merchant_id, title) — V001 KHÔNG có
 *   UNIQUE constraint matching natural key (PK is gen_random_uuid() never
 *   collides). Path B per Q-4 Phiên 8 ack. See decisions-log.md Q-4 deviation
 *   note trong Report §5.
 */

import { Client } from 'pg';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';

// ESM-compatible __dirname (D-05 module: esnext + bundler resolution).
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env từ repo root (2 levels up: infra/seed/ → repo root). Pattern parity
// với T04 apply.sh BASH_SOURCE-relative resolution.
loadEnv({ path: join(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not set. Check .env or export the var.');
  process.exit(1);
}

const BCRYPT_COST = 10; // D-01

// ─────────────────────────────────────────────────────────────────────────────
// Type definitions cho seed JSON files (local — không import @icp/shared-types
// vì seed package standalone, scope T05 minimal).
// ─────────────────────────────────────────────────────────────────────────────

interface UserSeed {
  email: string;
  password: string;
  role: 'merchant' | 'customer' | 'admin';
  display_name: string;
}

interface ProductSeed {
  title: string;
  description: string;
  category: string;
  attributes: Record<string, unknown>;
  price: number;
  stock: number;
  image_url: string;
  trend_score: number;
  merchant_email: string;
  // S-04 T01 (Phiên Sx04-2) D-S04-11 LAW — V002 display columns extension.
  // Optional fields: 50 legacy products.json (pre-S-04) won't have them;
  // 55 curated products.json (post-S-04) populates all. Backfill on INSERT
  // uses NULL fallback for missing values (V002 columns nullable per
  // V002__product_enrichment.sql). brand mirrors attributes.brand for query
  // perf per ADR-024 denormalization. status defaults 'active' per V001.
  brand?: string;
  original_price?: number | null;
  rating_avg?: number;
  rating_count?: number;
  sold_count?: number;
  image_gradient?: string;
  icon_hint?: string;
}

interface PolicySeed {
  code: string;
  description: string;
  rule_dsl: Record<string, unknown>;
  priority: number;
  enabled: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    // === 1. USERS ===========================================================
    const users: UserSeed[] = JSON.parse(
      readFileSync(join(__dirname, 'users.json'), 'utf-8'),
    );
    let usersInserted = 0;
    for (const u of users) {
      const hash = await bcrypt.hash(u.password, BCRYPT_COST);
      const res = await client.query(
        `INSERT INTO users (email, password_hash, role, display_name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        [u.email, hash, u.role, u.display_name],
      );
      if (res.rowCount === 1) usersInserted++;
    }
    console.log(
      `Users:    inserted ${usersInserted}, skipped ${users.length - usersInserted}`,
    );

    // === 2. PRODUCTS ========================================================
    // Q-4 Path B (Phiên 8): SELECT pre-check guard on (merchant_id, title).
    // V001 products table KHÔNG có UNIQUE constraint khả thi cho natural-key
    // idempotency (PK gen_random_uuid() never collides; no UNIQUE on
    // merchant_id+title). Pre-check ensures re-runnable seed.
    const products: ProductSeed[] = JSON.parse(
      readFileSync(join(__dirname, 'products.json'), 'utf-8'),
    );
    let productsInserted = 0;
    let productsSkipped = 0;
    for (const p of products) {
      // Resolve merchant_id từ email (JSON-side reference → UUID lookup).
      const merchantRes = await client.query<{ id: string }>(
        'SELECT id FROM users WHERE email = $1',
        [p.merchant_email],
      );
      if (merchantRes.rowCount === 0) {
        console.warn(
          `Skip product "${p.title}" — merchant ${p.merchant_email} not found.`,
        );
        productsSkipped++;
        continue;
      }
      const merchantId = merchantRes.rows[0].id;

      // Q-4 Path B idempotency guard.
      const existsRes = await client.query(
        'SELECT 1 FROM products WHERE merchant_id = $1 AND title = $2 LIMIT 1',
        [merchantId, p.title],
      );
      if (existsRes.rowCount && existsRes.rowCount > 0) {
        productsSkipped++;
        continue;
      }

      const insRes = await client.query(
        `INSERT INTO products
           (merchant_id, title, description, category, attributes,
            price, stock, image_url, trend_score,
            brand, original_price, rating_avg, rating_count, sold_count,
            image_gradient, icon_hint, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
                 $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING id`,
        [
          merchantId,
          p.title,
          p.description,
          p.category,
          JSON.stringify(p.attributes),
          p.price,
          p.stock,
          p.image_url || null,
          p.trend_score || 0,
          // S-04 T01 (Phiên Sx04-2) D-S04-11 LAW — V002 columns. Curated 55
          // products populate all; legacy 50 (pre-S-04) backfill NULL/default
          // via ?? operator. status always 'active' per V001 CHECK constraint.
          p.brand ?? null,
          p.original_price ?? null,
          p.rating_avg ?? 0,
          p.rating_count ?? 0,
          p.sold_count ?? 0,
          p.image_gradient ?? null,
          p.icon_hint ?? null,
          'active',
        ],
      );
      if (insRes.rowCount === 1) productsInserted++;
    }
    console.log(
      `Products: inserted ${productsInserted}, skipped ${productsSkipped}`,
    );

    // === 3. POLICIES ========================================================
    const policies: PolicySeed[] = JSON.parse(
      readFileSync(join(__dirname, 'policies.json'), 'utf-8'),
    );
    let policiesInserted = 0;
    for (const pol of policies) {
      const res = await client.query(
        `INSERT INTO policies (code, description, rule_dsl, priority, enabled)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code) DO NOTHING
         RETURNING id`,
        [
          pol.code,
          pol.description,
          JSON.stringify(pol.rule_dsl),
          pol.priority,
          pol.enabled,
        ],
      );
      if (res.rowCount === 1) policiesInserted++;
    }
    console.log(
      `Policies: inserted ${policiesInserted}, skipped ${policies.length - policiesInserted}`,
    );

    console.log('Seed complete.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
