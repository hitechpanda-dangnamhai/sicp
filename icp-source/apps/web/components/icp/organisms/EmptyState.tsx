/**
 * apps/web/components/icp/organisms/EmptyState.tsx
 *
 * Organism: <EmptyState> — empty content placeholder consolidating 12 empty-* classes
 *
 * Slice:    S-01 UI Foundation
 * Task:     T06 AC-9
 *
 * Source:   intent-03A-state-B-empty.html (Family B empty search reference)
 *           intent-07-state-F-empty-no-data.html (Family A empty analytics reference)
 *           intent-04-state-B-empty.html (empty recommendation reference)
 *           SEMANTIC_COMPONENTS Section 5/Merge Group 5 — 12 empty-* classes:
 *             `.empty`, `.empty-bubble`, `.empty-header`, `.empty-icon`,
 *             `.empty-illu`, `.empty-title`, `.empty-subtitle`, `.empty-sub`,
 *             `.empty-quote`, `.empty-stage`, `.empty-action-btn`, `.empty-actions`
 *           (SEMANTIC line 160 label "(10)" patched to "(12)" via Layer 1 typo fix)
 *
 * Reach:    Multi-V-SLICE — S-04 Search (empty results), S-05 Cart (empty cart),
 *           S-07 Image AI (no products), S-10 Analytics (no data)
 *
 * Decisions applied:
 * - C-07 navigation-agnostic — actions slot accepts ReactNode (parent attaches handlers)
 * - C-08 + D-05 VN inline — all text content provided by consumer
 * - C-13 N/A — no CVA variants (slot-driven per C-27 resolution)
 * - C-15 SERVER — slot-driven render; consumer-attached event handlers bubble up
 *   via prop drilling (similar T03 BottomBar pattern: SERVER shell + CLIENT children)
 * - C-18 Tier 4 Tailwind utility inline
 * - C-22 atom interface verified — composes T02 Icon optionally (icon slot accepts
 *   <Icon> or any ReactNode for flexibility per slot-driven design)
 * - C-27 RESOLVED — slot-driven NO variants (PaymentMethodPicker T05 ST-4 precedent;
 *   12-class consolidation via slots Icon/Title/Subtitle/Quote/Actions)
 * - Amendment 2 — actions slot OPEN (no hard cap on CTAs); JSDoc note 1-3 typical
 *
 * Pre-classification per C-24: SINGLE-INTENT ≤300 LOC (slot-pattern keeps lean)
 *
 * Public API:
 *   <EmptyState
 *     icon={<Icon name="search" size={48} className="text-icp-pink-300" />}
 *     title="Chưa có sản phẩm nào"
 *     subtitle="Em chưa tìm thấy gì khớp với tìm kiếm này"
 *     quote="\"Thử dùng từ khoá khác hoặc bỏ bớt bộ lọc.\""
 *     actions={
 *       <>
 *         <Button variant="pink-grad" onClick={onRetry}>Tìm lại</Button>
 *         <Button variant="ghost" onClick={onClear}>Xoá bộ lọc</Button>
 *       </>
 *     }
 *   />
 *
 * Per PHASE_00_HANDOFF Section "Component extraction priorities" guidance:
 * typically 1-3 CTAs, but `actions` slot accepts any ReactNode. Consumer
 * responsible for cognitive load (Amendment 2 turn 5).
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Icon slot — typically <Icon name="..." size={48} /> or custom illustration */
  icon?: React.ReactNode;
  /** Primary headline (VN per D-05) */
  title: string;
  /** Secondary supporting text */
  subtitle?: string;
  /** Optional italic quote slot (I07 .empty-quote pattern — friendly tone) */
  quote?: string;
  /** Actions slot — open ReactNode per Amendment 2 (typically 1-3 Button CTAs;
   *  consumer attaches onClick handlers). No runtime cap. */
  actions?: React.ReactNode;
  /** Optional layout density variant — 'compact' for inline empty states,
   *  'centered' (default) for full-stage empty pages */
  density?: 'compact' | 'centered';
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, subtitle, quote, actions, density = 'centered', className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // .empty / .empty-stage base
          'w-full flex flex-col items-center text-center',
          density === 'centered' && 'py-12 px-6 gap-4',
          density === 'compact' && 'py-6 px-4 gap-2',
          className,
        )}
        role="status"
        aria-live="polite"
        {...props}
      >
        {/* .empty-icon / .empty-illu — icon or illustration slot */}
        {icon && (
          <div
            className={cn(
              'flex items-center justify-center flex-shrink-0',
              density === 'centered' && 'w-20 h-20 rounded-full bg-icp-pink-50',
              density === 'compact' && 'w-12 h-12 rounded-full bg-icp-pink-50',
            )}
          >
            {icon}
          </div>
        )}

        {/* .empty-header — title + subtitle stack */}
        <div className={cn('flex flex-col gap-1', density === 'compact' && 'gap-0.5')}>
          <h3
            className={cn(
              'font-bold text-icp-pink-900 tracking-tight',
              density === 'centered' && 'text-[16px] leading-tight',
              density === 'compact' && 'text-[14px] leading-tight',
            )}
          >
            {title}
          </h3>
          {subtitle && (
            <p
              className={cn(
                'text-icp-pink-700 font-medium',
                density === 'centered' && 'text-[12.5px] leading-relaxed',
                density === 'compact' && 'text-[11px] leading-snug',
              )}
            >
              {subtitle}
            </p>
          )}
        </div>

        {/* .empty-quote — optional italic friendly tone slot (I07 pattern) */}
        {quote && (
          <p
            className={cn(
              'italic text-icp-text-muted max-w-xs',
              density === 'centered' && 'text-[12px]',
              density === 'compact' && 'text-[10.5px]',
            )}
          >
            {quote}
          </p>
        )}

        {/* .empty-actions — slot for 1-3 CTAs (Amendment 2 open slot) */}
        {actions && (
          <div
            className={cn(
              'flex flex-col gap-2 items-stretch w-full',
              density === 'centered' && 'max-w-[260px] mt-2',
              density === 'compact' && 'max-w-[200px]',
            )}
          >
            {actions}
          </div>
        )}
      </div>
    );
  },
);
EmptyState.displayName = 'EmptyState';
