/**
 * apps/web/__tests__/S-04-T05-state-machine.test.ts
 *
 * Vitest smoke test for search state machine reducer + tier filter (T05 Phiên Sx04-10).
 *
 * Slice:    S-04 First Product Discovery
 * Task:     T05 FE Page Wire — smoke verification (BONUS per user direction Sx04-9a precedent
 *           "tại sao bạn không có smoke test" → continue test-first emit pattern).
 *
 * Coverage:
 * - reduceState: 12 actions (submit/status/phase_progress/understanding/product_ready/
 *                products/typo_suggestion/variant_degraded/co_purchase_hint/empty_state/
 *                final/error/set_cart_confirm/dismiss_cart_confirm/set_match_tier/retry_ai/
 *                continue_basic/reset)
 * - filterProductsByTier: 3 tiers (all/exact/similar) × edge cases (empty, undefined score,
 *                         0-1 ratio vs 0-100 scale, sparse array)
 * - retry_ai: attemptN monotonic increment + state reset
 * - continue_basic: mode flip to basic_fallback
 *
 * Pattern: Pure function tests — no React, no DOM, no async, no mocks. ~15ms full suite.
 *
 * Run: `pnpm --filter @icp/web test -- S-04-T05-state-machine`
 */

import { describe, it, expect } from 'vitest';
import {
  initialState,
  reduceState,
  filterProductsByTier,
  type SearchState,
  type SearchProductItem,
} from '@/src/features/search/search-state-machine';

// ─── reduceState — submit + lifecycle ────────────────────────────────────────

describe('reduceState — submit + lifecycle', () => {
  it('submit: idle → streaming, preserves attemptN', () => {
    const s1 = reduceState(initialState, {
      type: 'submit',
      query: 'nước tương',
      requestId: 'rid_abc123',
      mode: 'ai_augmented',
    });
    expect(s1.kind).toBe('streaming');
    expect(s1.query).toBe('nước tương');
    expect(s1.requestId).toBe('rid_abc123');
    expect(s1.mode).toBe('ai_augmented');
    expect(s1.attemptN).toBe(1);
    // Resets SSE-derived fields
    expect(s1.products).toEqual([]);
    expect(s1.understanding).toBeNull();
    expect(s1.matchTierFilter).toBe('all');
  });

  it('submit twice preserves attemptN counter (no reset)', () => {
    const s1 = reduceState(
      { ...initialState, attemptN: 3 },
      { type: 'submit', query: 'q1', requestId: 'r1', mode: 'ai_augmented' },
    );
    expect(s1.attemptN).toBe(3);
  });

  it('status: idle + non-done phase → flips to streaming', () => {
    const s1 = reduceState(initialState, { type: 'status', phase: 'searching' });
    expect(s1.kind).toBe('streaming');
  });

  it('status: idle + done phase → stays idle (final event drives terminal)', () => {
    const s1 = reduceState(initialState, { type: 'status', phase: 'done' });
    expect(s1.kind).toBe('idle');
  });

  it('phase_progress: writes to phases map at phase_id key', () => {
    const s1 = reduceState(
      { ...initialState, kind: 'streaming' },
      {
        type: 'phase_progress',
        payload: {
          phase_id: 1,
          label: 'Tìm sản phẩm',
          status: 'done',
          ms: 158,
        },
      },
    );
    expect(s1.phases[1]).toMatchObject({
      phase_id: 1,
      label: 'Tìm sản phẩm',
      status: 'done',
      ms: 158,
    });
    expect(s1.phases[0]).toBeUndefined();
  });

  it('phase_progress: fallback label when server omits', () => {
    const s1 = reduceState(
      { ...initialState, kind: 'streaming' },
      {
        type: 'phase_progress',
        payload: { phase_id: 0, status: 'active' },
      },
    );
    expect(s1.phases[0]?.label).toBe('Hiểu ngữ nghĩa câu hỏi');
  });

  it('understanding: stores text + highlighted terms', () => {
    const s1 = reduceState(
      { ...initialState, kind: 'streaming' },
      {
        type: 'understanding',
        text: 'Anh cần nước tương đậm đặc',
        highlighted: ['nước tương đậm đặc'],
      },
    );
    expect(s1.understanding).toEqual({
      text: 'Anh cần nước tương đậm đặc',
      highlighted: ['nước tương đậm đặc'],
    });
  });
});

// ─── reduceState — product_ready (D-S04-14 LAW per-index slot) ──────────────

