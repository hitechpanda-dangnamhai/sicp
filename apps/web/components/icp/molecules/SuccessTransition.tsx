'use client';

/**
 * apps/web/components/icp/molecules/SuccessTransition.tsx
 *
 * Molecule: <SuccessTransition> — state-G success card with HYBRID 2s auto-redirect.
 *
 * Slice:    S-07 T02 — Frontend Cluster
 *
 * Source:   `docs/mockups/intent-01/intent-01-state-G-success.html` lines 320-455
 *           (per D-29 LAW Mockup filename is LAW)
 *
 * Decisions applied:
 * - **D-25 LAW** (S-03): State machine page locus pattern — setTimeout +
 *   clearTimeout cleanup-aware pattern, ADAPTED with `cancelled` state flag
 *   for 3-button programmatic cancel (S-03 LoginSuccessTransition only had
 *   1-path cancel via unmount).
 * - **Q2 HYBRID LOCK** (Phiên Sx07-F): Mockup 3 buttons render verbatim +
 *   2s countdown progress bar + auto-trigger "Về trang chính" if no click +
 *   cancel timer on ANY button click. User confirmed "15/15 phai khong?"
 *   → option 2 (HYBRID) chosen.
 * - **Q2 option 2 LOCK**: BrainCheckBadge tách riêng làm sub-molecule (B3)
 * - **D-29 LAW**: JSDoc cites mockup filename verbatim
 * - **C-15** 'use client' — uses useState + useEffect + useRouter
 *
 * Pattern adapted from `LoginSuccessTransition.tsx` (S-03) — uses
 * `splash-loadProgress` keyframe (globals.css line 568-571) for the 2s
 * progress bar visual.
 *
 * **3 user-click paths** (all cancel the auto-redirect timer):
 *   - "Đóng" X góc top-right         → onClose stub (caller may reset state)
 *   - btn-primary "Nhập sản phẩm tiếp theo" → onImportNext (caller resets state)
 *   - btn-secondary "Về trang chính"  → router.push(autoRedirectTo) immediately
 *
 * **Auto-redirect (if no click in 2s):** router.push('/home') (mockup default).
 *
 * Composition layout (mockup state-G order):
 *   - Top-right X "Đóng"
 *   - BrainCheckBadge XL 140×140 (B3 sub-molecule)
 *   - "SẢN PHẨM ĐÃ ĐƯỢC NHẬP" green eyebrow label
 *   - "Sản phẩm đã có trong cửa hàng của bạn" pink-orange gradient title
 *   - Product name pill
 *   - 3 stat-cells row: TRƯỜNG ĐIỀN / THỜI GIAN / ĐỘ CHÍNH XÁC
 *   - 2 CTAs row: btn-primary + btn-secondary
 *   - 2s progress bar (hidden when cancelled)
 *   - Microcopy "Aida đưa anh về trang chính sau 2s..." (hidden when cancelled)
 *   - success-id footer "ID: prd_8b4f... · 9:41 hôm nay"
 *
 * Reach: S-07 V-SLICE state-G — single use site at /intent-01 page.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Icon } from '@/components/icp/atoms';
import { BrainCheckBadge } from './BrainCheckBadge';
import { cn } from '@/lib/utils';

export interface SuccessTransitionProps {
  /** Product UUID — surfaced in the footer "ID: prd_..." row. */
  productId: string;
  /** Product display name — shown in pp-tag pill below title. */
  productTitle: string;
  /** Fields-filled count for stat-cell (default 12 per mockup). */
  fieldsCount?: number;
  /** Elapsed seconds for stat-cell (default 3.2 per mockup). */
  elapsedSec?: number;
  /** Confidence percent 0-100 for stat-cell. */
  confidencePct: number;
  /** Fired when user clicks "Đóng" X — caller decides next state. */
  onClose: () => void;
  /** Fired when user clicks btn-primary "Nhập sản phẩm tiếp theo" — caller resets state to state-0. */
  onImportNext: () => void;
  /** Auto-redirect delay ms (default 2000). */
  autoRedirectMs?: number;
  /** Auto-redirect target (REQUIRED) — caller (in-slug) truyền qua tenantHref
   *  để carry slug (S-P0-01 T02b-3, KHÔNG hardcode /home trong molecule). */
  autoRedirectTo: string;
  /** Optional className passthrough. */
  className?: string;
}

