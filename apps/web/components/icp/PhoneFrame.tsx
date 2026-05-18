/**
 * PhoneFrame — Mobile-first wrapper, viewport 390px iPhone 13 target.
 * Per ADR-022 (phone frame wrapper for desktop) + 00_CONTEXT.md Section 9
 * (Design system: mobile-first 390px, light pastel, one-screen all-in-one).
 *
 * Desktop: centered 390px frame với surrounding background.
 * Mobile (< 480px): full-width tự nhiên (max-w-[390px] vẫn fit nhỏ).
 *
 * **Status:** Minimal scaffold (S-00b T08). Full styling + animations + frame
 * notch/dynamic-island visual treatment defer S-01 H-UI component library.
 *
 * S-01 H-UI sẽ thay scaffold này bằng full PhoneFrame component có:
 * - Status bar mock (time, signal, battery)
 * - Notch / Dynamic Island visual
 * - Safe-area insets
 * - Optional bottom tab bar wrapper
 * - Framer Motion entry/exit animations (per ADR-034)
 */
'use client';

import { ReactNode } from 'react';

export interface PhoneFrameProps {
  children: ReactNode;
}

export function PhoneFrame({ children }: PhoneFrameProps) {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--bg-page-frame)' }}
    >
      <div
        className="w-full max-w-[390px] min-h-[640px] shadow-xl rounded-3xl overflow-hidden"
        style={{ background: 'var(--bg-surface)' }}
      >
        {children}
      </div>
    </div>
  );
}