describe('reduceState — product_ready (per-index slot)', () => {
  it('product_ready: first event sets totalExpected + writes products[index]', () => {
    const s1 = reduceState(
      { ...initialState, kind: 'streaming' },
      {
        type: 'product_ready',
        item: { product_id: 'p1', brand: 'MAGGI', name: 'Nước tương 700ml', match_score: 0.98 },
        index: 0,
        total: 8,
      },
    );
    expect(s1.totalExpected).toBe(8);
    expect(s1.products).toHaveLength(8);
    expect(s1.products[0]).toMatchObject({ product_id: 'p1', match_score: 0.98 });
    // Slots 1..7 are sparse (undefined) — render as shimmer skeleton.
    expect(s1.products[7]).toBeUndefined();
  });

  it('product_ready: out-of-order arrival writes correct slot', () => {
    let s: SearchState = { ...initialState, kind: 'streaming' };
    s = reduceState(s, {
      type: 'product_ready',
      item: { product_id: 'p_idx2' },
      index: 2,
      total: 4,
    });
    s = reduceState(s, {
      type: 'product_ready',
      item: { product_id: 'p_idx0' },
      index: 0,
      total: 4,
    });
    expect(s.products[0]).toMatchObject({ product_id: 'p_idx0' });
    expect(s.products[2]).toMatchObject({ product_id: 'p_idx2' });
    expect(s.products[1]).toBeUndefined();
    expect(s.products[3]).toBeUndefined();
  });

  it('products canonical event: overwrites array + flips kind to result', () => {
    const s1 = reduceState(
      { ...initialState, kind: 'streaming' },
      {
        type: 'products',
        items: [
          { product_id: 'p1', brand: 'A', match_score: 0.95 },
          { product_id: 'p2', brand: 'B', match_score: 0.85 },
        ],
        mode: 'ai_augmented',
      },
    );
    expect(s1.kind).toBe('result');
    expect(s1.products).toHaveLength(2);
    expect(s1.mode).toBe('ai_augmented');
    expect(s1.matchTierFilter).toBe('all'); // resets to all on fresh products
  });
});

// ─── reduceState — Pattern P2 interrupt states (D-S04-13 LAW) ───────────────

describe('reduceState — Pattern P2 interrupts', () => {
  it('typo_suggestion: kind → pending_typo_confirm + stores payload', () => {
    const s1 = reduceState(
      { ...initialState, kind: 'streaming' },
      {
        type: 'typo_suggestion',
        payload: {
          original: 'mai gi',
          corrected: 'Maggi',
          confidence: 0.94,
          actions: [
            { label: 'Đúng rồi', value: 'accept' },
            { label: 'Không phải', value: 'reject' },
          ],
        },
      },
    );
    expect(s1.kind).toBe('pending_typo_confirm');
    expect(s1.typoSuggestion?.corrected).toBe('Maggi');
  });

  it('variant_degraded: kind → pending_degrade_choice + preserves trace_id', () => {
    const s1 = reduceState(
      { ...initialState, kind: 'streaming' },
      {
        type: 'variant_degraded',
        payload: {
          from: 'ai_augmented',
          to: 'basic_fallback',
          reason: 'llm_timeout',
          error_code: 'E_LLM_TIMEOUT',
          trace_id: 'b7e1abcd1234efgh5678ijkl9012d042',
          title: 'Mô hình AI phản hồi chậm',
          user_message: 'Em đang quá tải...',
        },
      },
    );
    expect(s1.kind).toBe('pending_degrade_choice');
    expect(s1.variantDegraded?.error_code).toBe('E_LLM_TIMEOUT');
    expect(s1.variantDegraded?.trace_id).toBe('b7e1abcd1234efgh5678ijkl9012d042');
  });

  it('co_purchase_hint: stays in result kind (renders as additional element)', () => {
    const s0: SearchState = {
      ...initialState,
      kind: 'result',
      mode: 'ai_augmented',
      products: [{ product_id: 'p1' } as SearchProductItem],
    };
    const s1 = reduceState(s0, {
      type: 'co_purchase_hint',
      payload: {
        rate_pct: 68,
        reason: 'Khách phở hay lấy kèm tương ớt',
        suggested_product: { brand: 'CHIN-SU', name: 'Tương ớt 250g', price: 17000 },
        anchor_category: 'nuoc_tuong',
        suggested_category: 'tuong_ot',
      },
    });
    expect(s1.kind).toBe('result');
    expect(s1.coPurchaseHint?.rate_pct).toBe(68);
  });

  it('empty_state: kind → empty + clears products', () => {
    const s1 = reduceState(
      { ...initialState, kind: 'streaming' },
      {
        type: 'empty_state',
        payload: {
          message: 'Em tìm cả với từ khóa liên quan nhưng kho chưa có',
          fallback_actions: [
            { type: 'widen_query', label: 'Tìm "gia vị cay" tổng quát', value: 'gia vị cay' },
            { type: 'capture_image', label: 'Chụp ảnh' },
            { type: 'create_product', label: 'Nhập hàng mới' },
          ],
          suggested_queries: ['Tương ớt', 'Mắm tôm Huế', 'Bột nghệ'],
        },
      },
    );
    expect(s1.kind).toBe('empty');
    expect(s1.emptyState?.fallback_actions).toHaveLength(3);
    expect(s1.products).toEqual([]);
  });
});

// ─── reduceState — retry_ai + continue_basic (D-S04-13 LAW resume) ──────────

