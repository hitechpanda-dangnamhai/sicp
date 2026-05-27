'use client';

/**
 * apps/web/app/intent-04/page.tsx — Intent 04 (Image Recommendation) V-SLICE page wire.
 *
 * Slice:    S-09 First Image-Based Product Recommendation (Intent 04)
 * Task:     T02 FE + wire (Phiên Sx09-F) — REPLACE S-03 T03b placeholder (~30 LOC)
 *
 * Source:   9 mockup states (docs/mockups/intent-04/intent-04-state-*.html)
 *
 * Decisions applied:
 * - D-S09-NN-A LAW: client-side instant signal re-rank via composeBySignal
 *   from `@icp/shared-types/recommendations` (NOT local impl per Warning 1).
 * - D-S09-NN-B LAW: FE-only thread persistence — currentTurn + previousTurns[]
 *   state + APPEND_NEW_TURN reducer + PreviousTurnChip molecule.
 * - D-S04-13 LAW (cross-slice): Pattern A Adaptive Interrupt+Resume EventSource
 *   lifecycle reused via use-recommend-stream.ts.
 * - D-S04-14 LAW (cross-slice): per-index progressive ProductCard slot driven
 *   by product_ready SSE event; first-card telemetry paired via tracking-hooks.
 * - D-S04-16 LAW (cross-slice): SignalFilterChips INLINE page-level (NOT new
 *   molecule) — same precedent as S-04 Intent 03 MatchTier chips.
 * - **C-S09-AO NEW**: ProductCard extended 2 props — pass dynamic
 *   `SIGNAL_MATCH_ICON_MAP[item.match_type]` + `SIGNAL_REASON_ICON_MAP[activeSignalFilter]`.
 * - **C-S09-AP NEW**: Dynamic counter `N = state.previousTurns.length + 1` for
 *   UserImageBubble badge + header sub-text. Pure FE compute, zero schema.
 * - C-S07-G LAW (cross-slice): 8MB pre-validate via image-uploader.ts.
 * - C-S07-B LAW (cross-slice): inherits multipart base64 pattern from S-07.
 *
 * 7 states routing:
 * - 'idle' + previousTurns.length === 0  → state-PRE: welcome bubble + ImageDropZone
 * - 'streaming' + first turn              → state-A: 4-phase progress + UserImageBubble
 * - 'streaming' + N≥2                     → state-F: PreviousTurnChip + divider + state-A
 * - 'result'                              → state-0: detected bubble + chips + carousel + co-purchase
 * - 'result' + activeSignalFilter≠visual  → state-D: same as state-0 but chips active flipped
 * - 'result' + addToCartConfirm           → state-E: state-0 + AddToCartConfirmCard toast
 * - 'empty'                               → state-B: EmptyState organism
 * - 'error'                               → state-C: ErrorState organism (or BlurErrorCard for E_VISION_BLUR)
 */

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ProductCard,
  PhasesCard,
  ImageDropZone,
  BlurErrorCard,
  UserImageBubble,
  CoPurchaseCategoryHintCard,
  PreviousTurnChip,
  AddToCartConfirmCard,
  type PhaseItem,
} from '@/components/icp/molecules';
import { EmptyState, ErrorState } from '@/components/icp/organisms';
import { Icon } from '@/components/icp/atoms';
import { HomeBottomNav } from '@/components/icp/layout';
import type { IconName } from '@/lib/icon-map';
import { useRecommendStream } from '@/src/features/recommend/use-recommend-stream';
import {
  readImageAsBase64,
  ImageUploadError,
} from '@/src/features/recommend/image-uploader';
import {
  composeBySignal,
  type RecommendedProduct,
  type SignalKey,
} from '@/src/features/recommend/recommend-state-machine';
import {
  trackRecommendationShown,
  trackRecommendationClicked,
  trackRecommendationDismissed,
  trackFirstCardEmitted,
} from '@/src/features/recommend/tracking-hooks';
import { usePostCartItem } from '@/src/features/cart/use-cart-mutations';
import { cn } from '@/lib/utils';
import styles from '../home/home.module.css';

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * C-S09-AO NEW: dynamic match-badge icon swap per item.match_type.
 * Mockup state-0 line 286 (visual=eye), state-D line 231 (collab=users).
 * Trending state inferred via PHASE_05 §I telemetry pattern.
 */
