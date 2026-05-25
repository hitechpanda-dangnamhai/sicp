'use client';

/**
 * apps/web/components/icp/molecules/PromoSuccessBanner.tsx
 *
 * Molecule: <PromoSuccessBanner> — state-G "ÁP MÃ THÀNH CÔNG" celebration banner
 *
 * Slice:    S-05 First Cart/Order Flow
 * Task:     T03 FE Page Wire (Phiên Sx05-3) — NEW V-SLICE feature molecule
 *
 * Source:   docs/mockups/intent-05/intent-05-state-G-promo-applied.html line 136-163 verbatim
 *           (confetti SVG shapes + 42×42 check icon avatar + "ÁP MÃ THÀNH CÔNG" header +
 *            "Tiết kiệm Xđ" gradient amount + promo label)
 *
 * Reach:    I05 cart page state-G transient banner (auto-dismiss optional via parent timer).
 *
 * Decisions applied:
 * - **D-S05-08 LAW**: canvas-confetti dynamic import per R-S05-6 SSR mitigation.
 *   Effect runs on mount only — fires confetti burst once. canvas-confetti is in
 *   apps/web/package.json deps `^1.9.3` (verified Sx05-3-DISCOVER line 27).
 * - **R-S05-6 mitigation**: dynamic import (NOT top-level) so SSR build doesn't
 *   crash when canvas API unavailable in Node.js. Try/catch swallows runtime errors
 *   on browsers without canvas support (graceful degrade — banner still renders).
 * - **C-S05-J Path A**: formatVNDCompact for discount amount mockup parity.
 * - **C-15 'use client'**: useEffect for confetti firing + dynamic import.
 * - **C-23 atom bypass**: confetti decorative SVG shapes inline (mockup line 138-146
 *   3 colored shapes as fallback when canvas-confetti blocked or unavailable).
 *
 * Auto-dismiss: NOT internal — parent owns timer (similar to AddToCartConfirmCard
 * pattern but parent controls dismiss UX flow). Parent sets `promoJustApplied: null`
 * after banner fade or user dismiss.
 */

import * as React from 'react';
import { cn, formatVNDCompact } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';

export interface PromoSuccessBannerProps {
  promoCode: string;
  discountAmount: number;
  /** "SALE15 giảm 15% toàn giỏ" — mockup line 161 BE-templated string. */
  discountLabel: string;
  className?: string;
}

export function PromoSuccessBanner({
  promoCode,
  discountAmount,
  discountLabel,
  className,
}: PromoSuccessBannerProps) {
  // D-S05-08 LAW + R-S05-6: dynamic import canvas-confetti.
  // Effect runs once on mount; StrictMode dev double-mount → double-burst is
  // acceptable visual artifact (NOT a functional bug — confetti is decorative).
  React.useEffect(() => {
    let cancelled = false;
    void import('canvas-confetti')
      .then((mod) => {
        if (cancelled) return;
        try {
          mod.default({
            particleCount: 50,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#E91E63', '#F43F5E', '#FB923C', '#10B981'],
          });
        } catch {
          // Swallow runtime errors (e.g. canvas API blocked) — banner still renders.
        }
      })
      .catch(() => {
        // Swallow dynamic import errors (offline / chunk-load fail).
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'relative overflow-hidden bg-gradient-to-br from-white to-icp-pink-50',
        'border-[0.5px] border-icp-pink-200 rounded-2xl px-3.5 py-3.5',
        'shadow-[0_8px_24px_rgba(233,30,99,0.15)]',
        className
      )}
    >
      {/* Decorative confetti shapes SVG fallback per mockup line 138-146 */}
      <svg
        aria-hidden="true"
        className="absolute top-0 right-2 w-16 h-16 opacity-60 pointer-events-none"
        viewBox="0 0 64 64"
      >
        <circle cx="14" cy="10" r="3" fill="#E91E63" />
        <rect x="30" y="6" width="6" height="6" fill="#FB923C" rx="1" />
        <path d="M 50 14 L 54 18 L 50 22 L 46 18 Z" fill="#10B981" />
        <circle cx="56" cy="32" r="2.5" fill="#F43F5E" />
        <rect x="8" y="36" width="4" height="4" fill="#10B981" rx="1" />
      </svg>

      <div className="relative flex items-center gap-2.5">
        {/* 42×42 check icon avatar */}
        <div className="w-[42px] h-[42px] bg-gradient-to-br from-icp-green-500 to-icp-green-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-[0_4px_12px_rgba(16,185,129,0.4)]">
          <Icon name="check" size={22} strokeWidth={2.5} className="text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-icp-green-600 font-bold uppercase tracking-[1px] mb-0.5">
            Áp mã thành công
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[11px] text-icp-pink-700 font-medium">Tiết kiệm</span>
            <span
              className="text-[18px] font-bold font-mono leading-none bg-gradient-to-br from-icp-pink-600 to-icp-amber-500 bg-clip-text text-transparent"
              style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              {formatVNDCompact(discountAmount)}
            </span>
          </div>
          <div className="text-[10px] text-icp-pink-700 leading-[1.4] mt-0.5">
            Mã <b className="font-mono text-icp-pink-900">{promoCode}</b> {discountLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
PromoSuccessBanner.displayName = 'PromoSuccessBanner';
