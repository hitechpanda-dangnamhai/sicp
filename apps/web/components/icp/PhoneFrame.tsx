/**
 * apps/web/components/icp/PhoneFrame.tsx
 *
 * Slice:    S-01 UI Foundation
 * Task:     T03 Layout Primitives
 *           REWRITE replacing S-00b T08 placeholder per C-17.
 *
 * Status:   Full implementation. Resolves C-01 (2 modes) + C-02 (Bug 2 universal).
 *
 * Purpose:  Phone frame wrapper for 2 layout families:
 *   - mode="chat" — Family A (I01, I02, I07) — internal scroll via <MainScroll>
 *                   children, .bottom-bar absolute pinned, .top-bar/.app-header
 *                   flex-shrink-0 top. Base .phone-frame T01 LAW: overflow: hidden.
 *   - mode="app"  — Family B (I03, I04, I05, I06, I08) — page-level scroll within
 *                   frame (overrides .phone-frame overflow: hidden via Tailwind
 *                   utility). Hosts page content directly.
 *
 * CSS strategy (per C-18 Tier 1 LAW):
 *   Wraps T01 `.phone-frame` class (baked @layer base in globals.css). Width 414px
 *   max + height 844px + max-height: calc(100vh - 48px) Bug 2 fix UNIVERSAL both
 *   modes per C-02. NEVER redefine inline styles for these properties.
 *
 * Decisions applied:
 *   - C-01 RESOLVED — `mode` required prop, no default (every consumer explicit)
 *   - C-02 RESOLVED — Bug 2 fix universal via T01 .phone-frame base
 *   - C-07         — navigation-agnostic (no useRouter, no next/link)
 *   - C-15         — Client Component (dynamic className via cn() + may host event
 *                    handlers in future extensions; defensive)
 *   - C-17 RESOLVED — REWRITE replaces S-00b T08 placeholder (violated 5 specs)
 *   - C-18 Tier 1   — wraps T01 class, does NOT redefine
 *
 * Public API:
 *   <PhoneFrame mode="chat" | "app" className?>
 *     children
 *   </PhoneFrame>
 */
'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PhoneFrameProps {
  /**
   * Layout mode (required, no default — every consumer must specify per C-01).
   * - "chat" — Family A (I01/I02/I07): internal scroll via MainScroll child.
   * - "app"  — Family B (I03/I04/I05/I06/I08): page-level scroll within frame.
   */
  mode: 'chat' | 'app';

  /** Optional consumer override for additional Tailwind classes. */
  className?: string;

  children: ReactNode;
}

export function PhoneFrame({ mode, className, children }: PhoneFrameProps) {
  return (
    <div
      className={cn(
        // Tier 1 LAW base — width 414, height 844 + max-height clamp (Bug 2 fix universal)
        'phone-frame',
        // Tier 4 mode modifier — mode="app" overrides .phone-frame { overflow: hidden }
        // for page-level scroll. Tailwind utility @layer utilities has higher cascade
        // specificity than @layer base, so this override works without inline style.
        mode === 'app' && 'overflow-y-auto',
        className,
      )}
      data-mode={mode}
    >
      {children}
    </div>
  );
}
