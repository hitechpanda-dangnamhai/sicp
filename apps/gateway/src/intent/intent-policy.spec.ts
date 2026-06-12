/**
 * apps/gateway/src/intent/intent-policy.spec.ts
 *
 * S-P0-01 T03e (ADR-050) — table-driven matrix cho intentRequiresMembership.
 * Mỗi ô = 1 (modality, hint) → membership class, mirror main.py:326-398.
 * Membership-required {01 import, 07 analyzing} + default-deny tuple lạ; customer
 * -allowed {02 buy, 03 search, 04 recommend, 05 cart}.
 */

import { describe, it, expect } from 'vitest';
import { intentRequiresMembership } from './intent-policy';

type Row = {
  intent: string;
  modality: unknown;
  hint: unknown;
  requires: boolean;
};

// Mỗi hàng = 1 ô matrix; `requires`=true → đòi membership (403 cho customer).
const MATRIX: Row[] = [
  // ── membership-required (01 import, 07 analyzing) ──
  { intent: '01 import (image, no hint)', modality: 'image', hint: undefined, requires: true },
  { intent: '01 import (image, hint=import)', modality: 'image', hint: 'import', requires: true },
  { intent: '07 analyzing (voice, analyze)', modality: 'voice', hint: 'analyze', requires: true },

  // ── customer-allowed (02 buy, 03 search, 04 recommend, 05 cart) ──
  { intent: '04 recommend (image, recommend)', modality: 'image', hint: 'recommend', requires: false },
  { intent: '02 buy (voice, no hint)', modality: 'voice', hint: undefined, requires: false },
  { intent: '02 buy (voice, hint=buy)', modality: 'voice', hint: 'buy', requires: false },
  { intent: '05 cart (text, cart_clear_confirm)', modality: 'text', hint: 'cart_clear_confirm', requires: false },
  { intent: '05 cart (text, cart_view_with_stock_check)', modality: 'text', hint: 'cart_view_with_stock_check', requires: false },
  { intent: '03 search (text, no hint)', modality: 'text', hint: undefined, requires: false },
  { intent: '03 search (text, hint=search)', modality: 'text', hint: 'search', requires: false },
  { intent: '03 search (text, hint=buy)', modality: 'text', hint: 'buy', requires: false },
  { intent: '03 search (text, hint=recommend)', modality: 'text', hint: 'recommend', requires: false },

  // ── DEFAULT-DENY tuple lạ (ADR-050 §3 — fail-closed) ──
  { intent: 'default-deny (text, analyze) — analyze là voice-only', modality: 'text', hint: 'analyze', requires: true },
  { intent: 'default-deny (text, hint lạ ngoài enum)', modality: 'text', hint: 'frobnicate', requires: true },
  { intent: 'default-deny (image, cart hint) → import 01', modality: 'image', hint: 'cart_clear_confirm', requires: true },
];

describe('intentRequiresMembership — matrix (T03e ADR-050)', () => {
  for (const row of MATRIX) {
    it(`${row.intent} → membership=${row.requires}`, () => {
      expect(intentRequiresMembership(row.modality, row.hint)).toBe(row.requires);
    });
  }

  it('coerce non-string modality/hint → undefined (raw body trước Zod pipe)', () => {
    // modality lạ + hint number → text branch, hint→undefined → search (customer).
    expect(intentRequiresMembership(123, 456)).toBe(false);
    // modality null → text, hint undefined → search.
    expect(intentRequiresMembership(null, null)).toBe(false);
  });
});
