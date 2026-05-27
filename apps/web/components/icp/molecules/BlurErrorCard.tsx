'use client';

/**
 * apps/web/components/icp/molecules/BlurErrorCard.tsx
 *
 * Molecule: <BlurErrorCard> — state-E error card when vision detects blurry image.
 *
 * Slice:    S-07 T02 — Frontend Cluster
 *
 * Source:   `docs/mockups/intent-01/intent-01-state-E-blur-error.html` lines 220-380
 *           (per D-29 LAW Mockup filename is LAW)
 *
 * Decisions applied:
 * - **C-S07-J** (Phiên Sx07-B Ω₂ resolution MAR-1 #2): 3-threshold blur check
 *   in AI graph node — when triggered, emits SSE error event with `code:
 *   "E_VISION_BLUR"`. This card renders THAT error state.
 * - **C-S07-F** (Phiên Sx07-D option ⓐ): `E_VISION_BLUR` surfaces via SSE
 *   `error` event (not Variant B fallback) — open `code: z.string()` pattern.
 * - **D-29 LAW**: JSDoc cites mockup filename verbatim
 * - **C-07** navigation-agnostic — 2 callback CTAs (retake + manual entry)
 * - **C-15** 'use client' — uses onClick handlers
 *
 * **3 tips shown** (mockup state-E lines 285-330):
 *   1. "Giữ điện thoại cách 20-30cm khỏi sản phẩm"
 *   2. "Đảm bảo ánh sáng đủ và đều"
 *   3. "Lấy nét vào nhãn (tap vào nhãn trên màn hình)"
 *
 * **trace_id surfaced** for ops-team correlation:
 * Mockup shows `trace_id` in mono font small — copy-to-clipboard friendly.
 * Required for E_VISION_BLUR debugging (Grafana Tempo deep-link).
 *
 * Reach: S-07 V-SLICE state-E — single use site at /intent-01 page.
 */

import * as React from 'react';
import { Button, Icon } from '@/components/icp/atoms';
import { cn } from '@/lib/utils';

export interface BlurErrorCardProps {
  /**
   * Optional preview of the blurry image as data URL (rendered with
   * `filter: blur(8px)` overlay for visual emphasis). If absent, shows
   * the lightbulb icon hero.
   */
  imageDataUrl?: string;
  /** OTel trace_id for ops correlation. */
  traceId?: string;
  /**
   * Error code (for E2E correlation + i18n future). T02 hardcodes display
   * but allows override for tests + future codes.
   */
  errorCode?: string;
  /** Fired when user clicks "Chụp lại" — caller resets state machine. */
  onRetake: () => void;
  /** Fired when user clicks "Nhập tay" — caller routes to manual product form. */
  onManualEntry: () => void;
  /** Optional className passthrough. */
  className?: string;
}

const TIPS: ReadonlyArray<{ icon: 'camera' | 'sparkles' | 'target'; text: string }> = [
  { icon: 'camera', text: 'Giữ điện thoại cách 20-30cm khỏi sản phẩm' },
  { icon: 'sparkles', text: 'Đảm bảo ánh sáng đủ và đều' },
  { icon: 'target', text: 'Lấy nét vào nhãn (tap vào nhãn trên màn hình)' },
];

export function BlurErrorCard({
  imageDataUrl,
  traceId,
  errorCode = 'E_VISION_BLUR',
  onRetake,
  onManualEntry,
  className,
}: BlurErrorCardProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'rounded-2xl bg-white shadow-[0_8px_24px_rgba(245,158,11,0.15)]',
        'border-[0.5px] border-amber-200',
        'overflow-hidden mb-4',
        className,
      )}
    >
      {/* Header strip — amber gradient */}
      <div className="bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-3 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-white/25 backdrop-blur-sm flex items-center justify-center">
          <Icon name="bulb" size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-bold uppercase tracking-wider text-white">
            Ảnh chưa đủ rõ
          </div>
          <div className="text-[11px] text-white/90 mt-0.5">
            Em chưa đọc được nhãn sản phẩm
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-4">
        {/* Hero — blurry preview if provided, else lightbulb in circle */}
        <div className="flex items-center justify-center mb-4">
          {imageDataUrl ? (
            <div className="relative w-28 h-28 rounded-2xl overflow-hidden border-[0.5px] border-amber-200">
              <img
                src={imageDataUrl}
                alt="Ảnh sản phẩm (đã làm mờ)"
                className="w-full h-full object-cover"
                style={{ filter: 'blur(8px)' }}
              />
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-transparent" />
            </div>
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center border-[0.5px] border-amber-200">
              <Icon name="image" size={40} className="text-amber-600" />
            </div>
          )}
        </div>

        {/* Tip list */}
        <div className="mb-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-900 mb-2">
            Mẹo chụp ảnh tốt hơn
          </div>
          <ul className="flex flex-col gap-2" role="list">
            {TIPS.map((tip, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center mt-0.5">
                  <span className="text-[10px] font-bold text-amber-700">{i + 1}</span>
                </div>
                <span className="text-[13px] text-icp-pink-900 leading-snug">{tip.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-2.5">
          <Button
            type="button"
            variant="pink-grad"
            size="md"
            leftIcon="camera"
            onClick={onRetake}
            className="w-full"
          >
            Chụp lại
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onManualEntry}
            className="w-full"
          >
            Nhập tay
          </Button>
        </div>

        {/* Error code + trace_id footer */}
        {(errorCode || traceId) && (
          <div className="mt-4 pt-3 border-t-[0.5px] border-amber-100 flex flex-col gap-1">
            {errorCode && (
              <div className="text-[10px] font-mono text-amber-700">
                Code: <span className="font-semibold">{errorCode}</span>
              </div>
            )}
            {traceId && (
              <div className="text-[10px] font-mono text-amber-700/80 break-all">
                Trace: {traceId}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
