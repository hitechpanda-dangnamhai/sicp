#!/usr/bin/env tsx
/**
 * ⚠️ TOMBSTONE (S-P0-01 T03d, 2026-06-12) — CẤM CHẠY tới khi rework (BACKLOG #33).
 *   Dưới icp_app: RLS → SELECT products 0 rows, script chết lành.
 *   Dưới role owner/admin: RLS không áp → đọc products MỌI tenant + ghi
 *   Vespa-direct cross-tenant = Ô NHIỄM DỮ LIỆU.
 *   Script PG-direct + Vespa-direct bypass MCP — vi phạm ADR-003 pre-existing.
 *   Rework: per-tenant + identity header + đi qua MCP.
 *
 * scripts/backfill-image-descriptions.ts — S-09 D-S09-NN-D LAW Step 2.
 *
 * Slice: S-09 First Image-Based Product Recommendation (Intent 04 V-SLICE).
 * Task:  T01 Block 2 — Seed image data 2-step pipeline (Step 2 of 2).
 *
 * Purpose: for each product with `image_data` populated (Step 1 completed),
 * call MCP `vision.analyze` to extract category + attributes + OCR text →
 * build composite `image_description` string → POST Vespa document update
 * with `fields.image_description: {assign: ...}` → Vespa native indexing-time
 * `embed clip_multilingual` automatically populates `image_embedding` 512-d
 * (per D-S09-NN-C LAW cross-modal CLIP cornerstone).
 *
 * Why this 2-step pattern (D-S09-NN-D LAW):
 *   Vespa synthetic fields with `embed` indexing expression CANNOT be fed
 *   directly. They derive from document field inputs at indexing time. So:
 *     1. We POST text to `image_description` (document field)
 *     2. Vespa internally pipes that text through clip_multilingual embedder
 *     3. Resulting 512-d vector lands in `image_embedding` (synthetic field)
 *   This pathway eliminates the need for a separate `vision.embed` MCP tool
 *   (retracted per C-S09-A) and reuses the same CLIP model as text_embedding
 *   for cross-modal vector parity per ADR-036.
 *
 * Idempotency contract (per D-S09-NN-D LAW step 2 guarantee):
 *   - Skip products where vision.analyze fails (logged, not fatal)
 *   - Vespa update is upsert-style (last-write-wins) — safe to re-run
 *   - Re-run after Vespa redeploy is REQUIRED if schema was changed
 *
 * Usage:
 *   pnpm tsx scripts/backfill-image-descriptions.ts
 *   DATABASE_URL=postgres://icp:icp@localhost:5432/icp \
 *   VESPA_URL=http://localhost:8080 \
 *   MCP_URL=http://localhost:5050 \
 *     tsx scripts/backfill-image-descriptions.ts
 *
 * Decision references:
 *   - D-S09-NN-C LAW (slices/S-09_decisions-log.md §1) — cross-modal CLIP cornerstone
 *   - D-S09-NN-D LAW (slices/S-09_decisions-log.md §1) — 2-step pipeline mandatory
 *   - C-S07-L (slices/S-07_decisions-log.md) — vision.analyze rich return shape
 *   - PHASE_05_RECO_ANALYTICS.md §B — Image Embedding Pipeline (S-09 scope)
 *   - apps/mcp/src/tools/vision.py:265 — vision.analyze signature reference
 */

