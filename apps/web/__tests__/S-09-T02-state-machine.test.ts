/**
 * apps/web/__tests__/S-09-T02-state-machine.test.ts
 *
 * Vitest smoke test for recommend state machine reducer + composeBySignal selector
 * + image-uploader utility + APPEND_NEW_TURN per Phiên Sx09-F T02.
 *
 * Slice:    S-09 First Image-Based Product Recommendation (Intent 04)
 * Task:     T02 FE + wire (Phiên Sx09-F)
 *
 * Coverage (≥25 tests AC26):
 * - reduceState (10 actions): submit_image, status, phase_progress, understanding,
 *                              product_ready, products, final, empty_state, error,
 *                              set_signal_filter, set_cart_confirm, dismiss_*,
 *                              append_new_turn, reset
 * - composeBySignal: 3 SIGNAL_WEIGHTS configs (visual/collab/trending) re-rank ordering
 * - APPEND_NEW_TURN: collapses currentTurn → previousTurns with frozen state
 * - image-uploader: <8MB OK, >8MB throws ImageUploadError, base64 strip prefix
 *
 * Pattern: Pure function tests — no React, no DOM, no async, no mocks
 * (except FileReader in image-uploader tests via vi.stubGlobal).
 *
 * Run: `pnpm --filter @icp/web test -- S-09-T02-state-machine`
 */

import { describe, it, expect } from 'vitest';
import {
  initialState,
  reduceState,
  composeBySignal,
  SIGNAL_WEIGHTS,
  type RecommendState,
  type RecommendedProduct,
} from '@/src/features/recommend/recommend-state-machine';
import {
  readImageAsBase64,
  stripDataUrlPrefix,
  ImageUploadError,
  MAX_IMAGE_BYTES,
} from '@/src/features/recommend/image-uploader';

// ─── Fixture builder ─────────────────────────────────────────────────────────

function makeProduct(
  id: string,
  match_type: 'visual' | 'collab' | 'trending',
  sub_scores: { visual_sim: number; collab_count: number; trending_score: number },
  overrides: Partial<RecommendedProduct> = {},
): RecommendedProduct {
  return {
    id,
    title: `Product ${id}`,
    category: 'mi_an_lien',
    price: 25000,
    match_score: sub_scores.visual_sim, // placeholder
    reason: `Reason ${id}`,
    match_type,
    sub_scores,
    ...overrides,
  };
}

// ─── reduceState — submit_image + lifecycle ──────────────────────────────────

