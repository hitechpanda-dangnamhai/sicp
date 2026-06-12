'use client';

/**
 * apps/web/app/intent-02/page.tsx
 *
 * Intent 02 (Voice Buy) page — wires 8 voice states end-to-end.
 *
 * Slice:    S-08 Voice Buy (Intent 02) — V-SLICE
 * Task:     T02 FE Page Wire (Phiên Sx08-G) — REPLACE full (was S-03 placeholder stub)
 *
 * Source:   docs/mockups/intent-02/intent-02-state-{0,A,B,C,D,E,F,G}-*.html (8 states)
 *           Wire pattern referenced from app/intent-03/page.tsx (S-04) +
 *           app/intent-05/page.tsx (cart, router.push precedent).
 *
 * Decisions applied:
 * - STRONGEST LAW: FE renders BE-emitted fields verbatim. KHÔNG telemetry (§0.2),
 *   KHÔNG TTS (§3.Z row 4), KHÔNG sửa BE, KHÔNG bịa số.
 * - §4 KNOWN-ISSUE: state-C match badge + state-F similarity badge ship dark —
 *   BE typed SSE does not carry a wrapped pct field. matchScorePct / similarityPct
 *   NOT passed. (Prop exists; activates when BE adds the field.)
 * - W1 LOCK: clarify chip-row from voiceState.clarifyOptions (SSE), not resume.
 * - D-S04-13 LAW: EventSource stays open through interrupt; closes on `final`.
 * - C-S08-T: CoPurchaseHintCard rendered only when hint present (null-safe).
 * - CTA routing precedent: "Thanh toán" → router.push('/intent-06') (checkout);
 *   cart pill (CartCountPill) → router.push('/intent-05') (giỏ hàng, precedent
 *   /home tile gio_hang → /intent-05);
 *   "Mua tiếp" → reset to idle; keyboard top-right → router.push('/intent-03');
 *   back → router.push('/home').
 *
 * NOTE: ClarifyOptionChip + CartCountPill are NEW molecules (B8/B9) added to the
 * barrel in this slice's governance step; imported by direct path here to avoid a
 * barrel ordering dependency during emit.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { tenantHref } from '@/lib/tenant-href';
import { useTenant } from '@/lib/providers/tenant-provider';

import { cn } from '@/lib/utils';
import styles from '../../home/home.module.css';

import {
  OrbPulse,
  Icon,
  Avatar,
} from '@/components/icp/atoms';
import {
  ConversationBubble,
  PhasesCard,
  type PhaseItem,
  LivePartialTranscript,
  PreviousTurnChip,
  CoPurchaseHintCard,
  StockReplacementCard,
} from '@/components/icp/molecules';
import { ClarifyOptionChip } from '@/components/icp/molecules/ClarifyOptionChip';
import { CartCountPill } from '@/components/icp/molecules/CartCountPill';
import { HomeBottomNav } from '@/components/icp/layout';

import { useCart } from '@/src/features/cart/use-cart';
import { useVoiceStream } from '@/src/features/voice-buy/use-voice-stream';
import { useVoiceRecorder } from '@/src/features/voice-buy/use-voice-recorder';
import { useVoiceContext } from '@/src/features/voice-buy/use-voice-context';
import {
  postClarifyPick,
  postResolveReplace,
  postAddToCart,
} from '@/src/features/voice-buy/voice-action-poster';
import type {
  VoiceErrorCode,
} from '@/src/features/voice-buy/voice-state-machine';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * state-C item-thumb gradients (mockup .item-thumb.t1/.t2/.t3 verbatim). Cosmetic
 * per-index cycling — BE does NOT carry a thumb color field (Luật #7 đồng tông).
 */
const THUMB_GRADIENTS: ReadonlyArray<{ wrap: string; icon: string }> = [
  { wrap: 'linear-gradient(135deg, #FFE4E6, #FECDD3)', icon: 'linear-gradient(135deg, #F43F5E, #E11D48)' },
  { wrap: 'linear-gradient(135deg, #FFEDD5, #FED7AA)', icon: 'linear-gradient(135deg, #FB923C, #EA580C)' },
  { wrap: 'linear-gradient(135deg, #FEF3C7, #FCD34D)', icon: 'linear-gradient(135deg, #F59E0B, #D97706)' },
];