const DEFAULT_REDIRECT_MS = 2000;

/** Format current time as "9:41 hôm nay" style label. */
function formatNowLabel(): string {
  const now = new Date();
  const hh = now.getHours();
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm} hôm nay`;
}

/** Truncate UUID for display (prd_8b4f...a12 style — mockup line 412). */
function shortenProductId(id: string): string {
  if (!id) return '';
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}...${id.slice(-3)}`;
}

export function SuccessTransition({
  productId,
  productTitle,
  fieldsCount = 12,
  elapsedSec = 3.2,
  confidencePct,
  onClose,
  onImportNext,
  autoRedirectMs = DEFAULT_REDIRECT_MS,
  autoRedirectTo,
  className,
}: SuccessTransitionProps) {
  const router = useRouter();
  const [cancelled, setCancelled] = React.useState(false);
  const nowLabel = React.useMemo(() => formatNowLabel(), []);

  // Cleanup-aware redirect — D-25 LAW adapted with `cancelled` flag.
  // The timer only runs if NOT cancelled. Any click sets cancelled=true,
  // which (a) prevents this effect from setting a new timer on re-render
  // and (b) hides the progress bar + microcopy via the conditional render below.
  React.useEffect(() => {
    if (cancelled) return;
    const t = setTimeout(() => {
      router.push(autoRedirectTo);
    }, autoRedirectMs);
    return () => clearTimeout(t);
  }, [cancelled, router, autoRedirectMs, autoRedirectTo]);

  const handleClose = React.useCallback(() => {
    setCancelled(true);
    onClose();
  }, [onClose]);

  const handleImportNext = React.useCallback(() => {
    setCancelled(true);
    onImportNext();
  }, [onImportNext]);

  const handleGoHome = React.useCallback(() => {
    setCancelled(true);
    router.push(autoRedirectTo);
  }, [router, autoRedirectTo]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'relative rounded-2xl overflow-hidden',
        'bg-gradient-to-br from-pink-50 via-orange-50 to-pink-50',
        'border-[0.5px] border-icp-pink-200',
        'shadow-[0_20px_60px_rgba(233,30,99,0.18)]',
        'px-5 pt-5 pb-6',
        className,
      )}
    >
      {/* Top-right X "Đóng" */}
      <button
        type="button"
        onClick={handleClose}
        aria-label="Đóng"
        className={cn(
          'absolute top-3 right-3 z-10',
          'w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm',
          'flex items-center justify-center',
          'text-icp-pink-700 hover:bg-white hover:text-icp-pink-900',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-icp-pink-500',
          'transition-colors',
          'border-[0.5px] border-icp-pink-200',
        )}
      >
        <Icon name="x" size={16} />
      </button>

      {/* BrainCheckBadge XL — center top */}
      <div
        className="flex justify-center mb-3"
        style={{ animation: 'splash-pop 0.6s ease-out backwards' }}
      >
        <BrainCheckBadge size={140} />
      </div>

      {/* Eyebrow label */}
      <div
        className="text-center mb-2"
        style={{ animation: 'splash-slideUp 0.5s ease-out 0.2s backwards' }}
      >
        <span className="text-[11px] font-bold uppercase tracking-[2px] text-emerald-600">
          ✓ Sản phẩm đã được nhập
        </span>
      </div>

      {/* Title — pink → orange gradient */}
      <div
        className="text-center mb-3"
        style={{ animation: 'splash-slideUp 0.5s ease-out 0.3s backwards' }}
      >
        <h2
          className="text-[20px] font-bold leading-[1.2] tracking-[-0.4px] bg-clip-text text-transparent inline-block"
          style={{
            backgroundImage: 'linear-gradient(135deg, #E91E63, #FB923C)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Sản phẩm đã có trong cửa hàng của bạn
        </h2>
      </div>

      {/* Product name pill */}
      <div
        className="flex justify-center mb-4"
        style={{ animation: 'splash-slideUp 0.5s ease-out 0.4s backwards' }}
      >
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border-[0.5px] border-icp-pink-200 shadow-sm">
          <Icon name="bottle" size={12} className="text-icp-pink-700" />
          <span className="text-[12px] font-semibold text-icp-pink-900 truncate max-w-[220px]">
            {productTitle}
          </span>
        </div>
      </div>

      {/* 3 stat-cells row */}
      <div
        className="grid grid-cols-3 gap-2 mb-4"
        style={{ animation: 'splash-slideUp 0.5s ease-out 0.5s backwards' }}
      >
        <div className="bg-white/80 rounded-xl p-2.5 text-center border-[0.5px] border-icp-pink-100">
          <div className="font-mono text-[18px] font-bold text-icp-pink-900 tabular-nums">
            {fieldsCount}
          </div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-icp-pink-700 mt-0.5">
            Trường điền
          </div>
        </div>
        <div className="bg-white/80 rounded-xl p-2.5 text-center border-[0.5px] border-icp-pink-100">
          <div className="font-mono text-[18px] font-bold text-icp-pink-900 tabular-nums">
            {elapsedSec.toFixed(1)}s
          </div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-icp-pink-700 mt-0.5">
            Thời gian
          </div>
        </div>
        <div className="bg-white/80 rounded-xl p-2.5 text-center border-[0.5px] border-emerald-100">
          <div className="font-mono text-[18px] font-bold text-emerald-700 tabular-nums">
            {Math.round(confidencePct)}%
          </div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 mt-0.5">
            Độ chính xác
          </div>
        </div>
      </div>

      {/* 2 CTAs */}
      <div
        className="flex flex-col gap-2.5 mb-3"
        style={{ animation: 'splash-slideUp 0.5s ease-out 0.6s backwards' }}
      >
        <Button
          type="button"
          variant="pink-grad"
          size="md"
          leftIcon="plus"
          onClick={handleImportNext}
          className="w-full"
        >
          Nhập sản phẩm tiếp theo
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="md"
          leftIcon="home"
          onClick={handleGoHome}
          className="w-full"
        >
          Về trang chính
        </Button>
      </div>

      {/* Progress bar — 2s splash-loadProgress (hidden when cancelled) */}
      {!cancelled && (
        <div
          className="w-full h-1 bg-pink-100 rounded-[2px] overflow-hidden mb-2"
          style={{ animation: 'splash-slideUp 0.5s ease-out 0.7s backwards' }}
          aria-hidden="true"
        >
          <div
            className="w-full h-full rounded-[2px]"
            style={{
              backgroundImage: 'linear-gradient(90deg, #E91E63, #FB923C)',
              transformOrigin: 'left',
              animation: `splash-loadProgress ${autoRedirectMs}ms ease-out forwards`,
            }}
          />
        </div>
      )}

      {/* Microcopy under progress bar (hidden when cancelled) */}
      {!cancelled && (
        <p className="text-center text-[11px] text-icp-pink-700/80 mb-3">
          Aida đưa anh về trang chính sau {Math.round(autoRedirectMs / 1000)}s... hoặc nhấn nút bên trên
        </p>
      )}

      {/* success-id footer */}
      <div className="pt-3 border-t-[0.5px] border-icp-pink-100 text-center">
        <div className="text-[10px] font-mono text-icp-pink-700/80">
          ID: <span className="font-semibold">{shortenProductId(productId)}</span>
          {' · '}
          {nowLabel}
        </div>
      </div>
    </div>
  );
}
