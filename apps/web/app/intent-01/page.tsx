'use client';

/**
 * apps/web/app/intent-01/page.tsx — Intent 01 (Image AI Import) V-SLICE page wire.
 *
 * Slice:    S-07 First Image AI Import
 * Task:     T02.C FE Page Wire (Phiên Sx07-F)
 *
 * **REPLACES** S-03 T03b placeholder (41 LOC stub) shipped Phiên 36 Batch 5.
 *
 * Source:   10 mockup states `docs/mockups/intent-01/intent-01-state-*.html`
 *           (per D-29 LAW Mockup filename is LAW).
 *
 * State machine: 11 states wired via `useImportFlow` hook
 *   (`state-0/A/B/C-rising/C-falling/D/E/F/G/H + cancelled`).
 *
 * **Architectural decisions applied (12 D-* + 4 C-S07-*):**
 * - **D-S04-01 LAW**: Back btn → `router.push('/home')` per S-03 D-28 precedent
 * - **D-S04-04 LAW**: Avatar dynamic initials from `useMe()` → /me route
 * - **D-S04-13 LAW**: Pattern A LangGraph + Option Z Redis pub/sub — EventSource
 *   stays open through interrupt+resume cycles via `useImportFlow`
 * - **D-S04-14 LAW**: Adaptive Progressive Streaming — phases render sequentially
 *   even though BE asyncio.gather parallelizes enrichment
 * - **D-S04-11 LAW**: `brand` lifted to top-level in submit_draft `value` payload
 *   (NOT nested in `attributes`) — PrefillForm handles remap internally;
 *   page just forwards validated ProductDraft from form callback
 * - **D-25 LAW** (S-03): SuccessTransition uses setTimeout cleanup pattern with
 *   `cancelled` flag adaptation for 3-button programmatic cancel (Q2 HYBRID)
 * - **D-29 LAW**: JSDoc cites mockup filenames verbatim
 * - **C-S07-D**: 3 NEW SSE events form_prefill / market_trend / shopee_compare
 *   consumed via use-import-flow buildHandlers
 * - **C-S07-F** option ⓐ: `E_VISION_BLUR` surfaces via SSE error event with code
 *   → state-E (BlurErrorCard render with retake + manual-entry CTAs)
 * - **C-S07-L** LOCK: `confidence_per_field` 4 keys ONLY (title/brand/category/size);
 *   state-F overlay rendered when ANY field < 0.7 threshold
 * - **C-S07-O** option iii-a (Sx07-G hotfix): on-demand AI chip suggestions via
 *   `useAIAttributeSuggest` mutation — PrefillForm "Thêm" button callback
 * - **C-15** 'use client': composes useState + useEffect + event handlers
 *
 * **Behavior events (6 wired)** per `07_BEHAVIOR_LOGS.md §3.5`:
 * - `product.import_started` — on page mount (useEffect first render guard)
 * - `product.import_completed` — on SSE final → state-G transition
 * - `product.import_abandoned` — beforeunload + route change cleanup
 * - `card.shown` — per ActionCard mount in state-C (useRef de-dup)
 * - `card.accepted` — onClick Apply CTA inside ActionCard
 * - `card.rejected` — onClick Dismiss CTA inside ActionCard
 *
 * **Per A9 LAW**: Intent 01 has BottomBar (HomeBottomNav) → MUST use
 * `mode="chat"` + internal scroll. Page reuses `home.module.css` scoped
 * `pageWrap` + `phoneFrame` classes (verified Phiên Sx04-10 intent-03
 * precedent — same CSS module powers all chat-mode V-SLICE pages).
 *
 * @see apps/web/src/features/import/use-import-flow.ts (SSE consumer hook)
 * @see apps/web/src/features/import/import-state-machine.ts (11-state reducer)
 * @see apps/web/src/features/import/action-poster.ts (submit_draft + commit)
 * @see apps/web/src/features/import/tracking-hooks.ts (6 behavior wrappers)
 * @see apps/web/src/features/import/use-ai-attribute-suggest.ts (Sx07-G hotfix)
 */

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMe } from '@/lib/dashboard/use-me';
import { SearchHeader } from '@/components/icp/organisms';
import {
  ConversationBubble,
  ImageDropZone,
  AnalyzingPhasesCard,
  PrefillForm,
  LowConfidenceWarningBanner,
  BlurErrorCard,
  SuccessTransition,
  ShopeeCompareCard,
  ShopeeCompareCardExpanded,
  TrendCard,
  TrendCardExpanded,
  type AnalyzingPhaseSlot,
  type SuggestedAttributeChip,
} from '@/components/icp/molecules';
import { Icon } from '@/components/icp/atoms';
import { useImportFlow } from '@/src/features/import/use-import-flow';
import { getLowConfidenceFields } from '@/src/features/import/import-state-machine';
import { postImportAction } from '@/src/features/import/action-poster';
import {
  useAIAttributeSuggest,
  extractSuggestedAttrs,
} from '@/src/features/import/use-ai-attribute-suggest';
import {
  trackProductImportStarted,
  trackProductImportCompleted,
  trackProductImportAbandoned,
  trackCardShown,
  trackCardAccepted,
  trackCardRejected,
} from '@/src/features/import/tracking-hooks';
import type { ProductDraft } from '@icp/shared-types';
import { cn } from '@/lib/utils';
import styles from '../home/home.module.css';

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * Default phase labels per `02_INTENT_SPECS.md` Intent 01 + state-A mockup
 * amended Phiên Sx07-E (D-S04-10 LAW 512 chiều). Fallback used when BE
 * does NOT emit a `label` field on phase_progress events.
 */
