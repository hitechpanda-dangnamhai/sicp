#!/usr/bin/env node
/**
 * scripts/check-coverage.mjs — S-P0-03/T01 (W-76) coverage RATCHET gate.
 *
 * Reads coverage.floors.json (the committed floors) and, for each app, the
 * vitest json-summary at apps/<app>/coverage/coverage-summary.json. Fails (exit
 * 1) if any app's lines% is BELOW its floor. A floored app with no coverage
 * report is also a failure (the CI test:cov step must run first).
 *
 * Ratchet rule: floors only go UP (raise each cluster). Never lower to go green
 * — that is the soft-fail anti-pattern this slice exists to kill (S-P0-03 §0.5).
 *
 * Usage: node scripts/check-coverage.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const cfg = JSON.parse(readFileSync(join(ROOT, 'coverage.floors.json'), 'utf-8'));
const floors = cfg.floors ?? {};

let failed = false;
const rows = [];

for (const [app, floor] of Object.entries(floors)) {
  const summaryPath = join(ROOT, 'apps', app, 'coverage', 'coverage-summary.json');
  let pct;
  try {
    const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));
    pct = summary.total?.lines?.pct;
  } catch {
    rows.push(`  ${app.padEnd(10)} floor ${String(floor).padStart(3)}%  actual   N/A  ❌ no coverage report (${summaryPath})`);
    failed = true;
    continue;
  }
  if (typeof pct !== 'number') {
    rows.push(`  ${app.padEnd(10)} floor ${String(floor).padStart(3)}%  actual   N/A  ❌ malformed summary`);
    failed = true;
    continue;
  }
  const ok = pct >= floor;
  if (!ok) failed = true;
  rows.push(
    `  ${app.padEnd(10)} floor ${String(floor).padStart(3)}%  actual ${pct.toFixed(2).padStart(6)}%  ${ok ? '✅' : '❌ BELOW FLOOR'}`,
  );
}

console.log('Coverage ratchet (metric: lines)');
console.log(rows.join('\n'));

if (failed) {
  console.error('\n::error::Coverage below floor (or report missing). Raise tests or, with an ADR, the floor — do NOT lower silently.');
  process.exit(1);
}
console.log('\nCoverage ratchet OK — all apps at/above floor.');
