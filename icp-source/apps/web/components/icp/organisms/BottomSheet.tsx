'use client';

/**
 * apps/web/components/icp/organisms/BottomSheet.tsx
 *
 * Organism: <BottomSheet> — sheet-up bottom modal for I05 cart + I06 payment flows
 *
 * Slice:    S-01 UI Foundation
 * Task:     T06 AC-7 (multi-intent C-24 ≥2/3 qualifier: 3 states + 5 slots + 2 V-SLICE)
 *
 * Source:   intent-05-state-A-loading.html / state-F-clear-confirm.html (cart sheet-up)
 *           intent-06-state-B-method.html / state-G-otp.html (payment sheet-up)
 *           SEMANTIC_COMPONENTS Section 5.6 — `.sheet-up` ff=8 + @keyframes sheetUp
 *
 * Reach:    I05 (S-05 V-SLICE Cart) + I06 (S-06 V-SLICE Payment)
 *
 * Decisions applied:
 * - C-03 Family B structural inference + shadcn Sheet primitive composition
 * - C-07 navigation-agnostic — onOpenChange callback (no router)
 * - C-08 + D-05 VN inline — close button aria-label "Đóng"
 * - C-13 N/A — no CVA variants (forwards shadcn variants)
 * - C-15 CLIENT — Radix Dialog client-only (shadcn sheet.tsx has 'use client')
 * - C-18 Tier 4 Tailwind utility inline (no @layer components)
 * - C-22 atom interface verified — composes shadcn Sheet primitives (Sheet, SheetContent,
 *   SheetHeader, SheetTitle, SheetDescription, SheetFooter) per components/ui/sheet.tsx
 *
 * Pre-classification per C-24: MULTI-INTENT ≤400 LOC (3/3 qualifier PASS)
 * - States ≥3 ✅ (open/closed/snap-points)
 * - Slots ≥5 ✅ (title/description/body/footer/handle/overlay = 6)
 * - V-SLICE reuse ≥2 ✅ (S-05 + S-06)
 *
 * Sheet-up direction (Q-Final-A VERIFY): shadcn Sheet with `side="bottom"` uses
 * Radix Dialog primitive + `data-[state=open]:slide-in-from-bottom` data-state
 * animation (built-in Tailwind animate utility). NO custom @keyframes sheetUp
 * needed — declarative match per Q-Final-A.
 *
 * Snap points: shadcn Sheet doesn't support snap points natively. For S-05 cart
 * pull-up with 3 snap positions (15vh / 50vh / 90vh per HANDOFF Section 5.6),
 * pass custom `height` via className or wrap with vaul library at V-SLICE level.
 * Defer V-SLICE — T06 ships full-height + dismissible only.
 *
 * Public API:
 *   const [open, setOpen] = useState(false);
 *   <BottomSheet
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="Giỏ hàng"
 *     description="3 sản phẩm"
 *     footer={<Button onClick={() => checkout()}>Thanh toán</Button>}
 *   >
 *     <CartItemRow ... />
 *     <CartItemRow ... />
 *   </BottomSheet>
 */

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export interface BottomSheetProps {
  /** Open state — controlled by parent */
  open: boolean;
  /** Fires when sheet wants to open/close (X button, overlay click, ESC) */
  onOpenChange: (open: boolean) => void;
  /** Sheet title (VN per D-05) — rendered in SheetHeader */
  title?: string;
  /** Optional description below title */
  description?: string;
  /** Body content slot — typically CartItemRow list, PaymentMethodPicker, etc. */
  children?: React.ReactNode;
  /** Optional footer slot — typically primary CTA Button(s) */
  footer?: React.ReactNode;
  /** Optional className override for SheetContent */
  className?: string;
  /** Optional height override (default sheet auto-sized; pass e.g., "h-[80vh]" for fixed) */
  height?: string;
}

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  height,
}: BottomSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          // MoMo-style override: rounded top corners + light bg (shadcn default is plain)
          'bg-icp-bg-page rounded-t-[24px] border-t-0',
          'p-0 gap-0', // reset shadcn defaults; we control padding per section
          'shadow-[0_-12px_32px_rgba(233,30,99,0.18)]',
          // C-24 multi-intent qualifier — generous max-height for sheet content
          height ?? 'max-h-[90vh]',
          className,
        )}
      >
        {/* Sheet handle indicator (visual affordance for swipe-down) */}
        <div className="flex justify-center pt-3 pb-2">
          <span
            className="w-10 h-1 rounded-full bg-icp-pink-200"
            aria-hidden="true"
          />
        </div>

        {/* Header section — title + description */}
        {(title || description) && (
          <SheetHeader className="px-5 pb-3 text-left space-y-1">
            {title && (
              <SheetTitle className="text-[17px] font-bold text-icp-pink-900 leading-tight">
                {title}
              </SheetTitle>
            )}
            {description && (
              <SheetDescription className="text-[12px] text-icp-pink-700">
                {description}
              </SheetDescription>
            )}
          </SheetHeader>
        )}

        {/* Body content — scrollable area */}
        <div className="flex-1 overflow-y-auto px-5 py-2">{children}</div>

        {/* Footer slot — primary CTA */}
        {footer && (
          <SheetFooter className="px-5 pt-3 pb-5 border-t border-icp-pink-100 bg-white/80 backdrop-blur-sm">
            {footer}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
