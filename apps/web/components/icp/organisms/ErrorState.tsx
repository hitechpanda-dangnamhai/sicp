/**
 * apps/web/components/icp/organisms/ErrorState.tsx
 *
 * Organism: <ErrorState> — error display consolidating 12 error-* classes
 *
 * Slice:    S-01 UI Foundation
 * Task:     T06 AC-10
 *
 * Source:   intent-07-state-J-error.html (analytics error reference — defines
 *           @keyframes errorPulse + @keyframes errorShake in mockup)
 *           intent-03A-state-C-error.html (Family B search error)
 *           intent-08-state-D-network-error.html (Family B network error)
 *           SEMANTIC_COMPONENTS Section 5/Merge Group 6 — 12 error-* classes:
 *             `.error`, `.err-overlay`, `.error-actions`, `.error-code-box`,
 *             `.error-label`, `.error-orb*`, `.error-stage`, `.error-subtitle`,
 *             `.error-tip-item`, `.error-tips`, `.error-tips-title`, `.error-title`
 *
 * Reach:    Multi-V-SLICE — S-03 Auth (login error), S-04 Search (search error),
 *           S-07 Image AI (vision error), S-10 Analytics (data error)
 *
 * Decisions applied:
 * - C-07 navigation-agnostic — actions slot accepts ReactNode
 * - C-08 + D-05 VN inline — all text content provided by consumer
 * - C-13 N/A — no CVA variants (slot-driven per C-27)
 * - C-15 SERVER — slot-driven render per same pattern as EmptyState
 *   (corrected from earlier CLIENT mistake per anh adjustment turn 5 — slot
 *   pattern parent attaches handlers via actions slot prop)
 * - C-18 Tier 4 Tailwind utility inline + animate-error-pulse + animate-shake
 *   (Tier 3 exception keyframe registered in T06 tailwind.config.ts patch)
 * - C-22 atom interface verified — typically composes T02 OrbPulse for errorOrb
 *   slot OR T02 Icon for simpler error icon
 * - C-27 RESOLVED — slot-driven NO variants
 * - Q-Final-A — uses NEW `animate-error-pulse` (T06 keyframe errorPulse scale+opacity)
 *   for ErrorOrb halo + REUSE T01 `animate-shake` (1px diff acceptable per BRIEF R-4)
 *
 * Pre-classification per C-24: SINGLE-INTENT ≤300 LOC (2/3 borderline qualifier:
 * V-SLICE reuse ≥2 ✅ + slots = 5 borderline ✅; states = 1 ❌ — stay single-intent
 * ceiling per Task Pack pre-classification)
 *
 * Public API:
 *   <ErrorState
 *     errorOrb={<OrbPulse state="error" size="md" />}
 *     errorCode="NETWORK_TIMEOUT"
 *     title="Mất kết nối mạng"
 *     subtitle="Em không thể kết nối tới máy chủ"
 *     tips={[
 *       { icon: <Icon name="wifi-off" size={14} />, text: "Kiểm tra wifi/4G" },
 *       { icon: <Icon name="refresh" size={14} />, text: "Thử lại sau vài giây" },
 *     ]}
 *     actions={<Button onClick={onRetry}>Thử lại</Button>}
 *     shake={true}
 *   />
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ErrorStateTip {
  /** Optional leading icon — typically <Icon name="..." size={14} /> */
  icon?: React.ReactNode;
  /** Tip text (VN per D-05) */
  text: string;
}

export interface ErrorStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Error orb slot — typically <OrbPulse state="error" /> or custom illustration.
   *  Animated with `animate-error-pulse` halo when shake=false (default). */
  errorOrb?: React.ReactNode;
  /** Optional error code badge (e.g., "NETWORK_TIMEOUT", "AUTH_401"). Rendered
   *  as small mono-font box for debugging context. */
  errorCode?: string;
  /** Primary error headline (VN per D-05) */
  title: string;
  /** Secondary supporting text */
  subtitle?: string;
  /** Optional tips list — diagnostic hints for user */
  tips?: ErrorStateTip[];
  /** Actions slot — typically retry/back/contact-support Buttons */
  actions?: React.ReactNode;
  /** Apply shake animation to the orb wrapper (one-shot when state changes;
   *  default false). When true, uses T01 baseline `animate-shake` (3-4px diff
   *  sub-perceptual per Q-Final-A VERIFY BRIEF R-4 visual-equivalent). */
  shake?: boolean;
  /** Layout density variant — 'centered' (default full-stage) or 'compact' (inline) */
  density?: 'compact' | 'centered';
}

export const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  (
    { errorOrb, errorCode, title, subtitle, tips, actions, shake = false, density = 'centered', className, ...props },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          // .error / .error-stage base
          'w-full flex flex-col items-center text-center',
          density === 'centered' && 'py-10 px-6 gap-4',
          density === 'compact' && 'py-5 px-4 gap-2',
          className,
        )}
        role="alert"
        aria-live="assertive"
        {...props}
      >
        {/* .error-orb wrapper — applies animate-error-pulse halo or shake one-shot */}
        {errorOrb && (
          <div
            className={cn(
              'flex items-center justify-center flex-shrink-0',
              // animate-error-pulse = T06 NEW keyframe errorPulse (scale + opacity)
              // Halo applied as wrapper class so the OrbPulse slot child stays pure
              !shake && 'animate-error-pulse',
              // animate-shake = T01 baseline (3-4px translateX, 400ms one-shot)
              shake && 'animate-shake',
            )}
          >
            {errorOrb}
          </div>
        )}

        {/* .error-code-box — optional debug context */}
        {errorCode && (
          <div className="inline-flex items-center text-[10px] font-bold font-mono uppercase tracking-wider px-2 py-1 rounded-md bg-icp-rose-50 text-icp-rose-700 border-[0.5px] border-icp-rose-200">
            {errorCode}
          </div>
        )}

        {/* .error-title + .error-subtitle */}
        <div className={cn('flex flex-col gap-1', density === 'compact' && 'gap-0.5')}>
          <h3
            className={cn(
              'font-bold text-icp-rose-700 tracking-tight',
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

        {/* .error-tips — diagnostic hints list */}
        {tips && tips.length > 0 && (
          <ul
            className={cn(
              'flex flex-col gap-1.5 w-full max-w-[280px] text-left bg-icp-pink-50 rounded-xl px-3 py-2.5 border-[0.5px] border-icp-pink-200',
              density === 'compact' && 'gap-1 px-2.5 py-2',
            )}
            aria-label="Gợi ý"
          >
            {tips.map((tip, i) => (
              <li
                key={i}
                className={cn(
                  'flex items-start gap-2 text-icp-pink-900 font-medium',
                  density === 'centered' && 'text-[11.5px]',
                  density === 'compact' && 'text-[10.5px]',
                )}
              >
                {tip.icon && <span className="flex-shrink-0 mt-px text-icp-pink-700">{tip.icon}</span>}
                <span className="flex-1">{tip.text}</span>
              </li>
            ))}
          </ul>
        )}

        {/* .error-actions — slot for retry/back CTAs */}
        {actions && (
          <div
            className={cn(
              'flex flex-col gap-2 items-stretch w-full',
              density === 'centered' && 'max-w-[260px] mt-1',
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
ErrorState.displayName = 'ErrorState';