describe('reduceState — retry_ai + continue_basic', () => {
  it('retry_ai: bumps attemptN + clears pending state + back to streaming', () => {
    const s0: SearchState = {
      ...initialState,
      kind: 'pending_degrade_choice',
      query: 'nước tương',
      requestId: 'rid_xyz',
      attemptN: 2,
      mode: 'ai_augmented',
      variantDegraded: {
        from: 'ai_augmented',
        to: 'basic_fallback',
        reason: 'llm_timeout',
        error_code: 'E_LLM_TIMEOUT',
        trace_id: '...',
        title: '...',
        user_message: '...',
      },
    };
    const s1 = reduceState(s0, { type: 'retry_ai' });
    expect(s1.kind).toBe('streaming');
    expect(s1.attemptN).toBe(3);
    expect(s1.mode).toBe('ai_augmented');
    expect(s1.query).toBe('nước tương'); // preserved
    expect(s1.requestId).toBe('rid_xyz'); // preserved (same checkpoint)
    expect(s1.variantDegraded).toBeNull(); // cleared
  });

  it('continue_basic: flips mode to basic_fallback + bumps attemptN', () => {
    const s0: SearchState = {
      ...initialState,
      kind: 'pending_degrade_choice',
      query: 'nước tương',
      requestId: 'rid_xyz',
      attemptN: 1,
      mode: 'ai_augmented',
    };
    const s1 = reduceState(s0, { type: 'continue_basic' });
    expect(s1.kind).toBe('streaming');
    expect(s1.mode).toBe('basic_fallback');
    expect(s1.attemptN).toBe(2);
  });
});

// ─── reduceState — cart confirm + match tier filter ─────────────────────────

describe('reduceState — cart confirm + match tier (D-S04-16 LAW)', () => {
  it('set_cart_confirm: stores summary; dismiss_cart_confirm: clears', () => {
    const s1 = reduceState(initialState, {
      type: 'set_cart_confirm',
      item: { title: 'Maggi 700ml', price: 25500 },
    });
    expect(s1.addToCartConfirm).toEqual({ title: 'Maggi 700ml', price: 25500 });
    const s2 = reduceState(s1, { type: 'dismiss_cart_confirm' });
    expect(s2.addToCartConfirm).toBeNull();
  });

  it('set_match_tier: updates filter; default is "all"', () => {
    expect(initialState.matchTierFilter).toBe('all');
    const s1 = reduceState(initialState, { type: 'set_match_tier', tier: 'exact' });
    expect(s1.matchTierFilter).toBe('exact');
    const s2 = reduceState(s1, { type: 'set_match_tier', tier: 'similar' });
    expect(s2.matchTierFilter).toBe('similar');
  });

  it('error: kind → error + stores message', () => {
    const s1 = reduceState(initialState, { type: 'error', message: 'Network drop' });
    expect(s1.kind).toBe('error');
    expect(s1.errorMessage).toBe('Network drop');
  });

  it('reset: returns to initialState', () => {
    const s0: SearchState = { ...initialState, kind: 'result', query: 'x', attemptN: 5 };
    const s1 = reduceState(s0, { type: 'reset' });
    expect(s1).toEqual(initialState);
  });
});

// ─── filterProductsByTier (D-S04-16 LAW client-side filter) ────────────────

describe('filterProductsByTier', () => {
  const baseItems: SearchProductItem[] = [
    { product_id: 'a', match_score: 0.98 }, // exact
    { product_id: 'b', match_score: 0.92 }, // exact (boundary)
    { product_id: 'c', match_score: 0.91 }, // similar (below threshold)
    { product_id: 'd', match_score: 0.79 }, // similar
  ];

  it('all: returns input ref unchanged (render-optimized identity)', () => {
    expect(filterProductsByTier(baseItems, 'all')).toBe(baseItems);
  });

  it('exact: filters score >= 0.92', () => {
    const r = filterProductsByTier(baseItems, 'exact');
    expect(r).toHaveLength(2);
    expect(r.map((p) => p.product_id)).toEqual(['a', 'b']);
  });

  it('similar: filters score < 0.92', () => {
    const r = filterProductsByTier(baseItems, 'similar');
    expect(r).toHaveLength(2);
    expect(r.map((p) => p.product_id)).toEqual(['c', 'd']);
  });

  it('handles 0-100 scale: 98/95/91/79 normalized via /100', () => {
    const items100: SearchProductItem[] = [
      { product_id: 'a', match_score: 98 }, // exact
      { product_id: 'b', match_score: 91 }, // similar
    ];
    expect(filterProductsByTier(items100, 'exact')).toHaveLength(1);
    expect(filterProductsByTier(items100, 'similar')).toHaveLength(1);
  });

  it('skips undefined slots (sparse skeleton arrays during streaming)', () => {
    const sparse: SearchProductItem[] = new Array(4) as SearchProductItem[];
    sparse[0] = { product_id: 'a', match_score: 0.95 };
    // sparse[1..3] = undefined skeleton slots
    const r = filterProductsByTier(sparse, 'exact');
    expect(r).toHaveLength(1);
    expect(r[0].product_id).toBe('a');
  });

  it('skips items missing match_score', () => {
    const items: SearchProductItem[] = [
      { product_id: 'a' }, // no match_score
      { product_id: 'b', match_score: 0.95 },
    ];
    expect(filterProductsByTier(items, 'exact')).toHaveLength(1);
    expect(filterProductsByTier(items, 'similar')).toHaveLength(0);
  });
});
