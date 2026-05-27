'use client';

/**
 * apps/web/components/icp/molecules/LowConfidenceWarningBanner.tsx
 *
 * Molecule: <LowConfidenceWarningBanner> — yellow warning banner shown
 * above PrefillForm when any `confidence_per_field` value < 0.7.
 *
 * Slice:    S-07 T02 — Frontend Cluster
 *
 * Source:   `docs/mockups/intent-01/intent-01-state-F-low-confidence.html`
 *           lines 220-275 (per D-29 LAW Mockup filename is LAW) — warning
 *           banner at top with amber color palette + lightbulb icon +
 *           microcopy "Một số trường có độ tin cậy thấp, anh kiểm tra lại nhé."
 *
 * Decisions applied:
 * - **C-S07-L LOCK** (Phiên Sx07-B): `confidence_per_field` has ONLY 4 keys —
 *   `title`, `brand`, `category`, `size`. Threshold 0.7 evaluated externally
 *   by page; this molecule renders the banner if `triggered=true`.
 * - **D-29 LAW**: JSDoc cites mockup filename verbatim
 * - **C-07** navigation-agnostic — `onDismiss` optional callback
 * - **C-15** 'use client' — uses onClick for dismiss
 * - **C-18** Tier 4 Tailwind utility inline
 *
 * **Why a separate molecule (vs inline in page.tsx):**
 * - Reusable: state-F mockup shows this banner; future S-09 reco-confirm
 *   may also render low-confidence flag for cross-domain consistency
 * - Test isolation: Storybook story renders the banner standalone with
 *   varying `lowConfidenceFields` prop
 * - JSDoc citation per Rule 6 — mockup is LAW; banner anchored to mockup
 *
 * Reach: S-07 V-SLICE state-F (PrefillForm low-confidence warning).
 */

import * as React from 'react';
import { Icon } from '@/components/icp/atoms';
import { cn } from '@/lib/utils';

export interface LowConfidenceWarningBannerProps {
  /**
   * Field names (from `confidence_per_field` 4 keys) below 0.7 threshold.
   * Empty array → banner does NOT render (returns null).
   *
   * Example: `['title', 'brand']` — banner shows "2 trường" with field labels.
   */
  lowConfidenceFields: string[];
  /** Optional dismiss callback — show X button if provided. */
  onDismiss?: () => void;
  /** Optional className passthrough. */
  className?: string;
}

/**
 * Map field key → Vietnamese display label (matches PrefillForm labels).
 * Falls back to the key itself if not in the map.
 */
const FIELD_LABEL_VN: Record<string, string> = {
  title: 'Tên sản phẩm',
  brand: 'Nhãn hiệu',
  category: 'Danh mục',
  size: 'Dung tích',
};

export function LowConfidenceWarningBanner({
  lowConfidenceFields,
  onDismiss,
  className,
}: LowConfidenceWarningBannerProps) {
  // Don't render if nothing to warn about
  if (!lowConfidenceFields || lowConfidenceFields.length === 0) {
    return null;
  }

  const labels = lowConfidenceFields.map((k) => FIELD_LABEL_VN[k] ?? k);
  const labelsJoined = labels.join(', ');

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'relative rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50',
        'p-3.5 mb-3',
        'shadow-[0_4px_12px_rgba(245,158,11,0.15)]',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {/* Lightbulb icon in amber circle */}
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-[0_3px_8px_rgba(245,158,11,0.4)]">
          <Icon name="bulb" size={18} className="text-white" />
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-bold uppercase tracking-wider text-amber-900 mb-1">
            Độ tin cậy thấp
          </div>
          <div className="text-[13px] text-amber-900 leading-snug">
            Em nhận diện chưa chắc chắn{' '}
            <span className="font-semibold">{labels.length} trường</span>
            {labels.length > 0 && (
              <>
                {' '}
                (<span className="font-semibold">{labelsJoined}</span>)
              </>
            )}
            . Anh kiểm tra lại nhé.
          </div>
        </div>

        {/* Dismiss X (optional) */}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Đóng cảnh báo"
            className={cn(
              'flex-shrink-0 w-7 h-7 rounded-lg',
              'flex items-center justify-center',
              'text-amber-700 hover:bg-amber-100',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1',
            )}
          >
            <Icon name="x" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
