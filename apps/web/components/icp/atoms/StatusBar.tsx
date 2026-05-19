/**
 * apps/web/components/icp/atoms/StatusBar.tsx
 *
 * Atom: <StatusBar> — phone status bar mock
 *
 * Slice:    S-01 UI Foundation
 * Task:     T02 AC-1
 *
 * Source:   .status-bar Family A class (intent-01/02/07/08)
 *           Visual contract: intent-02-state-0-mic-idle.html L67-77 (status-bar)
 *                            intent-08-state-0-splash.html L42-65 (inline status)
 *
 * Reach:    All Family A intents (I01/I02/I07) + I08 splash
 *
 * Decisions applied:
 * - C-07 navigation-agnostic — purely visual mock, no interaction
 * - D-04 hybrid animation — none, static render
 *
 * Implementation: Renders iPhone-style top bar: time left, signal/wifi/battery
 * SVGs right. Pure presentational. clampPct() used to clamp battery 0-100.
 */

import * as React from 'react';
import { cn, clampPct } from '@/lib/utils';

export interface StatusBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Displayed time string, default "9:41" (iPhone marketing time) */
  time?: string;
  /** Battery percentage 0-100, default 75 */
  batteryPct?: number;
}

export const StatusBar = React.forwardRef<HTMLDivElement, StatusBarProps>(
  ({ time = '9:41', batteryPct = 75, className, ...props }, ref) => {
    const clamped = clampPct(batteryPct);

    return (
      <div
        ref={ref}
        className={cn(
          'flex h-11 items-center justify-between px-5 flex-shrink-0',
          'text-icp-text-primary font-semibold text-sm font-mono',
          className
        )}
        role="presentation"
        aria-hidden="true"
        {...props}
      >
        <span>{time}</span>
        <div className="flex items-center gap-1.5">
          {/* Signal bars */}
          <svg width="18" height="11" viewBox="0 0 18 11" fill="none" aria-hidden>
            <rect x="0" y="6" width="3" height="5" rx="1" fill="currentColor" />
            <rect x="5" y="4" width="3" height="7" rx="1" fill="currentColor" />
            <rect x="10" y="2" width="3" height="9" rx="1" fill="currentColor" />
            <rect x="15" y="0" width="3" height="11" rx="1" fill="currentColor" />
          </svg>
          {/* Wifi (simplified) */}
          <svg width="15" height="11" viewBox="0 0 15 11" fill="none" aria-hidden>
            <path
              d="M7.5 10.5C8.05 10.5 8.5 10.05 8.5 9.5C8.5 8.95 8.05 8.5 7.5 8.5C6.95 8.5 6.5 8.95 6.5 9.5C6.5 10.05 6.95 10.5 7.5 10.5ZM4 6.5L5 7.5C6.4 6.1 8.6 6.1 10 7.5L11 6.5C9 4.5 6 4.5 4 6.5ZM1 3.5L2 4.5C5.05 1.45 9.95 1.45 13 4.5L14 3.5C10.4 -0.1 4.6 -0.1 1 3.5Z"
              fill="currentColor"
            />
          </svg>
          {/* Battery container */}
          <div className="relative h-[11px] w-6 rounded-[3px] border border-current p-px">
            <div
              className="h-full rounded-[1px] bg-current transition-all"
              style={{ width: `${clamped}%` }}
              aria-label={`Battery ${clamped}%`}
            />
            <div className="absolute -right-[3px] top-[3px] h-[5px] w-[2px] rounded-r-sm bg-current" />
          </div>
        </div>
      </div>
    );
  }
);
StatusBar.displayName = 'StatusBar';