const PHASE_LABEL_FALLBACK: Record<0 | 1 | 2 | 3, string> = {
  0: 'Tải ảnh',
  1: 'Đọc nhãn sản phẩm',
  2: 'Sinh dấu vân tay 512 chiều',
  3: 'Phân tích thị trường',
};

export default function Intent01Page() {
  const router = useRouter();
  const meQuery = useMe();
  const flow = useImportFlow();
  const { state } = flow;

  // ─── External loading state for PrefillForm submit ────────────────────
  const [submitLoading, setSubmitLoading] = useState(false);

  // ─── AI suggest-attrs mutation (Sx07-G hotfix per C-S07-O) ────────────
  const aiSuggest = useAIAttributeSuggest(state.requestId);

  // ─── Telemetry idempotency refs (avoid double-fire on re-render) ──────
  const importStartedRef = useRef(false);
  const importCompletedRef = useRef(false);
  const importAbandonedRef = useRef(false);
  const cardShownIdsRef = useRef<Set<string>>(new Set());

  // ─── Lifecycle: emit `product.import_started` once per mount ──────────
  useEffect(() => {
    if (importStartedRef.current) return;
    importStartedRef.current = true;
    trackProductImportStarted({
      source: 'direct_url',
      referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
    });
  }, []);

  // ─── Lifecycle: emit `product.import_completed` on state-G transition ─
  useEffect(() => {
    if (state.kind !== 'state-G') return;
    if (importCompletedRef.current) return;
    if (!state.finalProduct || !state.startedAt) return;
    importCompletedRef.current = true;
    const elapsed = Math.round(performance.now() - state.startedAt);
    trackProductImportCompleted({
      request_id: state.requestId,
      product_id: state.finalProduct.product_id,
      category: state.formPrefill?.category ?? 'unknown',
      // suggested_price from form_prefill is closest analog at completion time
      // (post-merchant edit price is not retained in state.formPrefill;
      // future T03 hardening may surface via SSE final.committed_price).
      final_price: state.formPrefill?.suggested_price ?? 0,
      elapsed_ms: elapsed,
      cards_shown_count: cardShownIdsRef.current.size,
      cards_accepted_count: 0, // T02 hackathon: cards UI minimal; bump in real ActionCard wire
    });
  }, [state.kind, state.finalProduct, state.startedAt, state.requestId, state.formPrefill]);

  // ─── Lifecycle: emit `product.import_abandoned` on beforeunload + unmount ─
  useEffect(() => {
    const fireAbandon = (reason: 'browser_close' | 'in_app_navigation') => {
      if (importAbandonedRef.current) return;
      // Only fire if user has started a flow (state.requestId set) AND not completed
      if (!state.requestId) return;
      if (importCompletedRef.current) return;
      if (state.kind === 'state-G' || state.kind === 'cancelled') return;
      importAbandonedRef.current = true;
      const elapsed = state.startedAt ? Math.round(performance.now() - state.startedAt) : 0;
      // Map state.kind → behavior schema's `abandoned_at_state` enum.
      // import-state-machine.ts kind enum already matches the Zod schema.
      trackProductImportAbandoned({
        request_id: state.requestId || undefined,
        abandoned_at_state: state.kind,
        elapsed_ms: elapsed,
        reason,
      });
    };

    const handleBeforeUnload = () => fireAbandon('browser_close');
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      fireAbandon('in_app_navigation');
    };
  }, [state.requestId, state.kind, state.startedAt]);

  // ─── Lifecycle: emit `card.shown` per new card mount ──────────────────
  useEffect(() => {
    state.cards.forEach((card, idx) => {
      if (cardShownIdsRef.current.has(card.card_id)) return;
      cardShownIdsRef.current.add(card.card_id);
      // C-S07-L card variant — defensive default if BE returns unknown enum
      const variant = (card.variant as
        | 'SUGGEST_PRICE'
        | 'SUGGEST_ATTRS'
        | 'SUGGEST_ALTERNATIVES'
        | 'SUGGEST_CREDIT_LOAN'
        | 'SUGGEST_PROMOTION') ?? 'SUGGEST_PRICE';
      trackCardShown({
        request_id: state.requestId,
        card_id: card.card_id,
        policy_code: card.policy_code || 'UNKNOWN',
        variant,
        position: idx,
      });
    });
  }, [state.cards, state.requestId]);

  // ─── Handlers ─────────────────────────────────────────────────────────

  /** Image upload from ImageDropZone state-0 → start the flow. */
  const handleUpload = useCallback(
    async (base64: string, meta: { fileName: string; sizeBytes: number; mimeType: string }) => {
      await flow.uploadImage(base64, meta);
    },
    [flow],
  );

  /** Retake from BlurErrorCard state-E → reset entirely to state-0. */
  const handleRetake = useCallback(() => {
    flow.dispatch({ type: 'retake' });
    // Reset telemetry refs so the next flow fires `product.import_started` fresh.
    // Note: import_started already fired once on initial mount per ref guard;
    // re-fire NOT needed (S-07 BRIEF: one event per session entry).
    importCompletedRef.current = false;
    importAbandonedRef.current = false;
    cardShownIdsRef.current.clear();
  }, [flow]);

  /** State-E "Nhập tay" CTA — placeholder for future manual entry route. */
  const handleManualEntry = useCallback(() => {
    // T02 hackathon scope: NO manual entry page (post-MVP per S-07 BRIEF).
    // eslint-disable-next-line no-alert
    alert('Tính năng nhập tay đang được phát triển. Anh thử lại với ảnh rõ hơn nhé.');
  }, []);

  /** PrefillForm submit → POST /intent/:rid/action with choice='submit_draft'. */
  const handleSubmitDraft = useCallback(
    async (draft: ProductDraft) => {
      if (!state.requestId) return;
      setSubmitLoading(true);
      try {
        flow.dispatch({ type: 'submit_draft' });
        await postImportAction(state.requestId, {
          choice: 'submit_draft',
          value: { ...draft },
          _meta: { attempt_n: state.attemptN },
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('submit_draft failed:', err);
      } finally {
        setSubmitLoading(false);
      }
    },
    [state.requestId, state.attemptN, flow],
  );

  /** PrefillForm "Thêm" button → POST /intent/:rid/suggest-attrs. */
  const handleRequestSuggestAttrs = useCallback(
    async (category: string, existingAttrs: Record<string, string>): Promise<SuggestedAttributeChip[]> => {
      const result = await aiSuggest.mutateAsync({ category, existingAttrs });
      return extractSuggestedAttrs(result);
    },
    [aiSuggest],
  );

  /** Card accept handler (placeholder — T02 minimal ActionCard wire). */
  const handleCardAccept = useCallback(
    (cardId: string) => {
      const card = state.cards.find((c) => c.card_id === cardId);
      if (!card) return;
      const variant = (card.variant as
        | 'SUGGEST_PRICE'
        | 'SUGGEST_ATTRS'
        | 'SUGGEST_ALTERNATIVES'
        | 'SUGGEST_CREDIT_LOAN'
        | 'SUGGEST_PROMOTION') ?? 'SUGGEST_PRICE';
      trackCardAccepted({
        request_id: state.requestId,
        card_id: cardId,
        policy_code: card.policy_code || 'UNKNOWN',
        variant,
      });
      // T02: card UI minimal — skip server POST /cards/:id/accept (Phase 3+).
    },
    [state.cards, state.requestId],
  );

  const handleCardReject = useCallback(
    (cardId: string) => {
      const card = state.cards.find((c) => c.card_id === cardId);
      if (!card) return;
      const variant = (card.variant as
        | 'SUGGEST_PRICE'
        | 'SUGGEST_ATTRS'
        | 'SUGGEST_ALTERNATIVES'
        | 'SUGGEST_CREDIT_LOAN'
        | 'SUGGEST_PROMOTION') ?? 'SUGGEST_PRICE';
      trackCardRejected({
        request_id: state.requestId,
        card_id: cardId,
        policy_code: card.policy_code || 'UNKNOWN',
        variant,
      });
    },
    [state.cards, state.requestId],
  );

  /** Commit button (state-C after reviewing cards) → POST /intent/:rid/action commit. */
  const handleCommit = useCallback(async () => {
    if (!state.requestId) return;
    setSubmitLoading(true);
    try {
      flow.dispatch({ type: 'commit' });
      await postImportAction(state.requestId, {
        choice: 'commit',
        _meta: { attempt_n: state.attemptN },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('commit failed:', err);
    } finally {
      setSubmitLoading(false);
    }
  }, [state.requestId, state.attemptN, flow]);

  /** Expanded-panel toggles. */
  const handleOpenShopeeExpanded = useCallback(() => {
    flow.dispatch({ type: 'open_shopee_expanded' });
  }, [flow]);

  const handleOpenTrendExpanded = useCallback(() => {
    flow.dispatch({ type: 'open_trend_expanded' });
  }, [flow]);

  const handleCloseExpanded = useCallback(() => {
    flow.dispatch({ type: 'close_expanded' });
  }, [flow]);

  /** Success transition CTA handlers. */
  const handleSuccessClose = useCallback(() => {
    flow.dispatch({ type: 'cancel_redirect' });
  }, [flow]);

  const handleImportNext = useCallback(() => {
    flow.dispatch({ type: 'reset' });
    // Reset telemetry refs for the next session.
    importCompletedRef.current = false;
    importAbandonedRef.current = false;
    cardShownIdsRef.current.clear();
  }, [flow]);

  // ─── Derived data ─────────────────────────────────────────────────────

  const initials = meQuery.data?.avatar_initials ?? '?';

  /** AnalyzingPhasesCard phases map derived from state.phases (D-S04-14 LAW). */
  const analyzingPhases = useMemo<Partial<Record<0 | 1 | 2 | 3, AnalyzingPhaseSlot>>>(() => {
    const result: Partial<Record<0 | 1 | 2 | 3, AnalyzingPhaseSlot>> = {};
    ([0, 1, 2, 3] as const).forEach((id) => {
      const slot = state.phases[id];
      if (!slot) return;
      result[id] = {
        phase_id: id,
        label: slot.label ?? PHASE_LABEL_FALLBACK[id],
        status: slot.status,
        ms: slot.ms,
        meta: slot.meta,
      };
    });
    return result;
  }, [state.phases]);

  /** Low-confidence field list (drives state-F warning banner). */
  const lowConfFields = useMemo(
    () => getLowConfidenceFields(state.formPrefill),
    [state.formPrefill],
  );

  // ─── Render ───────────────────────────────────────────────────────────

  // State-D / state-H expanded panels render as FULL-PAGE replacements
  // (mockup intent-01-state-D/H-expanded.html design — no chat scroll behind).
  if (state.kind === 'state-D' && state.shopeeCompare) {
    return (
      <div className={styles.pageWrap}>
        <div className={cn(styles.phoneFrame, 'flex flex-col min-h-[600px] overflow-y-auto')}>
          <ShopeeCompareCardExpanded
            userPrice={state.formPrefill?.suggested_price ?? 0}
            aggregates={state.shopeeCompare.aggregates}
            samples={state.shopeeCompare.samples}
            subtitle={state.formPrefill?.title}
            onBack={handleCloseExpanded}
          />
        </div>
      </div>
    );
  }

  if (state.kind === 'state-H' && state.marketTrend) {
    return (
      <div className={styles.pageWrap}>
        <div className={cn(styles.phoneFrame, 'flex flex-col min-h-[600px] overflow-y-auto')}>
          <TrendCardExpanded
            trend={state.marketTrend}
            productContext={state.formPrefill?.title}
            onBack={handleCloseExpanded}
          />
        </div>
      </div>
    );
  }

  // Main chat-mode render — state-0/A/B/C-rising/C-falling/E/F/G/cancelled
  return (
    <div className={styles.pageWrap}>
      <div className={cn(styles.phoneFrame, 'flex flex-col min-h-[600px]')}>
        <SearchHeader
          initials={initials}
          onBack={() => router.push('/home')}
          onProfileClick={() => router.push('/me')}
        />

        {/* ─── CHAT AREA ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-3.5 pt-4 pb-2 flex flex-col gap-3.5 relative">
          {/* ═══ State-0: entry — ImageDropZone ═════════════════════════ */}
          {state.kind === 'state-0' && (
            <>
              <ConversationBubble
                role="ai"
                variant="greet"
                text="Em chụp ảnh sản phẩm, em sẽ giúp anh nhập hàng nhé."
              />
              <ImageDropZone onUpload={handleUpload} />
            </>
          )}

          {/* ═══ State-A: AnalyzingPhasesCard (4 phases) ════════════════ */}
          {state.kind === 'state-A' && (
            <>
              <ConversationBubble role="user" text="Đã chụp ảnh — em phân tích nhé." />
              <ConversationBubble role="ai" text="Em đang phân tích..." />
              <div className="ml-9">
                <AnalyzingPhasesCard phases={analyzingPhases} />
              </div>
            </>
          )}

          {/* ═══ State-B / State-F: prefilled form (+ low-confidence overlay) ═══ */}
          {(state.kind === 'state-B' || state.kind === 'state-F') && state.formPrefill && (
            <>
              <ConversationBubble role="user" text="Đã chụp ảnh — em phân tích nhé." />
              <ConversationBubble
                role="ai"
                text={`Aida nhận diện ${state.formPrefill.title ?? 'sản phẩm'} · độ tin cậy ${
                  state.formPrefill.confidence
                    ? `${Math.round(state.formPrefill.confidence * 100)}%`
                    : 'cao'
                }`}
              />
              {/* State-F warning banner (only when low-confidence fields exist) */}
              {state.kind === 'state-F' && lowConfFields.length > 0 && (
                <LowConfidenceWarningBanner lowConfidenceFields={lowConfFields} />
              )}
              {/* Prefill form (consumes form_prefill + handles brand top-level remap) */}
              <PrefillForm
                requestId={state.requestId}
                formPrefill={{
                  category: state.formPrefill.category,
                  attributes: state.formPrefill.attributes,
                  confidence_per_field: state.formPrefill.confidence_per_field,
                  alternatives: state.formPrefill.alternatives,
                  suggested_price: state.formPrefill.suggested_price,
                  title: state.formPrefill.title,
                  description: state.formPrefill.description,
                }}
                onSubmit={handleSubmitDraft}
                onRequestSuggestAttrs={handleRequestSuggestAttrs}
                loading={submitLoading}
              />
              {/* Compact TrendCard + ShopeeCompareCard if data available */}
              {state.marketTrend && (
                <TrendCard
                  delta={Math.round(state.marketTrend.delta_pct)}
                  sparklineData={state.marketTrend.series}
                  label="GOOGLE TRENDS"
                  subtitle={`${state.marketTrend.trajectory} · 90 ngày`}
                  chips={state.marketTrend.related_rising.slice(0, 4).map((label) => ({ label }))}
                  onExpand={handleOpenTrendExpanded}
                />
              )}
              {state.shopeeCompare && state.formPrefill.suggested_price !== undefined && (
                <ShopeeCompareCard
                  userPrice={state.formPrefill.suggested_price ?? 0}
                  priceMin={state.shopeeCompare.aggregates.min_price}
                  priceMax={state.shopeeCompare.aggregates.max_price}
                  priceMedian={state.shopeeCompare.aggregates.avg_price}
                  subtitle={`Trung vị ${state.shopeeCompare.aggregates.sample_count} cửa hàng`}
                  onExpand={handleOpenShopeeExpanded}
                />
              )}
            </>
          )}

          {/* ═══ State-C-rising / State-C-falling: cards review ═════════ */}
          {(state.kind === 'state-C-rising' || state.kind === 'state-C-falling') && (
            <>
              <ConversationBubble
                role="ai"
                text={`Em có ${state.cards.length} gợi ý để anh xem qua trước khi nhập hàng.`}
              />
              <div className="ml-9 flex flex-col gap-3">
                {state.cards.map((card) => (
                  <div
                    key={card.card_id}
                    className={cn(
                      'rounded-2xl border-[0.5px] p-3.5',
                      state.kind === 'state-C-rising'
                        ? 'bg-gradient-to-br from-white to-emerald-50 border-emerald-200'
                        : 'bg-gradient-to-br from-white to-amber-50 border-amber-200',
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon name="sparkles" size={14} className="text-icp-pink-700" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-icp-pink-900">
                        {card.variant}
                      </span>
                    </div>
                    {card.rationale && (
                      <p className="text-[13px] text-icp-pink-900 leading-snug mb-3">{card.rationale}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleCardAccept(card.card_id)}
                        className="flex-1 h-9 rounded-full bg-gradient-to-r from-icp-pink-600 to-orange-400 text-white text-[12px] font-semibold shadow-[0_4px_10px_rgba(233,30,99,0.25)]"
                      >
                        Áp dụng
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCardReject(card.card_id)}
                        className="flex-1 h-9 rounded-full bg-white border-[0.5px] border-icp-pink-200 text-icp-pink-700 text-[12px] font-semibold"
                      >
                        Bỏ qua
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Commit button — bottom of cards review */}
              <div className="ml-9 mt-2">
                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={submitLoading}
                  className="w-full h-11 rounded-full bg-gradient-to-r from-icp-pink-600 to-orange-400 text-white text-[14px] font-bold shadow-[0_6px_16px_rgba(233,30,99,0.3)] disabled:opacity-60"
                >
                  {submitLoading ? 'Đang nhập hàng...' : 'Nhập hàng vào kho'}
                </button>
              </div>
            </>
          )}

          {/* ═══ State-E: BlurErrorCard ═════════════════════════════════ */}
          {state.kind === 'state-E' && (
            <>
              <ConversationBubble role="user" text="Đã chụp ảnh." />
              <ConversationBubble
                role="ai"
                text={state.error?.code === 'E_VISION_BLUR' ? 'Em chưa đọc rõ nhãn — anh thử chụp lại với ánh sáng tốt hơn nhé.' : `Em gặp lỗi khi phân tích ảnh (${state.error?.code ?? 'UNKNOWN'}). Anh thử chụp lại nhé.`}
              />
              <BlurErrorCard
                imageDataUrl={state.imageDataUrl ?? undefined}
                traceId={state.error?.trace_id}
                errorCode={state.error?.code ?? 'E_VISION_BLUR'}
                onRetake={handleRetake}
                onManualEntry={handleManualEntry}
              />
            </>
          )}

          {/* ═══ State-G: SuccessTransition (HYBRID auto-redirect 2s) ═══ */}
          {state.kind === 'state-G' && state.finalProduct && (
            <SuccessTransition
              productId={state.finalProduct.product_id}
              productTitle={state.finalProduct.product_title}
              fieldsCount={Object.keys(state.formPrefill?.attributes ?? {}).length + 6}
              elapsedSec={
                state.startedAt ? Math.round((performance.now() - state.startedAt) / 100) / 10 : 3.2
              }
              confidencePct={
                state.formPrefill?.confidence
                  ? Math.round(state.formPrefill.confidence * 100)
                  : 95
              }
              onClose={handleSuccessClose}
              onImportNext={handleImportNext}
            />
          )}

          {/* ═══ State-cancelled: user cancelled state-G auto-redirect ══ */}
          {state.kind === 'cancelled' && (
            <ConversationBubble
              role="ai"
              variant="greet"
              text="Anh muốn làm gì tiếp theo? Tap nút phía trên hoặc về trang chính."
            />
          )}
        </div>
      </div>
    </div>
  );
}