/** mm:ss from ms (mockup mono timer "0:04"). */
function fmtTimer(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** state-G title/subtitle keyed by errorCode (handoff §5 state-G). */
function errorCopy(code: VoiceErrorCode | null): { title: string; sub: string } {
  switch (code) {
    case 'E_NO_SPEECH':
      return {
        title: 'Aida chưa nghe được bạn nói gì',
        sub: 'Hình như chưa có âm thanh. Bạn thử nói lại gần micro hơn nhé.',
      };
    case 'E_TRANSCRIBE_FAILED':
      return {
        title: 'Aida gặp lỗi xử lý âm thanh',
        sub: 'Có trục trặc khi chuyển giọng nói thành chữ. Bạn thử lại giúp Aida nhé.',
      };
    case 'E_INTENT_PARSE_FAILED':
      return {
        title: 'Aida chưa hiểu yêu cầu',
        sub: 'Bạn thử nói rõ tên sản phẩm và số lượng, ví dụ "2 chai nước tương Maggi".',
      };
    case 'E_PERMISSION_DENIED':
      return {
        title: 'Aida cần quyền dùng micro',
        sub: 'Vào Cài đặt trình duyệt → cho phép micro, rồi quay lại thử nói lại nhé.',
      };
    default:
      return {
        title: 'Aida chưa nghe được bạn nói gì',
        sub: 'Bạn thử nói lại trong môi trường yên tĩnh hơn nhé.',
      };
  }
}

/**
 * Số món vừa thêm vào giỏ ở state-E.
 *
 * Luồng clarify KHÔNG emit `products` SSE (verified Sx08-H Console: chỉ có
 * voice_clarify_options* → cart_updated → final), nên `state.matchedProducts`
 * rỗng ở cart-added → dùng nó sẽ ra "0 món". BE emit số commit thật qua
 * `cart_updated.committed_count` (buying_by_voices L1227) NHƯNG typed SSE
 * SseCartUpdatedEvent = z.object({}).passthrough() (KHÔNG khai báo field) →
 * đọc defensive (giống pattern understanding.items / match_pct). KHÔNG bịa số.
 *
 * Thứ tự fallback: committed_count (BE truth) → cart.items.length → matchedProducts.length.
 */
function voiceAddedCount(
  cartUpdated: Record<string, unknown> | null,
  fallback: number,
): number {
  if (cartUpdated) {
    const cc = (cartUpdated as { committed_count?: unknown }).committed_count;
    if (typeof cc === 'number' && cc >= 0) return cc;
    const cart = (cartUpdated as { cart?: { items?: unknown } }).cart;
    const items = cart?.items;
    if (Array.isArray(items)) return items.length;
  }
  return fallback;
}

/**
 * Số món vừa xóa khỏi giỏ ở state-removed (bug #4 fix Sx08-I).
 *
 * BE remove path (voice_cart_remove) emit cart_updated.removed_count (truth).
 * typed SSE passthrough rỗng → đọc defensive, KHÔNG bịa số. Fallback 1 (đã
 * verify BE chỉ remove khi match được item → tối thiểu 1 khi vào nhánh này).
 */
function voiceRemovedCount(
  cartUpdated: Record<string, unknown> | null,
): number {
  if (cartUpdated) {
    const rc = (cartUpdated as { removed_count?: unknown }).removed_count;
    if (typeof rc === 'number' && rc >= 0) return rc;
  }
  return 1;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Intent02VoiceBuyPage(): React.ReactElement {
  const router = useRouter();
  const tenant = useTenant();
  const { state, submitUtterance, dispatch } = useVoiceStream();
  const { data: cart } = useCart();
  const ctx = useVoiceContext(state);

  // state-C bundle totals — derived from REAL BE price×qty (Luật #6, KHÔNG bịa số).
  const cartReadyUnits = React.useMemo(
    () => state.matchedProducts.reduce((sum, p) => sum + p.qty, 0),
    [state.matchedProducts],
  );
  const cartReadyTotal = React.useMemo(
    () => state.matchedProducts.reduce((sum, p) => sum + p.price * p.qty, 0),
    [state.matchedProducts],
  );

  // Per-utterance retry counter for resume _meta.attempt_n (D-S04-13).
  const attemptRef = React.useRef(0);

  // Recorder: on auto-stop OR manual stop, submit the captured audio.
  const recorder = useVoiceRecorder({
    maxMs: 30_000,
    onAutoStop: () => {
      // onstop async builds audioBase64; submission handled by the effect below.
    },
  });

  // When recorder produces base64 (after stop), POST + open SSE.
  const lastSubmittedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (recorder.audioBase64 && recorder.audioBase64 !== lastSubmittedRef.current) {
      lastSubmittedRef.current = recorder.audioBase64;
      attemptRef.current = 0;
      void submitUtterance(recorder.audioBase64);
    }
  }, [recorder.audioBase64, submitUtterance]);

  // Surface recorder FE-side errors (permission / no-speech) into the state machine.
  React.useEffect(() => {
    if (recorder.error) {
      dispatch({ type: 'set_error_code', code: recorder.error });
    }
  }, [recorder.error, dispatch]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleStartListening = React.useCallback(() => {
    dispatch({ type: 'start_listening' });
    void recorder.start();
  }, [dispatch, recorder]);

  const handleCancelListening = React.useCallback(() => {
    recorder.cancel();
    dispatch({ type: 'cancel_listening' });
  }, [dispatch, recorder]);

  const handleStopListening = React.useCallback(() => {
    recorder.stop(); // → audioBase64 effect → submitUtterance
  }, [recorder]);

  const handleReset = React.useCallback(() => {
    dispatch({ type: 'append_turn' });
    lastSubmittedRef.current = null;
  }, [dispatch]);

  const handleClarifyPick = React.useCallback(
    (productId: string) => {
      const rid = state.clarifyOptions?.request_id ?? state.activeUtteranceRid;
      if (!rid) return;
      attemptRef.current += 1;
      void postClarifyPick(rid, productId, attemptRef.current);
    },
    [state.clarifyOptions, state.activeUtteranceRid],
  );

  const handleResolveReplace = React.useCallback(
    (productId: string, replacementId: string) => {
      const rid = state.activeUtteranceRid;
      if (!rid) return;
      attemptRef.current += 1;
      void postResolveReplace(rid, productId, replacementId, attemptRef.current);
    },
    [state.activeUtteranceRid],
  );

  const handleAddToCart = React.useCallback(() => {
    const rid = state.activeUtteranceRid;
    if (!rid) return;
    attemptRef.current += 1;
    // Bulk commit: post add_to_cart for each matched product.
    state.matchedProducts.forEach((p) => {
      void postAddToCart(rid, p.product_id, attemptRef.current);
    });
  }, [state.activeUtteranceRid, state.matchedProducts]);

  // ─── Render shell ──────────────────────────────────────────────────────────

  return (
    <div className={styles.pageWrap}>
      <div className={cn(styles.phoneFrame, 'flex flex-col min-h-[600px] max-h-[calc(100vh-48px)] overflow-hidden')}>
        {/* Top bar — mockup .top-bar: padding 4px 18px 12px, gap 12, back-btn 38px shadow, title 17px/700, icon-btn keyboard fallback */}
        <header className="flex items-center gap-3 flex-shrink-0" style={{ padding: '4px 18px 12px' }}>
          <button
          type="button"
          aria-label="Quay lại"
          onClick={() => router.push(tenantHref('/home', tenant?.slug))}
          className="w-[38px] h-[38px] rounded-full bg-white border-[0.5px] border-icp-pink-200 flex items-center justify-center text-icp-pink-700 shadow-[0_2px_8px_rgba(233,30,99,0.1)]"
        >
          {/* chevron-left stroke #BE185D per mockup */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="text-[17px] font-bold text-icp-pink-900 tracking-[-0.3px]">Mua hàng bằng giọng nói</div>
          <div className="text-[11px] text-icp-pink-700 font-medium mt-px">Aida hiểu tiếng Việt tự nhiên</div>
        </div>
        <button
          type="button"
          aria-label="Gõ tay"
          onClick={() => router.push(tenantHref('/intent/03', tenant?.slug))}
          className="w-[38px] h-[38px] rounded-full bg-white/70 border-[0.5px] border-icp-pink-200 flex items-center justify-center text-icp-pink-700"
        >
          {/* No 'keyboard' IconName — inline SVG (mockup text-input fallback glyph). */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="4 7 4 4 20 4 20 7" />
            <line x1="9" y1="20" x2="15" y2="20" />
            <line x1="12" y1="4" x2="12" y2="20" />
          </svg>
        </button>
      </header>

      <main className="flex-1 flex flex-col overflow-y-auto" style={{ padding: '8px 22px 0' }}>
        {/* ═══ state-0: idle ═══ */}
        {state.phase === 'idle' ? (
          <div className="flex-1 flex flex-col items-center pb-6">
            {/* ai-label: gradient pill #FFE4E6→#FECDD3, 10px/700 uppercase, dot gradient */}
            <div
              className="inline-flex items-center gap-1.5 mt-3 px-[11px] py-[5px] rounded-[20px] text-[10px] font-bold uppercase tracking-[1px] text-icp-pink-700 border-[0.5px] border-icp-pink-200"
              style={{ background: 'linear-gradient(135deg, #FFE4E6, #FECDD3)' }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: 'linear-gradient(135deg, #E91E63, #FB923C)' }}
              />
              Aida • Sẵn sàng nghe
            </div>

            {/* hero-title 26px/700, 2 dòng, strong = gradient text */}
            <h1 className="text-[26px] font-bold text-icp-pink-900 text-center mt-3.5 tracking-[-0.5px] leading-[1.2]">
              Nói tự nhiên,
              <br />
              Aida{' '}
              <strong className="font-bold bg-gradient-to-br from-icp-pink-500 to-icp-amber-400 bg-clip-text text-transparent">
                hiểu hết
              </strong>
            </h1>
            <p className="text-[13px] text-icp-pink-700 text-center mt-2.5 leading-[1.5] font-medium" style={{ maxWidth: 300 }}>
              Bạn có thể nói nhiều sản phẩm trong 1 câu — Aida tách và đưa vào giỏ
            </p>

            {/* mic-wrapper 180px — port 1:1 mockup state-0 (.mic-aura + 2 .mic-ring + .mic-btn 130px
                gradient brand ĐẶC #E91E63→#F43F5E→#FB923C). OrbPulse 'idle' cho radial nhạt KHÔNG
                khớp nút brand đặc của mockup mic-idle → port inline (atom OrbPulse giữ cho state-A/G). */}
            <div className="relative flex items-center justify-center" style={{ width: 180, height: 180, margin: '26px auto 12px' }}>
              {/* aura radial glow */}
              <div
                className="absolute rounded-full animate-pulse"
                style={{
                  inset: -10,
                  background:
                    'radial-gradient(circle, rgba(233,30,99,0.35) 0%, rgba(251,146,60,0.2) 50%, transparent 75%)',
                }}
                aria-hidden
              />
              {/* 2 pulse rings */}
              <div className="absolute inset-0 rounded-full border-2 animate-pulse-ring" style={{ borderColor: 'rgba(233,30,99,0.4)' }} aria-hidden />
              <div className="absolute inset-0 rounded-full border-2 animate-pulse-ring" style={{ borderColor: 'rgba(251,146,60,0.4)', animationDelay: '1.2s' }} aria-hidden />
              {/* mic-btn 130px gradient brand đặc */}
              <button
                type="button"
                onClick={handleStartListening}
                aria-label="Nhấn để nói"
                className="relative z-[1] rounded-full flex items-center justify-center text-white transition-transform active:scale-95"
                style={{
                  width: 130,
                  height: 130,
                  background: 'linear-gradient(135deg, #E91E63 0%, #F43F5E 50%, #FB923C 100%)',
                  boxShadow: '0 16px 36px rgba(233,30,99,0.45), inset 0 4px 12px rgba(255,255,255,0.3)',
                }}
              >
                <svg width="58" height="58" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]" aria-hidden="true">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
              {/* floating-hint: gradient #FB923C→#EA580C, bottom -2 right 6 */}
              <div
                className="absolute text-[10px] font-bold text-white px-[11px] py-[5px] rounded-[12px] shadow-[0_4px_12px_rgba(234,88,12,0.4)]"
                style={{ bottom: -2, right: 6, background: 'linear-gradient(135deg, #FB923C, #EA580C)' }}
              >
                ⚡ Tap để nói
              </div>
            </div>

            {/* cta-tap 13px/600 + dot */}
            <div className="flex items-center gap-1.5 text-[13px] text-icp-pink-700 font-semibold text-center mt-0.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-icp-pink-500 animate-pulse" />
              Nhấn giữ hoặc tap để bắt đầu
            </div>

            {/* examples-card: #FFF radius18, header(icon 28px gradient + label) + 3 example-row(quote italic + tag món) */}
            <div className="w-full mt-[22px] bg-white rounded-[18px] border-[0.5px] border-icp-pink-200 shadow-[0_6px_16px_rgba(233,30,99,0.1)]" style={{ padding: '14px 14px 12px' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-[9px] flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FCE7F3, #FBCFE8)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#BE185D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 18h6" /><path d="M10 22h4" />
                    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
                  </svg>
                </div>
                <div className="text-[11px] font-bold uppercase tracking-[0.8px] text-icp-pink-700">Thử nói như sau</div>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { q: 'Mua 2 chai nước tương Maggi', tag: '1 món' },
                  { q: 'Cho tôi 3 hộp sữa Vinamilk với lại 1 thùng mì Hảo Hảo gà', tag: '2 món' },
                  { q: 'Lấy nước tương, đường, dầu ăn 1 lít mỗi loại 2 cái', tag: '3 món' },
                ].map((ex) => (
                  <div
                    key={ex.q}
                    className="flex items-center gap-2.5 rounded-[12px] border-[0.5px] border-icp-pink-200"
                    style={{ padding: '9px 12px', background: 'linear-gradient(135deg, #FFF1F5 0%, #FEEEE0 100%)' }}
                  >
                    <div className="flex-1 text-[12.5px] text-icp-pink-900 font-medium italic leading-[1.4]">“{ex.q}”</div>
                    <span
                      className="flex-shrink-0 text-[9px] font-bold text-white tracking-[0.4px] rounded-[6px]"
                      style={{ padding: '2px 7px', background: 'linear-gradient(135deg, #E91E63, #FB923C)' }}
                    >
                      {ex.tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* caps-row: grid 1fr 1fr, gradient cap-icon */}
            <div className="grid grid-cols-2 gap-2 mt-3.5 w-full">
              <div className="flex items-center gap-2 rounded-[12px] border-[0.5px] border-icp-pink-200 bg-white/60 backdrop-blur" style={{ padding: '10px 12px' }}>
                <div className="w-[26px] h-[26px] rounded-lg flex-shrink-0 flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, #E91E63, #BE185D)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" /><path d="M2 12h20" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </div>
                <div className="flex-1 text-[11px] text-icp-pink-900 font-semibold leading-[1.3]">
                  Hiểu <strong className="text-icp-pink-700 font-bold">tiếng Việt</strong> tự nhiên
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-[12px] border-[0.5px] border-icp-pink-200 bg-white/60 backdrop-blur" style={{ padding: '10px 12px' }}>
                <div className="w-[26px] h-[26px] rounded-lg flex-shrink-0 flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, #FB923C, #EA580C)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </div>
                <div className="flex-1 text-[11px] text-icp-pink-900 font-semibold leading-[1.3]">
                  Mua <strong className="text-icp-pink-700 font-bold">nhiều món</strong> 1 lượt
                </div>
              </div>
            </div>

            {/* previous turn chip (if any) */}
            {ctx.hasPreviousTurns && ctx.latestPreviousTurn ? (
              <div className="mt-4 w-full max-w-sm">
                <PreviousTurnChip summary={ctx.latestPreviousTurn.summary} iconHint="mic" />
              </div>
            ) : null}

            {/* persistent cart pill (if cart has items) */}
            {cart && cart.items.length > 0 ? (
              <div className="mt-4">
                <CartCountPill onClick={() => router.push(tenantHref('/intent/05', tenant?.slug))} />
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ═══ state-A: listening ═══ */}
        {state.phase === 'listening' ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-1.5 mb-2 text-[12px] font-bold text-icp-rose-600">
              <span className="inline-block w-2 h-2 rounded-full bg-icp-rose-600 animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.6)]" />
              Đang ghi âm
            </div>
            <div className="text-[36px] font-bold font-mono text-icp-pink-900 tracking-tight">
              {fmtTimer(recorder.durationMs)}
            </div>
            <div className="text-[12px] text-icp-pink-700 mb-6">tối đa 30 giây</div>

            <div className="w-[280px] h-[280px] flex items-center justify-center">
              <OrbPulse size="lg" state="listening" icon={<Icon name="mic" size={56} className="text-white" />} />
            </div>
            <div className="mt-4 text-[14px] text-icp-pink-700 font-medium">Aida đang nghe...</div>

            {state.voiceText ? (
              <div className="mt-4 w-full max-w-sm">
                <LivePartialTranscript text={state.voiceText} label="Tạm hiểu" />
              </div>
            ) : null}

            <div className="mt-8 flex items-center gap-6">
              <button
                type="button"
                aria-label="Hủy"
                onClick={handleCancelListening}
                className="w-14 h-14 rounded-full bg-white border-[0.5px] border-icp-pink-200 flex items-center justify-center text-icp-pink-700 shadow-sm"
              >
                <Icon name="x" size={22} />
              </button>
              <button
                type="button"
                onClick={handleStopListening}
                className="w-[76px] h-[76px] rounded-full bg-gradient-to-br from-icp-rose-500 to-icp-rose-600 text-white font-bold text-[13px] flex items-center justify-center shadow-[0_8px_20px_rgba(220,38,38,0.4)]"
              >
                DỪNG
              </button>
            </div>
          </div>
        ) : null}

        {/* ═══ state-B: transcribing ═══ */}
        {state.phase === 'transcribing' ? (
          <div className="flex-1 flex flex-col gap-3 pt-2">
            <ConversationBubble
              role="user"
              label="Đang chuyển thành chữ"
              text={state.voiceText || '...'}
              voiceMeta={{
                duration: fmtTimer(recorder.durationMs),
                partialBadge: '⚡ Streaming',
                liveCursor: true,
              }}
            />
            <div className="flex gap-2">
              <Avatar role="ai" />
              <div className="flex-1">
                <ConversationBubble role="ai" variant="greet" text={<>Aida đang <strong>hiểu yêu cầu</strong>...</>} />
                <div className="mt-2">
                  <PhasesCard
                    mode="card"
                    header={{ icon: 'sparkles', title: 'Aida đang xử lý' }}
                    phases={Object.values(state.phases)
                      .sort((a, b) => a.phase_id - b.phase_id)
                      .map<PhaseItem>((slot) => ({
                        id: String(slot.phase_id),
                        label: slot.label,
                        meta: slot.meta,
                        status: slot.status,
                      }))}
                  />
                </div>
              </div>
            </div>

            {/* peek-card parsed items */}
            {state.parsedItems.length > 0 ? (
              <div className="bg-white/70 border-[0.5px] border-icp-pink-200 rounded-2xl p-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.5px] text-icp-pink-700 mb-2">
                  Đã nhận diện
                </div>
                {state.parsedItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 text-[13px] text-icp-pink-900">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-icp-pink-100 text-icp-pink-700 text-[11px] font-bold">
                      {i + 1}
                    </span>
                    <span className="font-semibold">{item.query}</span>
                    <span className="text-icp-pink-700">
                      · SL {item.qty}
                      {item.unit ? ` (${item.unit})` : ''}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ═══ state-C: cart-ready — BUNDLE-CARD (mockup intent-02-state-C, port verbatim) ═══ */}
        {/*
          Sx08-J: REPLACE plain CartItemRow list → bundle-card container per mockup.
          Reuse-vs-wrap (Luật #4): CartItemRow là single-row (stepper 26px, stock
          banner, cornerBadge ảnh) — KHÁC cấu trúc bundle-card (container + header
          "Giỏ tạm" + count pill + item-thumb 52px gradient theo index + totals-strip).
          → wrap inline (KHÔNG nhồi CartItemRow). px/màu/gradient port verbatim mockup.
          BE KHÔNG cấp (Luật #6 — KHÔNG bịa): match-badge "% khớp" ẩn (match_score raw
          0..~30, §4), stock "Còn N" ẩn (không có field). line_total/unit_price/totals
          tính từ price×qty (số thật BE đã cấp). thumb gradient t1/t2/t3 cosmetic (Luật #7).
        */}
        {state.phase === 'cart-ready' ? (
          <div className="flex-1 flex flex-col gap-3 pt-2">
            {/* AI parsed-greet bubble (.ai-bubble-greet) */}
            <div className="flex gap-2">
              <Avatar role="ai" />
              <div className="flex-1 bg-white rounded-[4px_16px_16px_16px] px-3.5 py-3 border-[0.5px] border-icp-pink-200 shadow-[0_4px_12px_rgba(233,30,99,0.08)]">
                <div className="text-[12.5px] text-icp-pink-900 font-medium leading-[1.5]">
                  Aida đã hiểu <strong className="text-icp-pink-700 font-bold">{state.matchedProducts.length} sản phẩm</strong> trong câu của bạn{' '}
                  <span className="inline-flex items-center gap-1 align-middle bg-gradient-to-br from-icp-pink-500 to-icp-amber-400 text-white px-2 py-[3px] rounded-[7px] text-[9px] font-bold tracking-[0.4px] uppercase">✨ Đã tách</span>
                  <span className="block mt-1 text-[11px] text-icp-pink-700 opacity-85">Kiểm tra qty rồi thêm vào giỏ nhé</span>
                </div>
              </div>
            </div>

            {/* Bundle card (.bundle-card) */}
            <div className="flex gap-2">
              <div className="w-9 flex-shrink-0" aria-hidden="true" />
              <div className="flex-1 bg-white rounded-[4px_16px_16px_16px] p-3 border-[0.5px] border-icp-pink-200 shadow-[0_6px_16px_rgba(233,30,99,0.1)]">
                {/* bundle-header */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1.5 text-[12px] font-bold text-icp-pink-700 tracking-[0.6px] uppercase">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                    </svg>
                    Giỏ tạm
                  </div>
                  <span className="bg-gradient-to-br from-icp-pink-500 to-icp-amber-400 text-white px-2.5 py-[3px] rounded-lg text-[10px] font-bold shadow-[0_2px_6px_rgba(233,30,99,0.25)]">
                    {state.matchedProducts.length} món
                  </span>
                </div>

                {/* item-rows */}
                {state.matchedProducts.map((p, i) => {
                  const thumb = THUMB_GRADIENTS[i % THUMB_GRADIENTS.length];
                  const lineTotal = p.price * p.qty;
                  return (
                    <div
                      key={p.product_id}
                      className="flex gap-2.5 py-2.5 items-center [&:not(:first-child)]:border-t-[0.5px] [&:not(:first-child)]:border-icp-pink-100"
                    >
                      {/* item-thumb 52px gradient (cosmetic per index) */}
                      <div
                        className="w-[52px] h-[52px] rounded-xl flex-shrink-0 flex items-center justify-center border border-white shadow-[0_3px_8px_rgba(233,30,99,0.12)]"
                        style={{ background: thumb.wrap }}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-[0_2px_6px_rgba(0,0,0,0.1)]"
                          style={{ background: thumb.icon }}
                        >
                          {/* image_icon từ BE không đáng tin (B1 precedent: imageIcon=undefined)
                              → SVG fallback cố định, KHÔNG bịa icon (Luật #6). */}
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M14 2v6.343c0 .53.21 1.04.586 1.414L18.414 13.586c.375.375.586.884.586 1.414V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5c0-.53.21-1.04.586-1.414L9.414 9.757A2 2 0 0 0 10 8.343V2" />
                            <line x1="9" y1="2" x2="15" y2="2" />
                          </svg>
                        </div>
                      </div>

                      {/* item-info — match-badge "% khớp" + stock "Còn N" ẩn (BE không cấp, §4/§5) */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-semibold text-icp-pink-900 leading-[1.3] mb-[3px] line-clamp-2">
                          {p.title}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] text-icp-pink-700 font-semibold">
                            {p.price.toLocaleString('vi-VN')}₫ ×{' '}
                          </span>
                          <span
                            className="font-mono text-[12px] font-bold bg-gradient-to-br from-icp-amber-400 to-icp-orange-600 bg-clip-text"
                            style={{ WebkitTextFillColor: 'transparent' }}
                          >
                            {lineTotal.toLocaleString('vi-VN')}₫
                          </span>
                        </div>
                      </div>

                      {/* qty-stepper (display-only — state-C qty fixed pre-commit per mockup) */}
                      <div className="flex items-center gap-1.5 bg-gradient-to-br from-icp-pink-50 to-icp-pink-100 border-[0.5px] border-icp-pink-200 rounded-[10px] p-[3px] flex-shrink-0">
                        <span className="w-6 h-6 bg-white rounded-[7px] flex items-center justify-center text-icp-pink-700 shadow-[0_2px_4px_rgba(233,30,99,0.1)] opacity-40">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </span>
                        <span className="font-mono text-[13px] font-bold text-icp-pink-900 min-w-6 text-center">{p.qty}</span>
                        <span className="w-6 h-6 bg-white rounded-[7px] flex items-center justify-center text-icp-pink-700 shadow-[0_2px_4px_rgba(233,30,99,0.1)] opacity-40">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* totals-strip — số thật từ price×qty (KHÔNG bịa) */}
                <div className="bg-gradient-to-br from-icp-pink-100 to-icp-amber-100 border-[0.5px] border-icp-pink-200 rounded-[14px] px-3.5 py-3 mt-2.5 flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-icp-pink-700 tracking-[0.5px] uppercase">Tổng</span>
                    <span className="text-[11px] text-icp-pink-800 font-semibold">
                      {state.matchedProducts.length} sản phẩm · {cartReadyUnits} đơn vị
                    </span>
                  </div>
                  <span
                    className="font-mono text-[20px] font-bold bg-gradient-to-br from-icp-pink-500 to-icp-amber-400 bg-clip-text"
                    style={{ WebkitTextFillColor: 'transparent' }}
                  >
                    {cartReadyTotal.toLocaleString('vi-VN')}₫
                  </span>
                </div>
              </div>
            </div>

            {/* ai-note: co-purchase hint (reuse S-05 component, null-safe C-S08-T) */}
            {state.coPurchaseHint ? (
              <CoPurchaseHintCard
                hint={{
                  ratePct: state.coPurchaseHint.rate_pct,
                  reason: state.coPurchaseHint.reason,
                  suggestedProduct: {
                    brand: String((state.coPurchaseHint.suggested_product as Record<string, unknown>).brand ?? ''),
                    name: String((state.coPurchaseHint.suggested_product as Record<string, unknown>).name ?? ''),
                    price: Number((state.coPurchaseHint.suggested_product as Record<string, unknown>).price ?? 0),
                  },
                  anchorCategory: state.coPurchaseHint.anchor_category,
                  suggestedCategory: state.coPurchaseHint.suggested_category,
                }}
              />
            ) : null}

            {/* bottom-bar: btn-mic 52px + btn-add-cart gradient + badge-count "N món · tổng₫" */}
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={handleStartListening}
                aria-label="Nói lại"
                className="w-[52px] h-[52px] flex-shrink-0 rounded-[14px] bg-white border-[0.5px] border-icp-pink-200 text-icp-pink-700 flex items-center justify-center shadow-[0_4px_12px_rgba(233,30,99,0.15)]"
              >
                <Icon name="mic" size={22} />
              </button>
              <button
                type="button"
                onClick={handleAddToCart}
                className="flex-1 h-[52px] rounded-[14px] bg-gradient-to-r from-icp-pink-500 via-[#F43F5E] to-icp-amber-400 text-white font-bold text-[14px] flex items-center justify-center gap-2 shadow-[0_10px_22px_rgba(233,30,99,0.35)] tracking-[-0.2px]"
              >
                Thêm vào giỏ
                <span className="bg-white/25 px-2.5 py-[3px] rounded-lg text-[11px] backdrop-blur-sm">
                  {state.matchedProducts.length} món · {cartReadyTotal.toLocaleString('vi-VN')}₫
                </span>
              </button>
            </div>
          </div>
        ) : null}

        {/* ═══ state-D: clarifying ═══ */}
        {state.phase === 'clarifying' && state.clarifyOptions ? (
          <div className="flex-1 flex flex-col gap-3 pt-2">
            <div className="text-[12px] font-semibold text-icp-pink-700">
              {state.clarifyOptions.resolved} / {state.clarifyOptions.total} món
            </div>
            <div className="flex gap-2">
              <Avatar role="ai" />
              <ConversationBubble
                role="ai"
                variant="clarify"
                text={<>Aida đã chọn top 3 loại phù hợp nhất. Bạn chọn giúp Aida loại bạn muốn nhé.</>}
              />
            </div>

            {(() => {
              const target = state.clarifyOptions!.ambiguous_items[0];
              if (!target) return null;
              const top3 = target.candidates.slice(0, 3);
              return (
                <div>
                  {top3.map((c, i) => (
                    <ClarifyOptionChip
                      key={c.id ?? i}
                      productId={c.id ?? ''}
                      title={c.title ?? 'Sản phẩm'}
                      brand={c.brand}
                      price={c.price}
                      rating={c.rating}
                      soldCount={c.sold_count}
                      stock={c.stock}
                      matchScore={c.match_score}
                      staggerIndex={i}
                      onTap={handleClarifyPick}
                    />
                  ))}
                  {target.candidates.length > 3 ? (
                    <ClarifyOptionChip
                      variant="overflow"
                      productId="__overflow__"
                      title=""
                      totalCount={target.candidates.length}
                      onTap={() => {}}
                      onTapOverflow={() => {}}
                    />
                  ) : null}
                </div>
              );
            })()}

            {/* bottom-bar: hint (mockup state-D) + escape "Nói món khác"
                (UX gap — mockup khóa clarify không lối thoát; KING OF LAW:
                user không thích cả 3 loại → reset về state-0 mic để nói lại). */}
            <div className="mt-auto flex items-center gap-2.5 pt-3">
              <div className="flex-1 flex items-center justify-center gap-1.5 bg-white border-[0.5px] border-dashed border-icp-pink-200 rounded-[14px] py-3 px-3.5 text-[12px] font-semibold text-icp-pink-700">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 11 12 14 22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                Chọn 1 loại để tiếp tục
              </div>
              <button
                type="button"
                onClick={handleStartListening}
                aria-label="Nói món khác"
                className="flex items-center gap-1.5 rounded-[14px] py-3 px-3.5 bg-gradient-to-r from-icp-pink-50 to-icp-amber-50 border-[0.5px] border-icp-pink-200 text-icp-pink-700 font-semibold text-[12px] active:scale-95 transition-transform"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                </svg>
                Nói món khác
              </button>
            </div>
          </div>
        ) : null}

        {/* ═══ state-E: cart-added ═══ */}
        {state.phase === 'cart-added' ? (
          (() => {
            const addedCount = voiceAddedCount(
              state.cartUpdated as Record<string, unknown> | null,
              state.matchedProducts.length,
            );
            return (
          <div className="flex-1 flex flex-col gap-3 pt-2">
            <div className="flex justify-end">
              <CartCountPill bump deltaLabel={`+${addedCount}`} onClick={() => router.push(tenantHref('/intent/05', tenant?.slug))} />
            </div>

            <div className="flex gap-2">
              <Avatar role="ai" />
              <ConversationBubble
                role="ai"
                variant="success"
                text={
                  <>
                    Đã thêm <strong>{addedCount} món</strong> vào giỏ!
                    {cart?.totals ? (
                      <span className="block mt-1 font-mono text-[13px]">
                        Tổng giỏ: {cart.totals.total.toLocaleString('vi-VN')}₫
                      </span>
                    ) : null}
                  </>
                }
              />
            </div>

            {state.coPurchaseHint ? (
              <CoPurchaseHintCard
                hint={{
                  ratePct: state.coPurchaseHint.rate_pct,
                  reason: state.coPurchaseHint.reason,
                  suggestedProduct: {
                    brand: String((state.coPurchaseHint.suggested_product as Record<string, unknown>).brand ?? ''),
                    name: String((state.coPurchaseHint.suggested_product as Record<string, unknown>).name ?? ''),
                    price: Number((state.coPurchaseHint.suggested_product as Record<string, unknown>).price ?? 0),
                  },
                  anchorCategory: state.coPurchaseHint.anchor_category,
                  suggestedCategory: state.coPurchaseHint.suggested_category,
                }}
              />
            ) : null}

            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-3 rounded-2xl bg-white border-[0.5px] border-icp-pink-200 text-icp-pink-700 font-semibold text-[14px]"
              >
                Mua tiếp
              </button>
              <button
                type="button"
                onClick={() => router.push(tenantHref('/intent/06', tenant?.slug))}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-icp-pink-500 to-icp-amber-400 text-white font-bold text-[14px] shadow-[0_6px_16px_rgba(233,30,99,0.3)]"
              >
                Thanh toán →
              </button>
            </div>
          </div>
            );
          })()
        ) : null}

        {/* ═══ state-removed: cart-removed (bug #4 fix Sx08-I) ═══ */}
        {state.phase === 'cart-removed' ? (
          (() => {
            const removedCount = voiceRemovedCount(
              state.cartUpdated as Record<string, unknown> | null,
            );
            return (
          <div className="flex-1 flex flex-col gap-3 pt-2">
            <div className="flex justify-end">
              <CartCountPill bump deltaLabel={`−${removedCount}`} onClick={() => router.push(tenantHref('/intent/05', tenant?.slug))} />
            </div>

            <div className="flex gap-2">
              <Avatar role="ai" />
              <ConversationBubble
                role="ai"
                text={
                  <>
                    Đã xóa <strong>{removedCount} món</strong> khỏi giỏ.
                    {cart?.totals ? (
                      <span className="block mt-1 font-mono text-[13px]">
                        Tổng giỏ: {cart.totals.total.toLocaleString('vi-VN')}₫
                      </span>
                    ) : null}
                  </>
                }
              />
            </div>

            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-3 rounded-2xl bg-white border-[0.5px] border-icp-pink-200 text-icp-pink-700 font-semibold text-[14px]"
              >
                Mua tiếp
              </button>
              <button
                type="button"
                onClick={() => router.push(tenantHref('/intent/05', tenant?.slug))}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-icp-pink-500 to-icp-amber-400 text-white font-bold text-[14px] shadow-[0_6px_16px_rgba(233,30,99,0.3)]"
              >
                Xem giỏ →
              </button>
            </div>
          </div>
            );
          })()
        ) : null}

        {/* ═══ state-F: no-match ═══ */}
        {state.phase === 'no-match' ? (
          <div className="flex-1 flex flex-col gap-3 pt-2">
            <div className="flex gap-2">
              <Avatar role="ai" />
              <ConversationBubble
                role="ai"
                variant="empty"
                text={
                  state.emptyState?.message ??
                  'Em đoán bạn có thể thích 2 sản phẩm này thay thế (xếp theo độ giống) — chạm để thêm thẳng vào giỏ'
                }
              />
            </div>

            {/* similarityPct NOT passed — §4 KNOWN-ISSUE (not in typed SSE). */}
            {Object.entries(state.stockReplacements).map(([productId, replacement]) =>
              replacement ? (
                <StockReplacementCard
                  key={productId}
                  replacement={{
                    productId: replacement.product_id,
                    title: replacement.title,
                    brand: replacement.brand,
                    unitPrice: replacement.unit_price,
                    availableStock: replacement.available_stock,
                  }}
                  ctaLabel="Thêm vào giỏ"
                  onReplace={() => handleResolveReplace(productId, replacement.product_id)}
                />
              ) : null,
            )}

            <button
              type="button"
              onClick={handleStartListening}
              className="mt-2 py-3 rounded-2xl bg-white border-[0.5px] border-icp-pink-200 text-icp-pink-700 font-semibold text-[14px] flex items-center justify-center gap-1.5"
            >
              <Icon name="mic" size={16} /> Nói lại
            </button>
          </div>
        ) : null}

        {/* ═══ state-G: error ═══ */}
        {state.phase === 'error' ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-[220px] h-[220px] flex items-center justify-center">
              <OrbPulse size="lg" state="error" icon={<Icon name="mic-off" size={56} className="text-white" />} />
            </div>
            <div className="mt-4 text-[11px] font-bold uppercase tracking-[1px] text-icp-rose-600">
              Voice không rõ
            </div>
            {(() => {
              const copy = errorCopy(state.errorCode);
              return (
                <>
                  <h2 className="mt-1 text-[18px] font-bold text-icp-pink-900">{copy.title}</h2>
                  <p className="mt-1 text-[13px] text-icp-pink-700 max-w-xs">{copy.sub}</p>
                </>
              );
            })()}

            <div className="mt-4 w-full max-w-sm bg-white/70 border-[0.5px] border-icp-pink-200 rounded-2xl p-3 text-left">
              {[
                'Nói trong môi trường yên tĩnh',
                'Đưa micro gần miệng 15–20cm',
                'Nói rõ và dài ít nhất 2 giây',
              ].map((tip) => (
                <div key={tip} className="flex items-center gap-2 py-1 text-[12px] text-icp-pink-900">
                  <Icon name="check" size={13} className="text-icp-green-600 flex-shrink-0" />
                  {tip}
                </div>
              ))}
            </div>

            <div className="mt-5 flex gap-3 w-full max-w-sm">
              <button
                type="button"
                onClick={handleStartListening}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-icp-pink-500 to-icp-amber-400 text-white font-bold text-[14px] shadow-[0_6px_16px_rgba(233,30,99,0.3)]"
              >
                Nói lại
              </button>
              <button
                type="button"
                onClick={() => router.push(tenantHref('/intent/03', tenant?.slug))}
                className="flex-1 py-3 rounded-2xl bg-white border-[0.5px] border-icp-pink-200 text-icp-pink-700 font-semibold text-[14px]"
              >
                Gõ tay thay
              </button>
            </div>

            <div className="mt-4 text-[10px] font-mono text-icp-pink-700/70">
              {state.errorCode ?? 'E_UNKNOWN'} · trace:{state.activeUtteranceRid ?? '—'}
            </div>
          </div>
        ) : null}
      </main>

        {/* Bottom nav — precedent /home + intent-01/03/04 (per-page render, không ở layout chung).
            HomeBottomNav: 4-tab decorative, "Trang chính" hardcoded active, click NO-OP (S-03 D-13). */}
        <HomeBottomNav />
      </div>
    </div>
  );
}