describe('reduceState — submit_image + lifecycle', () => {
  it('submit_image: idle → streaming, creates currentTurn, preserves previousTurns', () => {
    const s1 = reduceState(initialState, {
      type: 'submit_image',
      imageB64: 'aGVsbG8=',
      requestId: 'rid_abc',
      turnId: 'turn_1',
    });
    expect(s1.kind).toBe('streaming');
    expect(s1.requestId).toBe('rid_abc');
    expect(s1.currentTurn).not.toBeNull();
    expect(s1.currentTurn?.turnId).toBe('turn_1');
    expect(s1.currentTurn?.imageB64).toBe('aGVsbG8=');
    expect(s1.previousTurns).toEqual([]);
    expect(s1.products).toEqual([]);
    expect(s1.activeSignalFilter).toBe('visual');
  });

  it('submit_image: with existing previousTurns preserves them', () => {
    const prevState: RecommendState = {
      ...initialState,
      previousTurns: [
        {
          turnId: 'turn_0',
          requestId: 'rid_old',
          imageB64: 'old',
          detected: null,
          products: [],
          coPurchaseHint: null,
          startedAtMs: Date.now() - 60000,
        },
      ],
    };
    const s1 = reduceState(prevState, {
      type: 'submit_image',
      imageB64: 'new',
      requestId: 'rid_new',
      turnId: 'turn_1',
    });
    expect(s1.previousTurns).toHaveLength(1);
    expect(s1.previousTurns[0].turnId).toBe('turn_0');
  });

  it('status: idle + non-done phase → flips to streaming', () => {
    const s1 = reduceState(initialState, { type: 'status', phase: 'analyzing' });
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
          label: 'Đọc nội dung sản phẩm',
          status: 'done',
          ms: 412,
        },
      },
    );
    expect(s1.phases[1]).toMatchObject({
      phase_id: 1,
      label: 'Đọc nội dung sản phẩm',
      status: 'done',
      ms: 412,
    });
    expect(s1.phases[0]).toBeUndefined();
  });

  it('phase_progress: fallback label when server omits (per mockup state-A labels)', () => {
    const s1 = reduceState(initialState, {
      type: 'phase_progress',
      payload: { phase_id: 2, status: 'active' },
    });
    expect(s1.phases[2]?.label).toBe('Tìm sản phẩm tương tự');
  });

  it('phase_progress: meta passes through (dynamic corpus count per C-S09-O/P/Q)', () => {
    const s1 = reduceState(initialState, {
      type: 'phase_progress',
      payload: {
        phase_id: 2,
        status: 'active',
        label: 'Tìm sản phẩm tương tự',
        meta: 'Đang so khớp với 55 sản phẩm shop...',
      },
    });
    expect(s1.phases[2]?.meta).toBe('Đang so khớp với 55 sản phẩm shop...');
  });

  it('understanding: stores BE detected payload shape', () => {
    const s1 = reduceState(initialState, {
      type: 'understanding',
      payload: { detected: { category: 'mì ăn liền', attributes: { spicy: true } } },
    });
    expect(s1.understanding?.detected).toEqual({
      category: 'mì ăn liền',
      attributes: { spicy: true },
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
        item: makeProduct('p1', 'visual', { visual_sim: 0.95, collab_count: 3, trending_score: 0.4 }),
        index: 0,
        total: 8,
      },
    );
    expect(s1.totalExpected).toBe(8);
    expect(s1.products).toHaveLength(8);
    expect(s1.products[0]?.id).toBe('p1');
    expect(s1.products[7]).toBeUndefined();
  });

  it('product_ready: out-of-order arrival writes correct slot', () => {
    let s: RecommendState = { ...initialState, kind: 'streaming' };
    s = reduceState(s, {
      type: 'product_ready',
      item: makeProduct('p_idx2', 'visual', { visual_sim: 0.8, collab_count: 1, trending_score: 0.1 }),
      index: 2,
      total: 4,
    });
    s = reduceState(s, {
      type: 'product_ready',
      item: makeProduct('p_idx0', 'visual', { visual_sim: 0.9, collab_count: 5, trending_score: 0.3 }),
      index: 0,
      total: 4,
    });
    expect(s.products[0]?.id).toBe('p_idx0');
    expect(s.products[2]?.id).toBe('p_idx2');
    expect(s.products[1]).toBeUndefined();
    expect(s.products[3]).toBeUndefined();
  });

  it('products canonical event: overwrites array + flips kind to result + resets filter to visual', () => {
    const s1 = reduceState(
      {
        ...initialState,
        kind: 'streaming',
        activeSignalFilter: 'collab', // pre-set; should reset on fresh products
      },
      {
        type: 'products',
        items: [
          makeProduct('p1', 'visual', { visual_sim: 0.95, collab_count: 3, trending_score: 0.4 }),
          makeProduct('p2', 'collab', { visual_sim: 0.5, collab_count: 10, trending_score: 0.6 }),
        ],
      },
    );
    expect(s1.kind).toBe('result');
    expect(s1.products).toHaveLength(2);
    expect(s1.activeSignalFilter).toBe('visual');
  });
});

// ─── reduceState — final, empty_state, error ─────────────────────────────────