import { Client } from 'pg';
import { config as loadEnv } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─────────────────────────────────────────────────────────────────────────────
// Env + path setup
// ─────────────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
loadEnv({ path: join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL;
const VESPA_URL = process.env.VESPA_URL || 'http://localhost:8080';
const MCP_URL = process.env.MCP_URL || 'http://localhost:5050';
const VESPA_TIMEOUT_MS = 10_000;
const VISION_TIMEOUT_S = 8.0; // Slightly above MCP default 5s for backfill leniency

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not set. Check .env or export the var.');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// MCP vision.analyze client (calls Flask MCP server HTTP endpoint)
// ─────────────────────────────────────────────────────────────────────────────

interface VisionAnalyzeResult {
  category: string;
  attributes: Record<string, string>;
  ocr_text: string;
  confidence: number;
  confidence_per_field?: Record<string, number>;
}

async function callVisionAnalyze(
  imageDataUri: string,
): Promise<VisionAnalyzeResult> {
  // image_data column already stored as data URI (`data:image/png;base64,...`).
  // vision.analyze accepts both prefixed and raw base64 per vision.py:274 strip.
  const body = {
    jsonrpc: '2.0',
    id: `backfill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    method: 'vision.analyze',
    params: {
      image_b64: imageDataUri,
      timeout_s: VISION_TIMEOUT_S,
    },
  };

  const resp = await fetch(`${MCP_URL}/rpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout((VISION_TIMEOUT_S + 2) * 1000),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`vision.analyze HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }
  const payload = (await resp.json()) as { jsonrpc?: string; id?: string; result?: VisionAnalyzeResult; error?: { code: number; message: string; data?: unknown } };
  if (payload.error) {
    throw new Error(`vision.analyze error: ${payload.error.message} (code ${payload.error.code})`);
  }
  if (!payload.result) {
    throw new Error('vision.analyze returned empty result');
  }
  return payload.result;
}

// ─────────────────────────────────────────────────────────────────────────────
// image_description template — composite text for Vespa CLIP embed
// ─────────────────────────────────────────────────────────────────────────────
//
// The CLIP-multilingual model produces best vectors from natural-language
// product descriptions in Vietnamese. We concatenate:
//   1. Product title (high-signal, always present)
//   2. Category (canonical taxonomy bucket)
//   3. OCR text from vision (brand names, package text — often missed by title)
//   4. Key attributes (brand, flavor, size) flattened key:value style
//
// Result is fed to image_description field → triggers Vespa native embed.

function buildImageDescription(
  title: string,
  category: string,
  visionResult: VisionAnalyzeResult,
): string {
  const parts: string[] = [];

  // 1. Title (always present — comes from PG products.title)
  if (title) parts.push(title);

  // 2. Category (from PG; fallback to vision)
  const cat = category || visionResult.category;
  if (cat && cat !== 'unknown') parts.push(cat);

  // 3. OCR text (vision-extracted; may contain brand markers)
  if (visionResult.ocr_text) {
    parts.push(visionResult.ocr_text.slice(0, 200));
  }

  // 4. Key attributes flattened (per C-S07-L vision.analyze return shape)
  for (const key of ['brand', 'flavor', 'size', 'color']) {
    const val = visionResult.attributes?.[key];
    if (val) parts.push(`${key}:${val}`);
  }

  return parts.join(' ').trim().slice(0, 500);
}

// ─────────────────────────────────────────────────────────────────────────────
// Vespa partial update — POST to /document/v1/icp/product/docid/{id}
// ─────────────────────────────────────────────────────────────────────────────

async function postVespaUpdate(
  productId: string,
  imageDescription: string,
): Promise<void> {
  const url = `${VESPA_URL}/document/v1/icp/product/docid/${productId}`;
  const body = {
    fields: {
      image_description: { assign: imageDescription },
    },
  };
  const resp = await fetch(url, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(VESPA_TIMEOUT_MS),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(
      `Vespa update HTTP ${resp.status} for product ${productId}: ${text.slice(0, 200)}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main loop
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('🖼️  S-09 T01 backfill-image-descriptions — Step 2/2 Vespa CLIP embed');
  console.log(`   MCP: ${MCP_URL} · Vespa: ${VESPA_URL}`);
  console.log('');

  try {
    const res = await client.query<{
      id: string;
      title: string;
      category: string;
      image_data: string;
    }>(
      `SELECT id::text, title, category, image_data
       FROM products
       WHERE image_data IS NOT NULL`,
    );

    const targets = res.rows;
    const totalEligible = targets.length;

    if (totalEligible === 0) {
      console.warn('⚠️  0 products have image_data. Run Step 1 first:');
      console.warn('     pnpm tsx scripts/seed-product-images.ts');
      return;
    }

    console.log(`📦 ${totalEligible} products eligible for image_description backfill`);
    let succeeded = 0;
    let failed = 0;
    const failures: Array<{ id: string; title: string; error: string }> = [];

    for (const p of targets) {
      try {
        // C-S09-AA Phiên Sx09-C: Backfill alternative path for placeholder images.
        // vision.analyze returns confidence < 0.3 for synthetic noise-pattern PNGs
        // (no semantic content for Gemini to extract) → 3-threshold blur check Ω₂
        // would skip them. For seed/backfill path, build image_description from PG
        // title + category directly (TEXT-ONLY pathway). Production Intent 04 flow
        // (recommend_by_images.py customer upload) still uses full vision.analyze.
        //
        // Real customer images would have rich features → would pass blur check.
        // Hackathon seed PNGs are placeholder → bypass vision pragmatically.
        const USE_VISION = process.env.BACKFILL_USE_VISION === '1';
        let description: string;

        if (USE_VISION) {
          // Path A: vision.analyze + composite description (production-like)
          const vision = await callVisionAnalyze(p.image_data);
          description = buildImageDescription(p.title, p.category, vision);
        } else {
          // Path B (default for seed): text-only from PG ground truth
          description = `${p.title} ${p.category}`.trim();
        }

        if (!description) {
          throw new Error('Empty image_description after build');
        }

        // POST to Vespa — triggers native indexing-time embed
        await postVespaUpdate(p.id, description);
        succeeded++;

        if (succeeded % 10 === 0) {
          console.log(`   ... ${succeeded}/${totalEligible} done`);
        }
      } catch (err) {
        failed++;
        const errMsg = err instanceof Error ? err.message : String(err);
        failures.push({ id: p.id, title: p.title, error: errMsg });
        // Continue — graceful degrade per D-S04-15 LAW timeout pattern
      }
    }

    console.log('');
    console.log(`✅ Backfilled ${succeeded}/${totalEligible} products`);
    if (failed > 0) {
      console.warn(`⚠️  ${failed} failures:`);
      for (const f of failures.slice(0, 5)) {
        console.warn(`   - ${f.id} (${f.title}): ${f.error}`);
      }
      if (failures.length > 5) {
        console.warn(`   ... and ${failures.length - 5} more failures`);
      }
    }
    console.log('');
    console.log('Verify via:');
    console.log(`   curl '${VESPA_URL}/document/v1/icp/product/docid/<id>' | jq '.fields.image_description'`);
    console.log(`   curl '${VESPA_URL}/search/?yql=select+id,title+from+product+where+nearestNeighbor(image_embedding,query_embedding)+limit+5&input.query(query_embedding)=embed(@desc,clip_multilingual)&desc=mì+cay+đỏ' | jq '.root.children'`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('💥 FATAL:', err);
  process.exit(1);
});