const SIGNAL_MATCH_ICON_MAP: Record<'visual' | 'collab' | 'trending', IconName> = {
  visual: 'eye',
  collab: 'users',
  trending: 'trending-up',
};

/**
 * C-S09-AO NEW: dynamic reason-chip prefix icon swap per activeSignalFilter.
 * Mockup state-0 line 292 (visual default = sparkles), state-D line 239 (collab = users).
 */
const SIGNAL_REASON_ICON_MAP: Record<SignalKey, IconName> = {
  visual: 'sparkles', // ← KEY decorative AI marker (state-0 default)
  collab: 'users',
  trending: 'trending-up',
};

/** 3 signal filter chip specs (D-S04-16 LAW inline precedent). */
interface SignalChipSpec {
  signal: SignalKey;
  label: string;
  icon: IconName;
}

const SIGNAL_CHIPS: readonly SignalChipSpec[] = [
  { signal: 'visual', label: 'Giống thị giác', icon: 'eye' },
  { signal: 'collab', label: 'Khách hay mua', icon: 'users' },
  { signal: 'trending', label: 'Đang trending', icon: 'trending-up' },
];

/** Header status badge label per active signal — mockup state-D line 200. */
const SIGNAL_HEADER_LABEL: Record<SignalKey, string> = {
  visual: 'Giống thị giác',
  collab: 'Khách hay mua',
  trending: 'Đang trending',
};

/** AI bubble copy per signal — mockup state-D line 211 designer-locked. */
const SIGNAL_BUBBLE_COPY: Record<SignalKey, string> = {
  visual: 'phù hợp',                    // state-0: "Tìm được 10 sản phẩm phù hợp..."
  collab: 'khách hay mua kèm',          // state-D: "Đây là 10 sản phẩm khách hay mua kèm:"
  trending: 'đang trending',
};

/** Default phase labels — fallback when BE omits label (mockup state-A lines 241/252/264/278). */
const DEFAULT_PHASES: PhaseItem[] = [
  { id: 'phase-0', label: 'Tải ảnh lên', status: 'pending' },
  { id: 'phase-1', label: 'Đọc nội dung sản phẩm', status: 'pending' },
  { id: 'phase-2', label: 'Tìm sản phẩm tương tự', status: 'pending' },
  { id: 'phase-3', label: 'Xếp hạng + sinh lý do gợi ý', status: 'pending' },
];

// ─── Page component ─────────────────────────────────────────────────────────