describe('reduceState — terminal events', () => {
  it('final: writes detected + coPurchaseHint + flips to result if streaming', () => {
    const s0: RecommendState = {
      ...initialState,
      kind: 'streaming',
      currentTurn: {
        turnId: 't1',
        requestId: 'rid',
        imageB64: 'b64',
        detected: null,
        products: [],
        coPurchaseHint: null,
        startedAtMs: Date.now(),
      },
    };
    const products = [
      makeProduct('p1', 'visual', { visual_sim: 0.9, collab_count: 2, trending_score: 0.3 }),
    ];
    const s1 = reduceState(s0, {
      type: 'final',
      payload: {
        detected: {
          category: 'mì ăn liền',
          attributes: { spicy: 'yes' },
        },
        products,
        co_purchase_hint: {
          source_category: 'mì ăn liền',
          target_categories: ['nước ngọt', 'trứng gà'],
          confidence: 0.85,
        },
      },
    });
    expect(s1.kind).toBe('result');
    expect(s1.detected?.category).toBe('mì ăn liền');
    expect(s1.coPurchaseHint?.target_categories).toEqual(['nước ngọt', 'trứng gà']);
    expect(s1.currentTurn?.detected?.category).toBe('mì ăn liền');
  });

  it('final: with null co_purchase_hint persists null', () => {
    const s0: RecommendState = {
      ...initialState,
      kind: 'streaming',
      currentTurn: {
        turnId: 't1',
        requestId: 'rid',
        imageB64: 'b64',
        detected: null,
        products: [],
        coPurchaseHint: null,
        startedAtMs: Date.now(),
      },
    };
    const s1 = reduceState(s0, {
      type: 'final',
      payload: {
        detected: { category: 'unknown', attributes: {} },
        products: [],
        co_purchase_hint: null,
      },
    });
    expect(s1.coPurchaseHint).toBeNull();
  });

  it('empty_state: kind → empty + clears products + stores reason', () => {
    const s1 = reduceState(
      { ...initialState, kind: 'streaming', products: [] },
      {
        type: 'empty_state',
        payload: {
          reason: 'category_not_in_inventory',
          message: 'Em chưa có sản phẩm trong danh mục này',
          fallback_actions: [
            { type: 'capture_image', label: 'Chụp ảnh khác' },
            { type: 'create_product', label: 'Nhập hàng mới' },
          ],
        },
      },
    );
    expect(s1.kind).toBe('empty');
    expect(s1.emptyState?.reason).toBe('category_not_in_inventory');
    expect(s1.emptyState?.fallback_actions).toHaveLength(2);
  });

  it('error: kind → error + stores code + message + traceId', () => {
    const s1 = reduceState(initialState, {
      type: 'error',
      code: 'E_VISION_TIMEOUT',
      message: 'Phân tích ảnh thất bại',
      traceId: 'abc123',
    });
    expect(s1.kind).toBe('error');
    expect(s1.error?.code).toBe('E_VISION_TIMEOUT');
    expect(s1.error?.message).toBe('Phân tích ảnh thất bại');
    expect(s1.error?.traceId).toBe('abc123');
  });
});

// ─── reduceState — set_signal_filter (D-S09-NN-A LAW) ───────────────────────

describe('reduceState — set_signal_filter (D-S09-NN-A LAW)', () => {
  it('default activeSignalFilter is visual', () => {
    expect(initialState.activeSignalFilter).toBe('visual');
  });

  it('set_signal_filter: visual → collab', () => {
    const s1 = reduceState(initialState, { type: 'set_signal_filter', signal: 'collab' });
    expect(s1.activeSignalFilter).toBe('collab');
  });

  it('set_signal_filter: visual → trending', () => {
    const s1 = reduceState(initialState, { type: 'set_signal_filter', signal: 'trending' });
    expect(s1.activeSignalFilter).toBe('trending');
  });
});

// ─── reduceState — append_new_turn (D-S09-NN-B LAW) ─────────────────────────

describe('reduceState — append_new_turn (D-S09-NN-B LAW)', () => {
  it('append_new_turn: collapses currentTurn → previousTurns with frozen state', () => {
    const s0: RecommendState = {
      ...initialState,
      kind: 'result',
      activeSignalFilter: 'collab',
      detected: { category: 'mì cay', attributes: {} },
      products: [
        makeProduct('p1', 'visual', { visual_sim: 0.9, collab_count: 5, trending_score: 0.3 }),
      ],
      coPurchaseHint: {
        source_category: 'mì cay',
        target_categories: ['nước ngọt'],
        confidence: 0.7,
      },
      currentTurn: {
        turnId: 'turn_1',
        requestId: 'rid_1',
        imageB64: 'old_b64',
        detected: null,
        products: [],
        coPurchaseHint: null,
        startedAtMs: 1000,
      },
      previousTurns: [],
    };
    const s1 = reduceState(s0, {
      type: 'append_new_turn',
      imageB64: 'new_b64',
      requestId: 'rid_2',
      turnId: 'turn_2',
    });
    expect(s1.previousTurns).toHaveLength(1);
    expect(s1.previousTurns[0].turnId).toBe('turn_1');
    expect(s1.previousTurns[0].detected?.category).toBe('mì cay'); // frozen detected
    expect(s1.previousTurns[0].products).toHaveLength(1);            // frozen products
    expect(s1.previousTurns[0].coPurchaseHint?.target_categories).toEqual(['nước ngọt']);
    expect(s1.currentTurn?.turnId).toBe('turn_2');
    expect(s1.currentTurn?.imageB64).toBe('new_b64');
    expect(s1.kind).toBe('streaming');
    expect(s1.activeSignalFilter).toBe('visual'); // reset to default per initialState
  });

  it('append_new_turn from null currentTurn: previousTurns unchanged (defensive)', () => {
    const s1 = reduceState(initialState, {
      type: 'append_new_turn',
      imageB64: 'b64',
      requestId: 'rid',
      turnId: 't',
    });
    expect(s1.previousTurns).toEqual([]);
    expect(s1.currentTurn?.turnId).toBe('t');
  });

  it('append_new_turn: cumulative — multiple turns stack', () => {
    let s: RecommendState = initialState;
    s = reduceState(s, { type: 'submit_image', imageB64: 'b1', requestId: 'r1', turnId: 't1' });
    s = reduceState(s, {
      type: 'append_new_turn',
      imageB64: 'b2',
      requestId: 'r2',
      turnId: 't2',
    });
    s = reduceState(s, {
      type: 'append_new_turn',
      imageB64: 'b3',
      requestId: 'r3',
      turnId: 't3',
    });
    expect(s.previousTurns).toHaveLength(2);
    expect(s.previousTurns[0].turnId).toBe('t1');
    expect(s.previousTurns[1].turnId).toBe('t2');
    expect(s.currentTurn?.turnId).toBe('t3');
  });
});

