/**
 * apps/web/components/icp/layout/BottomBar.tsx
 *
 * Slice:    S-01 UI Foundation
 * Task:     T03 Layout Primitives
 *
 * Status:   NEW.
 *
 * Purpose:  Fixed bottom action bar for both Family A and Family B intents.
 *           Wraps T01 `.bottom-bar` class which implements Bug 1 fix per
 *           ADR-01-11: position: absolute + solid bg + z-index 10 + box-shadow
 *           soft (replaces gradient transparent anti-pattern).
 *
 *           Used to host primary CTA(s): "Lưu sản phẩm" (I01), "Thanh toán"
 *           (I05/I06), "Hoàn tất" (I07), etc.
 *
 * CSS strategy (per C-18 Tier 1 LAW):
 *   Wraps T01 `.bottom-bar` class (baked @layer base in globals.css). Bug 1 fix
 *   LAW: NEVER redefine position/bg/z-index/box-shadow inline.
 *
 * Decisions applied:
 *   - C-15         — Server Component (no event handlers in shell itself;
 *                    interactive button children are Client per T02 C-15 lock —
 *                    bubbles up correctly)
 *   - C-18 Tier 1   — wraps T01 class, NOT redefine
 *
 * Public API:
 *   <BottomBar className?>
 *     <Button>Lưu sản phẩm</Button>
 *     <Button variant="ghost">Thoát</Button>
 *   </BottomBar>
 */

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface BottomBarProps {
  /** Optional consumer override for additional Tailwind classes. */
  className?: string;

  children: ReactNode;
}

export function BottomBar({ className, children }: BottomBarProps) {
  return (
    <div className={cn('bottom-bar', className)}>
      {children}
    </div>
  );
}