export default function Intent04Page() {
  const router = useRouter();
  const stream = useRecommendStream();
  const addItemMut = usePostCartItem();

  // ─── Local UI state ──────────────────────────────────────────────────────
  // submitStartedAtRef for D-S04-14 LAW first-card telemetry.
  const submitStartedAtRef = useRef<number | null>(null);
  const firstCardTrackedRef = useRef<boolean>(false);
  const recommendationShownRef = useRef<boolean>(false);

  // Camera <input type="file" hidden> ref for state-F re-upload.
  const cameraInputRef = useRef<HTMLInputElement>(null);
  // FE-side upload error display (image-uploader.ts throws on >8MB / not image)
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);

  // ─── Derived state (per C-S09-AP dynamic counter LAW) ────────────────────
  const turnNumber = stream.state.previousTurns.length + 1;
  const turnBadgeText = turnNumber >= 2 ? `Ảnh thứ ${turnNumber}` : undefined;
  const headerSubText =
    stream.state.kind === 'streaming'
      ? turnNumber >= 2
        ? `Đang phân tích ảnh thứ ${turnNumber}...`
        : 'Đang phân tích · ~3 giây'
      : null;

  // ─── Derived: top 10 carousel slice via composeBySignal (D-S09-NN-A LAW) ─
  const top10Products = useMemo(() => {
    // Filter out sparse skeleton slots (undefined) before re-rank.
    const dense = stream.state.products.filter(
      (p): p is RecommendedProduct => p !== undefined,
    );
    // Apply selector only when we have BE-side scoring complete (final or products event).
    // During product_ready streaming (sparse + still arriving), preserve insertion order.
    if (stream.state.kind === 'result' && dense.length > 0) {
      return composeBySignal(dense, stream.state.activeSignalFilter);
    }
    return dense.slice(0, 10);
  }, [stream.state.products, stream.state.activeSignalFilter, stream.state.kind]);

  // ─── Derived: phases for PhasesCard render (map state.phases → PhaseItem[]) ─
  const phasesList: PhaseItem[] = useMemo(() => {
    return DEFAULT_PHASES.map((def, i) => {
      const slot = stream.state.phases[i as 0 | 1 | 2 | 3];
      if (!slot) return def;
      const phaseStatus: 'done' | 'active' | 'pending' =
        slot.status === 'error' ? 'pending' : slot.status; // PhasesCard doesn't render 'error'
      return {
        id: def.id,
        label: slot.label || def.label,
        status: phaseStatus,
        meta: slot.meta,
      };
    });
  }, [stream.state.phases]);

  // ─── Effects ─────────────────────────────────────────────────────────────

  // D-S04-14 LAW: emit `intent.first_card_emitted` + `recommendation.shown`
  // ONCE per turn when first ProductCard paints.
  useEffect(() => {
    if (firstCardTrackedRef.current || !stream.state.currentTurn) return;
    const firstNonNull = stream.state.products.findIndex(
      (p) => p !== undefined,
    );
    if (firstNonNull >= 0 && submitStartedAtRef.current !== null) {
      const elapsed = Math.round(performance.now() - submitStartedAtRef.current);
      trackFirstCardEmitted({
        request_id: stream.state.currentTurn.requestId,
        time_to_first_card_ms: elapsed,
        total_cards_expected: stream.state.totalExpected || stream.state.products.length,
        source: 'image',
      });
      firstCardTrackedRef.current = true;
    }
  }, [stream.state.products, stream.state.currentTurn, stream.state.totalExpected]);

  // Emit `recommendation.shown` once per turn when result kind + ≥1 product visible.
  useEffect(() => {
    if (
      recommendationShownRef.current ||
      stream.state.kind !== 'result' ||
      !stream.state.currentTurn ||
      top10Products.length === 0
    ) {
      return;
    }
    trackRecommendationShown({
      source: 'image',
      seed_product_id: null,
      products: top10Products.map((p, i) => ({
        position: i,
        product_id: p.id,
        reason: p.reason,
        match_type: p.match_type,
      })),
      request_id: stream.state.currentTurn.requestId,
    });
    recommendationShownRef.current = true;
  }, [stream.state.kind, top10Products, stream.state.currentTurn]);

  // Reset telemetry refs when starting a new turn (submit_image OR append_new_turn).
  useEffect(() => {
    if (stream.state.kind === 'streaming') {
      submitStartedAtRef.current = performance.now();
      firstCardTrackedRef.current = false;
      recommendationShownRef.current = false;
    }
  }, [stream.state.currentTurn?.turnId, stream.state.kind]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleInitialUpload = useCallback(
    async (base64: string) => {
      setUploadErrorMsg(null);
      submitStartedAtRef.current = performance.now();
      await stream.submitImage(base64);
    },
    [stream],
  );

  // Wrapper for ImageDropZone signature (onUpload(b64, meta))
  const handleDropZoneUpload = useCallback(
    async (base64: string, _meta: { fileName: string; sizeBytes: number; mimeType: string }) => {
      await handleInitialUpload(base64);
    },
    [handleInitialUpload],
  );

  const handleCameraClick = useCallback(() => {
    cameraInputRef.current?.click();
  }, []);

  const handleCameraChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ''; // reset so same file re-selectable
      if (!file) return;
      setUploadErrorMsg(null);
      try {
        const result = await readImageAsBase64(file);
        submitStartedAtRef.current = performance.now();
        await stream.appendNewTurn(result.base64);
      } catch (err) {
        if (err instanceof ImageUploadError) {
          setUploadErrorMsg(err.message);
        } else {
          setUploadErrorMsg('Đọc ảnh thất bại — vui lòng thử lại.');
        }
      }
    },
    [stream],
  );

  const handleSignalChipTap = useCallback(
    (newSignal: SignalKey) => {
      const oldSignal = stream.state.activeSignalFilter;
      if (oldSignal === newSignal) return;
      stream.setSignalFilter(newSignal);
      // Optional NICE_TO_HAVE telemetry per PHASE_05 §I.
      if (stream.state.currentTurn) {
        trackRecommendationDismissed({
          from_signal: oldSignal,
          to_signal: newSignal,
          request_id: stream.state.currentTurn.requestId,
        });
      }
    },
    [stream],
  );

  const handleProductAdd = useCallback(
    (product: RecommendedProduct, position: number) => {
      stream.setCartConfirm({ title: product.title, price: product.price });
      // Fire-and-forget BE cart mutation (per S-04 hotfix Bug #1 precedent).
      void addItemMut.mutateAsync({
        product_id: product.id,
        quantity: 1,
      } as never).catch((err: unknown) => {
        // Cart errors surfaced via TanStack mutation state in cart UI; don't
        // block recommendation flow.
        // eslint-disable-next-line no-console
        console.warn('[intent-04] cart add failed', err);
      });
      // Behavior telemetry (AC42).
      if (stream.state.currentTurn) {
        trackRecommendationClicked({
          position,
          product_id: product.id,
          match_type: product.match_type,
          active_signal_filter: stream.state.activeSignalFilter,
          request_id: stream.state.currentTurn.requestId,
        });
      }
      // Auto-dismiss cart confirm after 2.5s
      window.setTimeout(() => {
        stream.dismissCartConfirm();
      }, 2500);
    },
    [stream, addItemMut],
  );

  const handleBack = useCallback(() => {
    router.push('/home');
  }, [router]);

  const handleEmptyCaptureAgain = useCallback(() => {
    stream.dispatch({ type: 'reset' });
  }, [stream]);

  const handleEmptyToTextSearch = useCallback(() => {
    router.push('/intent-03');
  }, [router]);

  const handleEmptyToImport = useCallback(() => {
    router.push('/intent-01');
  }, [router]);

  const handleErrorRetry = useCallback(() => {
    if (stream.state.currentTurn?.imageB64) {
      void stream.submitImage(stream.state.currentTurn.imageB64);
    } else {
      stream.dispatch({ type: 'reset' });
    }
  }, [stream]);

  // ─── Render branches ─────────────────────────────────────────────────────

  const renderHeader = () => (
    <div className="px-3.5 py-3 flex items-center gap-2.5 bg-white border-b-[0.5px] border-icp-pink-100">
      <button
        type="button"
        onClick={handleBack}
        aria-label="Quay lại"
        className="w-[34px] h-[34px] bg-icp-pink-100 rounded-full flex items-center justify-center"
      >
        <Icon name="arrow-left" size={18} className="text-icp-pink-700" />
      </button>
      <div className="relative w-9 h-9 flex-shrink-0">
        <div className="absolute inset-0 rounded-full border-[1.5px] border-icp-rose-500/35" />
        <div className="relative w-9 h-9 rounded-full flex items-center justify-center bg-[radial-gradient(circle_at_30%_30%,_#FFF_0%,_#FFE4E6_35%,_#FB923C_100%)] shadow-[0_6px_14px_rgba(190,24,93,0.3)]">
          <Icon name="sparkles" size={18} className="text-icp-pink-700" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[14px] font-bold text-icp-rose-950">
          Gợi ý sản phẩm
          <span className="text-[9px] font-bold bg-gradient-to-br from-icp-pink-500 to-icp-orange-500 text-white px-1.5 py-0.5 rounded">
            AI
          </span>
        </div>
        {headerSubText ? (
          <div className="flex items-center gap-1 text-[10px] text-icp-pink-700 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-icp-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.7)] animate-pulse" />
            {headerSubText}
          </div>
        ) : stream.state.kind === 'result' ? (
          <div className="flex items-center gap-1 text-[10px] text-icp-green-600 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-icp-green-500" />
            Sắp xếp theo: {SIGNAL_HEADER_LABEL[stream.state.activeSignalFilter]}
          </div>
        ) : null}
      </div>
    </div>
  );

  const renderHiddenCameraInput = () => (
    <input
      ref={cameraInputRef}
      type="file"
      accept="image/*"
      capture="environment"
      className="hidden"
      aria-hidden="true"
      onChange={handleCameraChange}
    />
  );

  const renderPreviousTurns = () => {
    if (stream.state.previousTurns.length === 0) return null;
    return (
      <>
        {stream.state.previousTurns.map((turn) => {
          const summary = turn.products.length > 0
            ? `${turn.products.length} gợi ý ${turn.detected?.category ?? 'sản phẩm'}`
            : 'Câu hỏi trước';
          return (
            <PreviousTurnChip
              key={turn.turnId}
              summary={summary}
              iconHint="image"
              onClick={() => {
                /* future: scroll-to-turn — current scope: chip is visual only */
              }}
            />
          );
        })}
        {/* "ẢNH MỚI · HH:MM" divider per mockup state-F lines 218-222 */}
        <div className="flex items-center gap-2 px-1">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-icp-pink-200 to-transparent" />
          <span className="text-[9px] text-icp-rose-700 font-bold tracking-[0.5px]">
            ẢNH MỚI · {formatHHMM(stream.state.currentTurn?.startedAtMs ?? Date.now())}
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-icp-pink-200 to-transparent" />
        </div>
      </>
    );
  };

  // STATE-PRE: idle + no previous turns → welcome + ImageDropZone
  if (stream.state.kind === 'idle' && stream.state.previousTurns.length === 0) {
    return (
      <div className={styles.pageWrap}>
      <div className={cn(styles.phoneFrame, 'flex flex-col min-h-[600px] overflow-y-auto')}>
        {renderHeader()}
        {renderHiddenCameraInput()}
        <div className="flex-1 flex flex-col">
          <div className="px-4 pt-4">
            <div className="flex gap-2 items-start mb-4">
              <div className="w-[30px] h-[30px] flex-shrink-0 rounded-full flex items-center justify-center bg-[radial-gradient(circle_at_30%_30%,_#FFF_0%,_#FFE4E6_40%,_#FB923C_100%)]">
                <Icon name="sparkles" size={14} className="text-icp-pink-700" />
              </div>
              <div className="flex-1 bg-white border-[0.5px] border-icp-pink-200 rounded-[18px] rounded-tl-[4px] px-3.5 py-3 text-[13px] text-icp-rose-950 font-medium leading-relaxed">
                Tải ảnh sản phẩm anh thích, em sẽ gợi ý 10 sản phẩm tương tự trong shop kèm lý do gợi ý.
              </div>
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <ImageDropZone onUpload={handleDropZoneUpload} />
            {uploadErrorMsg ? (
              <div className="mx-5 mb-4 rounded-xl px-3 py-2.5 bg-icp-rose-50 border-[0.5px] border-icp-rose-200">
                <p className="text-[12px] font-semibold text-icp-rose-700">{uploadErrorMsg}</p>
              </div>
            ) : null}
          </div>
        </div>
      <HomeBottomNav />
      </div>
    </div>
    );
  }

  // STATE-A / STATE-F: streaming
  if (stream.state.kind === 'streaming') {
    return (
      <div className={styles.pageWrap}>
      <div className={cn(styles.phoneFrame, 'flex flex-col min-h-[600px] overflow-y-auto')}>
        {renderHeader()}
        {renderHiddenCameraInput()}
        <div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto">
          {renderPreviousTurns()}
          {stream.state.currentTurn ? (
            <UserImageBubble
              imageB64={stream.state.currentTurn.imageB64}
              badgeText={turnBadgeText}
              caption={turnNumber >= 2 ? 'Còn cái này thì sao?' : undefined}
              timestamp={turnNumber >= 2 ? 'vừa xong' : '2 giây trước'}
            />
          ) : null}
          <div className="flex gap-2 items-start">
            <div className="w-[30px] h-[30px] flex-shrink-0 rounded-full flex items-center justify-center bg-[radial-gradient(circle_at_30%_30%,_#FFF_0%,_#FFE4E6_40%,_#FB923C_100%)]">
              <Icon name="sparkles" size={14} className="text-icp-pink-700" />
            </div>
            <div className="flex-1">
              <PhasesCard mode="list" phases={phasesList} />
            </div>
          </div>
          {/* If understanding came back early, show detected attrs preview */}
          {stream.state.understanding?.detected ? (
            <div className="ml-[38px] text-[11px] text-icp-pink-700 font-medium">
              Đã nhận diện: {String(stream.state.understanding.detected.category ?? '...')}
            </div>
          ) : null}
        </div>
      <HomeBottomNav />
      </div>
    </div>
    );
  }

  // STATE-B: empty
  if (stream.state.kind === 'empty') {
    return (
      <div className={styles.pageWrap}>
      <div className={cn(styles.phoneFrame, 'flex flex-col min-h-[600px] overflow-y-auto')}>
        {renderHeader()}
        {renderHiddenCameraInput()}
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<Icon name="image" size={48} className="text-icp-pink-300" />}
            title="Chưa tìm thấy sản phẩm gợi ý"
            subtitle={stream.state.emptyState?.message ?? 'Anh thử chụp góc khác hoặc tìm bằng chữ nhé.'}
            actions={
              <>
                <button
                  type="button"
                  onClick={handleEmptyCaptureAgain}
                  className="w-full bg-gradient-to-br from-icp-pink-500 to-icp-orange-500 text-white text-[13px] font-semibold py-2.5 rounded-full shadow-[0_6px_16px_rgba(233,30,99,0.25)]"
                >
                  Chụp ảnh khác
                </button>
                <button
                  type="button"
                  onClick={handleEmptyToTextSearch}
                  className="w-full bg-white border-[0.5px] border-icp-pink-200 text-icp-pink-700 text-[13px] font-semibold py-2.5 rounded-full"
                >
                  Mô tả bằng chữ thay vì ảnh
                </button>
                <button
                  type="button"
                  onClick={handleEmptyToImport}
                  className="w-full bg-white border-[0.5px] border-icp-pink-200 text-icp-pink-700 text-[13px] font-semibold py-2.5 rounded-full"
                >
                  Nhập hàng mới
                </button>
              </>
            }
          />
        </div>
      <HomeBottomNav />
      </div>
    </div>
    );
  }

  // STATE-C: error (with E_VISION_BLUR special case via BlurErrorCard)
  if (stream.state.kind === 'error') {
    const isBlur = stream.state.error?.code === 'E_VISION_BLUR';
    return (
      <div className={styles.pageWrap}>
      <div className={cn(styles.phoneFrame, 'flex flex-col min-h-[600px] overflow-y-auto')}>
        {renderHeader()}
        {renderHiddenCameraInput()}
        <div className="flex-1 flex items-center justify-center p-4">
          {isBlur ? (
            <BlurErrorCard onRetake={handleErrorRetry} onManualEntry={handleErrorRetry} />
          ) : (
            <ErrorState
              errorOrb={<div className="w-20 h-20 rounded-full bg-icp-rose-100 flex items-center justify-center"><Icon name="x" size={36} className="text-icp-rose-600" /></div>}
              errorCode={String(stream.state.error?.code ?? 'E_NETWORK')}
              title="Có lỗi xảy ra"
              subtitle={stream.state.error?.message ?? 'Không thể gợi ý sản phẩm. Vui lòng thử lại.'}
              actions={
                <>
                  <button
                    type="button"
                    onClick={handleErrorRetry}
                    className="w-full bg-gradient-to-br from-icp-pink-500 to-icp-orange-500 text-white text-[13px] font-semibold py-2.5 rounded-full"
                  >
                    Thử lại
                  </button>
                  <button
                    type="button"
                    onClick={handleEmptyToTextSearch}
                    className="w-full bg-white border-[0.5px] border-icp-pink-200 text-icp-pink-700 text-[13px] font-semibold py-2.5 rounded-full"
                  >
                    Tìm bằng chữ
                  </button>
                </>
              }
            />
          )}
        </div>
      <HomeBottomNav />
      </div>
    </div>
    );
  }

  // STATE-0 / STATE-D / STATE-E: result (with signal filter + optional cart confirm)
  return (
    <div className={styles.pageWrap}>
      <div className={cn(styles.phoneFrame, 'flex flex-col min-h-[600px] overflow-y-auto')}>
      {renderHeader()}
      {renderHiddenCameraInput()}
      <div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto pb-24">
        {renderPreviousTurns()}
        {stream.state.currentTurn ? (
          <UserImageBubble
            imageB64={stream.state.currentTurn.imageB64}
            badgeText={turnBadgeText}
            timestamp="2 giây trước"
          />
        ) : null}

        {/* AI BUBBLE 1: detected attrs */}
        {stream.state.detected ? (
          <div className="flex gap-2 items-start">
            <div className="w-[30px] h-[30px] flex-shrink-0 rounded-full flex items-center justify-center bg-[radial-gradient(circle_at_30%_30%,_#FFF_0%,_#FFE4E6_40%,_#FB923C_100%)]">
              <Icon name="sparkles" size={14} className="text-icp-pink-700" />
            </div>
            <div className="flex-1 bg-white border-[0.5px] border-icp-pink-200 rounded-[18px] rounded-tl-[4px] px-3.5 py-3">
              <div className="text-[13px] text-icp-rose-950 font-semibold mb-2 leading-snug">
                Đã phân tích xong! Tôi nhận diện được:
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1.5 bg-icp-pink-100 text-icp-rose-950 text-[11px] font-semibold px-2 py-1 rounded-lg">
                  <Icon name="tag" size={11} className="text-icp-pink-700" />
                  {stream.state.detected.category}
                </span>
                {Object.entries(stream.state.detected.attributes ?? {}).slice(0, 3).map(([k, v]) => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1 bg-icp-orange-50 text-icp-orange-900 text-[11px] font-semibold px-2 py-1 rounded-lg"
                  >
                    {String(v)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* AI BUBBLE 2: filter chips + intro copy (inline page-level per D-S04-16 LAW precedent) */}
        <div className="flex gap-2 items-start">
          <div className="w-[30px] h-[30px] flex-shrink-0 rounded-full flex items-center justify-center bg-[radial-gradient(circle_at_30%_30%,_#FFF_0%,_#FFE4E6_40%,_#FB923C_100%)]">
            <Icon name="sparkles" size={14} className="text-icp-pink-700" />
          </div>
          <div className="flex-1 bg-white border-[0.5px] border-icp-pink-200 rounded-[18px] rounded-tl-[4px] px-3.5 py-3">
            <div className="text-[13px] text-icp-rose-950 font-semibold leading-snug mb-2.5">
              {stream.state.activeSignalFilter === 'visual' ? (
                <>Tìm được <span className="font-bold bg-gradient-to-br from-icp-pink-600 to-icp-orange-500 bg-clip-text text-transparent">{top10Products.length} sản phẩm</span> phù hợp. Lướt ngang để xem nhé:</>
              ) : (
                <>Đây là <span className="font-bold bg-gradient-to-br from-icp-pink-600 to-icp-orange-500 bg-clip-text text-transparent">{top10Products.length} sản phẩm {SIGNAL_BUBBLE_COPY[stream.state.activeSignalFilter]}</span>:</>
              )}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {SIGNAL_CHIPS.map((chip) => {
                const isActive = stream.state.activeSignalFilter === chip.signal;
                return (
                  <button
                    key={chip.signal}
                    type="button"
                    onClick={() => handleSignalChipTap(chip.signal)}
                    className={cn(
                      'flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[11px] font-semibold border-[0.5px]',
                      isActive
                        ? 'bg-gradient-to-br from-icp-pink-500 to-icp-orange-500 text-white font-bold border-transparent shadow-[0_4px_10px_rgba(233,30,99,0.3)]'
                        : 'bg-white text-icp-rose-700 border-icp-pink-200',
                    )}
                  >
                    <Icon name={chip.icon} size={12} />
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* CAROUSEL — 10 ProductCard slots (D-S04-14 LAW progressive) */}
        <div className="ml-[38px]">
          <div className="flex gap-2.5 overflow-x-auto pb-2.5 -mr-3.5">
            {top10Products.map((p, i) => {
              if (!p) {
                // Skeleton slot (sparse during streaming)
                return (
                  <div
                    key={`skel-${i}`}
                    className="flex-shrink-0 w-[172px] h-[260px] bg-icp-pink-100/40 rounded-[18px] animate-pulse"
                  />
                );
              }
              return (
                <ProductCard
                  key={p.id}
                  width={172}
                  brand={p.brand ?? ''}
                  name={p.title}
                  price={p.price}
                  imageGradient={p.image_gradient ?? undefined}
                  imageIcon={(p.icon_hint as IconName | undefined) ?? 'package'}
                  confidence={Math.round(p.match_score * 100)}
                  confidenceIcon={SIGNAL_MATCH_ICON_MAP[p.match_type]}
                  aiReason={p.reason}
                  reasonChipIcon={SIGNAL_REASON_ICON_MAP[stream.state.activeSignalFilter]}
                  soldCount={p.sold_count ? `đã bán ${p.sold_count}` : undefined}
                  addButton={{ variant: 'green', position: 'price-row' }}
                  onAdd={() => handleProductAdd(p, i)}
                />
              );
            })}
          </div>
          <div className="flex items-center justify-between pt-0.5 mr-3.5">
            <div className="flex gap-1">
              <span className="w-3.5 h-0.5 rounded bg-gradient-to-r from-icp-pink-500 to-icp-orange-500" />
              {Array.from({ length: Math.max(0, Math.min(9, top10Products.length - 1)) }).map((_, idx) => (
                <span key={idx} className="w-1 h-0.5 rounded bg-icp-pink-200" />
              ))}
            </div>
            <div className="text-[10px] text-icp-rose-700 flex items-center gap-1">
              <span className="font-bold font-mono text-icp-rose-950">{top10Products.length}</span>
              <span className="opacity-60">/{top10Products.length}</span>
              <Icon name="arrow-right" size={12} className="text-icp-pink-700" />
            </div>
          </div>
        </div>

        {/* AI BUBBLE 3: co-purchase hint (state-0 only) */}
        {stream.state.coPurchaseHint ? (
          <CoPurchaseCategoryHintCard
            sourceCategory={stream.state.coPurchaseHint.source_category}
            targetCategories={stream.state.coPurchaseHint.target_categories}
            confidence={stream.state.coPurchaseHint.confidence}
            onCategoryTap={(cat) => router.push(`/intent-03?q=${encodeURIComponent(cat)}`)}
          />
        ) : null}
      </div>

      {/* STATE-E: cart confirm toast (overlay) */}
      {stream.state.addToCartConfirm ? (
        <div className="fixed bottom-20 left-4 right-4 z-50">
          <AddToCartConfirmCard
            product={{
              title: stream.state.addToCartConfirm.title,
              price: stream.state.addToCartConfirm.price,
            }}
            onDismiss={() => stream.dismissCartConfirm()}
          />
        </div>
      ) : null}

      {/* INPUT BAR with camera icon for re-upload */}
      <div className="px-3.5 py-2.5 flex-shrink-0">
        <div className="flex gap-2 items-center bg-white border-[0.5px] border-icp-pink-200 rounded-full px-4 py-1.5 shadow-[0_10px_26px_rgba(233,30,99,0.15)]">
          <Icon name="sparkles" size={18} className="text-icp-pink-500" />
          <input
            type="text"
            placeholder="Hỏi thêm hoặc tải ảnh khác..."
            className="flex-1 bg-transparent border-none text-[13px] outline-none text-icp-rose-950"
            disabled
          />
          <button
            type="button"
            onClick={handleCameraClick}
            aria-label="Tải ảnh khác"
            className="w-9 h-9 bg-icp-pink-100 rounded-full flex items-center justify-center"
          >
            <Icon name="camera" size={18} className="text-icp-pink-700" />
          </button>
        </div>
      </div>
      <HomeBottomNav />
      </div>
    </div>
  );
}

// ─── Pure helpers ───────────────────────────────────────────────────────────

function formatHHMM(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