// ─── reduceState — cart confirm + dismiss helpers + reset ───────────────────

describe('reduceState — cart confirm + dismiss + reset', () => {
  it('set_cart_confirm: stores summary; dismiss_cart_confirm: clears', () => {
    const s1 = reduceState(initialState, {
      type: 'set_cart_confirm',
      item: { title: 'Mì Samyang', price: 35000 },
    });
    expect(s1.addToCartConfirm).toEqual({ title: 'Mì Samyang', price: 35000 });
    const s2 = reduceState(s1, { type: 'dismiss_cart_confirm' });
    expect(s2.addToCartConfirm).toBeNull();
  });

  it('dismiss_co_purchase_hint: clears coPurchaseHint', () => {
    const s0: RecommendState = {
      ...initialState,
      coPurchaseHint: {
        source_category: 'mì',
        target_categories: ['nước ngọt'],
        confidence: 0.7,
      },
    };
    const s1 = reduceState(s0, { type: 'dismiss_co_purchase_hint' });
    expect(s1.coPurchaseHint).toBeNull();
  });

  it('reset: returns to initialState', () => {
    const s0: RecommendState = {
      ...initialState,
      kind: 'result',
      activeSignalFilter: 'trending',
    };
    const s1 = reduceState(s0, { type: 'reset' });
    expect(s1).toEqual(initialState);
  });
});

// ─── composeBySignal — D-S09-NN-A LAW selector (imported from shared-types) ──

describe('composeBySignal — D-S09-NN-A LAW client-side re-rank', () => {
  // Test fixture per Warning 1: composeBySignal is RE-EXPORTED via state-machine
  // module from `@icp/shared-types/recommendations` — NOT locally re-implemented.

  it('exports SIGNAL_WEIGHTS const with 3 keys', () => {
    expect(SIGNAL_WEIGHTS.visual).toEqual({ v: 0.5, c: 0.3, t: 0.2 });
    expect(SIGNAL_WEIGHTS.collab).toEqual({ v: 0.2, c: 0.7, t: 0.1 });
    expect(SIGNAL_WEIGHTS.trending).toEqual({ v: 0.2, c: 0.1, t: 0.7 });
  });

  it('visual signal: orders by visual_sim dominance', () => {
    const items = [
      makeProduct('A', 'visual', { visual_sim: 0.9, collab_count: 1, trending_score: 0.1 }),
      makeProduct('B', 'collab', { visual_sim: 0.4, collab_count: 3, trending_score: 0.2 }),
      makeProduct('C', 'trending', { visual_sim: 0.5, collab_count: 2, trending_score: 0.3 }),
    ];
    const r = composeBySignal(items, 'visual');
    expect(r[0].id).toBe('A'); // highest visual_sim wins under visual weights
  });

  it('collab signal: orders by normalized collab_count dominance', () => {
    const items = [
      makeProduct('A', 'visual', { visual_sim: 0.9, collab_count: 1, trending_score: 0.1 }),
      makeProduct('B', 'collab', { visual_sim: 0.4, collab_count: 3, trending_score: 0.2 }),
      makeProduct('C', 'trending', { visual_sim: 0.5, collab_count: 2, trending_score: 0.3 }),
    ];
    const r = composeBySignal(items, 'collab');
    expect(r[0].id).toBe('B'); // highest collab_count, normalized 10/10=1, beats A and C
  });

  it('trending signal: orders by trending_score dominance', () => {
    const items = [
      makeProduct('A', 'visual', { visual_sim: 0.9, collab_count: 1, trending_score: 0.1 }),
      makeProduct('B', 'collab', { visual_sim: 0.4, collab_count: 3, trending_score: 0.2 }),
      makeProduct('C', 'trending', { visual_sim: 0.5, collab_count: 2, trending_score: 0.3 }),
    ];
    const r = composeBySignal(items, 'trending');
    expect(r[0].id).toBe('C'); // trending_score 0.8 dominates under trending weights
  });

  it('returns top 10 only (slice cap)', () => {
    const items = Array.from({ length: 15 }, (_, i) =>
      makeProduct(`p${i}`, 'visual', {
        visual_sim: 1 - i * 0.05,
        collab_count: 0,
        trending_score: 0,
      }),
    );
    const r = composeBySignal(items, 'visual');
    expect(r).toHaveLength(10);
  });

  it('does NOT mutate input array', () => {
    const items = [
      makeProduct('A', 'visual', { visual_sim: 0.9, collab_count: 1, trending_score: 0.1 }),
      makeProduct('B', 'collab', { visual_sim: 0.4, collab_count: 3, trending_score: 0.2 }),
    ];
    const beforeIds = items.map((x) => x.id);
    composeBySignal(items, 'collab');
    expect(items.map((x) => x.id)).toEqual(beforeIds);
  });
});

// ─── image-uploader.ts (AC29) ────────────────────────────────────────────────

describe('image-uploader: validation + base64 strip', () => {
  it('stripDataUrlPrefix: strips data:image/jpeg;base64, prefix', () => {
    expect(stripDataUrlPrefix('data:image/jpeg;base64,aGVsbG8=')).toBe('aGVsbG8=');
  });

  it('stripDataUrlPrefix: returns input unchanged if no comma', () => {
    expect(stripDataUrlPrefix('plain_b64_no_prefix')).toBe('plain_b64_no_prefix');
  });

  it('MAX_IMAGE_BYTES is exactly 8MB', () => {
    expect(MAX_IMAGE_BYTES).toBe(8 * 1024 * 1024);
  });

  it('readImageAsBase64: rejects non-image MIME type', async () => {
    const fakeFile = new File(['hello'], 'doc.txt', { type: 'text/plain' });
    await expect(readImageAsBase64(fakeFile)).rejects.toBeInstanceOf(ImageUploadError);
    try {
      await readImageAsBase64(fakeFile);
    } catch (err) {
      expect((err as ImageUploadError).kind).toBe('not_image');
    }
  });

  it('readImageAsBase64: rejects >8MB file', async () => {
    // Synthesize oversized File without allocating 8MB bytes — File API
    // size is metadata.
    const blob = new Blob([new Uint8Array(100)], { type: 'image/jpeg' });
    const file = new File([blob], 'big.jpg', { type: 'image/jpeg' });
    // Stub `.size` via Object.defineProperty since File is a getter
    Object.defineProperty(file, 'size', { value: MAX_IMAGE_BYTES + 1 });
    await expect(readImageAsBase64(file)).rejects.toBeInstanceOf(ImageUploadError);
    try {
      await readImageAsBase64(file);
    } catch (err) {
      expect((err as ImageUploadError).kind).toBe('too_large');
    }
  });

  it('readImageAsBase64: <8MB image OK — returns naked b64 + meta', async () => {
    // Build a tiny in-memory PNG-like blob — FileReader will produce a data URL
    // that we can verify stripDataUrlPrefix worked correctly.
    const tinyBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic header
    const blob = new Blob([tinyBytes], { type: 'image/png' });
    const file = new File([blob], 'tiny.png', { type: 'image/png' });
    // No stub needed — file.size ~4 bytes well under 8MB.
    const result = await readImageAsBase64(file);
    expect(result.fileName).toBe('tiny.png');
    expect(result.mimeType).toBe('image/png');
    expect(result.sizeBytes).toBe(4);
    // base64 of [0x89,0x50,0x4e,0x47] = "iVBORw==" (no data: prefix)
    expect(result.base64).not.toContain('data:');
    expect(result.base64).not.toContain(',');
    expect(result.base64.length).toBeGreaterThan(0);
  });
});
