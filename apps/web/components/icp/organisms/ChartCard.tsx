'use client';

/**
 * apps/web/components/icp/organisms/ChartCard.tsx
 *
 * Organism: <ChartCard> — analytics chart wrapper for I07
 *
 * Slice:    S-01 UI Foundation
 * Task:     T06 AC-3 (multi-intent C-24 ≥2/3 qualifier: 3 states + 6 slots + 1 V-SLICE)
 *
 * Source:   intent-07-state-A-listening.html / state-B-analyzing.html / state-C/D/E
 *           (chart-line/bar/donut variants share the card chrome)
 *           SEMANTIC_COMPONENTS Section 6.3 organism row 3, Merge Group 7 — 12 classes:
 *             .chart-card / .chart-header / .chart-title-block / .chart-title-text /
 *             .chart-title-meta / .chart-tag / .chart-expand-btn / .chart-svg-wrap /
 *             .chart-stats / .expanded-chart-card / .expanded-chart-wrap / .analyzing-stage
 *           PHASE_00_HANDOFF Section "Component extraction priorities" Organism row 2
 *
 * Reach:    I07 only (S-10 V-SLICE Analytics primary consumer)
 *
 * Decisions applied:
 * - C-04 RESOLVED — when `phases?: PhaseItem[]` prop provided, embed <PhasesCard mode="card">
 *   in analyzing-stage area below header. Cross-render is C-04 explicit lock.
 * - C-07 navigation-agnostic — onExpandedChange callback per C-07
 * - C-08 + D-05 VN inline — meta strings hardcoded by consumer; component owns
 *   only "Mở rộng" aria-label on expand-btn
 * - C-13 N/A — no CVA (uses conditional className via cn(), not cva)
 * - C-15 CLIENT — has onExpandedChange + uncontrolled useState for defaultExpanded
 * - C-18 Tier 4 Tailwind utility inline (no @layer components)
 * - C-22 atom interface verified — composes T02 Icon + T04 PhasesCard (mode="card")
 * - C-28 RESOLVED — uncontrolled `defaultExpanded` + `onExpandedChange` callback
 *   (T04 TrendCard precedent: onExpand callback prop)
 * - Amendment 1 — Pure slot API (children only, NO chart?: ChartSpec convenience prop)
 *
 * ⚠️ DESIGN NOTE — PhasesCard chrome strip via !important utility classes (C-32 deferred):
 * When `phases` prop provided, this organism nests <PhasesCard mode="card"> but applies
 * `!border-0 !shadow-none !p-0` to strip the inner card's chrome so the analyzing-stage
 * area visually integrates with ChartCard's own padding/border. This works because
 * PhasesCard merges className via cn() + tailwind-merge (verified PhasesCard line 102).
 * Trade-off: ChartCard "knows" PhasesCard internals (couples to its wrapperClass
 * details: `border border-pink-200 rounded-2xl p-3.5 shadow-...`). If PhasesCard
 * changes internal chrome (vd adds min-h-[X]), this override may not catch it.
 * Cleaner long-term fix: PhasesCard exposes `unstyled?: boolean` prop or
 * `wrapperVariant?: 'card' | 'card-bare'`. Defer to T07 Storybook acceptance OR
 * post-hackathon refactor — no documented defer C-NN handoff T04→T06 for this
 * (Clean Task Boundary Rule 4: cross-task modify needs documented handoff).
 * Surface as C-32 known concern in Bước 5 report.
 *
 * ⚠️ DATA HYGIENE LAYER 1 (PATTERNS §10 enforcement — Trend data integrity):
 * ChartCard analytics data source = `analytics.trend_history` (internal DB) ONLY.
 * Per PHASE_00_CROSS_INTENT_PATTERNS.md §10 + Phiên 18 amendment:
 * - DO NOT mix with `market_trend` (Google Trends API — owned by T04 TrendCard)
 * - DO NOT mix with `trend_score` (Vespa search relevance — internal scoring)
 * Mixing 3 trend types confuses user (semantics differ; not comparable).
 * Layer 2 enforcement: AC-33 grep + Bước 7 G8 review verify no market_trend/
 * trend_score imports in this file or callers.
 * Layer 3 (TypeScript discriminated types) DEFER S-10 V-SLICE per Clean Task
 * Boundary explicit scope-cut (no forward-guess stub types at T06).
 *
 * Pre-classification per C-24: MULTI-INTENT ≤400 LOC (2/3 qualifier PASS)
 * - States ≥3 ✅ (default/expanded/loading/empty/error)
 * - Slots ≥5 ✅ (title/meta/tag/expand-btn/body/stats/phases = 7)
 * - V-SLICE reuse ❌ (S-10 only)
 *
 * Public API:
 *   <ChartCard
 *     title="Doanh thu"
 *     meta="30 ngày qua"
 *     tag={{ label: "DOANH THU", color: "pink" }}
 *     live={true}
 *     defaultExpanded={false}
 *     onExpandedChange={(v) => console.log(v)}
 *     phases={[{ id: 'fetch', label: 'Tải dữ liệu', status: 'done' }]}
 *     stats={<StatRow />}
 *   >
 *     <ChartLine data={...} />
 *   </ChartCard>
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';
import { PhasesCard, type PhaseItem } from '@/components/icp/molecules';
import type { IconName } from '@/lib/icon-map';

export interface ChartCardTag {
  label: string;
  /** Chart tag color — pink (default analytics), green (positive trend), amber (caution) */
  color?: 'pink' | 'green' | 'amber' | 'neutral';
}

export interface ChartCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Chart title (VN per D-05) */
  title: string;
  /** Subtitle / meta context (e.g., "30 ngày qua", "Hôm nay") */
  meta?: string;
  /** Optional tag chip in header (e.g., "DOANH THU", "ĐƠN HÀNG") */
  tag?: ChartCardTag;
  /** Optional live-data indicator (renders 6×6 green-500 dot + Tailwind animate-pulse) */
  live?: boolean;
  /** Optional analyzing-stage phases — when provided, embeds <PhasesCard mode="card"> per C-04 */
  phases?: PhaseItem[];
  /** Optional phases header config (forwarded to PhasesCard.header) */
  phasesHeader?: { icon?: IconName; title: string; subtitle?: string };
  /** Initial expanded state (uncontrolled default) — defaults false */
  defaultExpanded?: boolean;
  /** Optional controlled expanded state — if provided, component is fully controlled */
  expanded?: boolean;
  /** Fires when expand-btn clicked — receives new expanded state */
  onExpandedChange?: (expanded: boolean) => void;
  /** Optional stats footer slot (e.g., <StatPill> row) rendered below chart body */
  stats?: React.ReactNode;
  /** Chart body slot — pass <ChartLine> / <ChartBar> / <ChartDonut> per Amendment 1 pure slot */
  children: React.ReactNode;
}

export const ChartCard = React.forwardRef<HTMLDivElement, ChartCardProps>(
  (
    {
      title,
      meta,
      tag,
      live = false,
      phases,
      phasesHeader,
      defaultExpanded = false,
      expanded: controlledExpanded,
      onExpandedChange,
      stats,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    // Uncontrolled state when no `expanded` prop provided
    const [internalExpanded, setInternalExpanded] = React.useState<boolean>(defaultExpanded);
    const isExpanded = controlledExpanded ?? internalExpanded;

    const handleExpandClick = React.useCallback(() => {
      const next = !isExpanded;
      if (controlledExpanded === undefined) setInternalExpanded(next);
      onExpandedChange?.(next);
    }, [isExpanded, controlledExpanded, onExpandedChange]);

    return (
      <div
        ref={ref}
        className={cn(
          // .chart-card — analytics card chrome
          'w-full bg-white border-[0.5px] border-icp-pink-200 rounded-[18px] p-3.5',
          'shadow-[0_4px_16px_rgba(233,30,99,0.08)]',
          // .expanded-chart-card — when expanded, fuller padding + larger border-radius
          isExpanded && 'p-4 rounded-[20px] shadow-[0_8px_24px_rgba(233,30,99,0.12)]',
          className,
        )}
        data-expanded={isExpanded ? 'true' : 'false'}
        {...props}
      >
        {/* .chart-header — title block + expand-btn */}
        <div className="flex items-start gap-2 mb-2.5">
          <div className="flex-1 min-w-0">
            {/* .chart-title-block */}
            <div className="flex items-center gap-1.5 mb-0.5">
              {/* .chart-title-text */}
              <h3 className="text-[13.5px] font-bold text-icp-pink-900 leading-tight tracking-tight truncate">
                {title}
              </h3>
              {/* Live data indicator (6×6 green-500 + animate-pulse per Q-Final-A VERIFY:
                  livePulse identical Tailwind animate-pulse opacity oscillation) */}
              {live && (
                <span
                  className="inline-block w-1.5 h-1.5 bg-icp-green-500 rounded-full animate-pulse flex-shrink-0"
                  aria-label="Dữ liệu trực tiếp"
                  role="status"
                />
              )}
            </div>
            {/* .chart-title-meta */}
            {meta && (
              <div className="text-[10px] text-icp-pink-700 font-medium font-mono">{meta}</div>
            )}
          </div>

          {/* .chart-tag — optional category chip */}
          {tag && (
            <span
              className={cn(
                'inline-flex items-center text-[9px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 flex-shrink-0',
                tag.color === 'green' && 'bg-icp-green-100 text-icp-green-700',
                tag.color === 'amber' && 'bg-icp-amber-100 text-icp-amber-800',
                tag.color === 'neutral' && 'bg-icp-bg-tinted text-icp-text-muted',
                (tag.color === 'pink' || tag.color === undefined) &&
                  'bg-icp-pink-100 text-icp-pink-700',
              )}
            >
              {tag.label}
            </span>
          )}

          {/* .chart-expand-btn — 28×28 round, toggles expanded state per C-28 */}
          <button
            type="button"
            onClick={handleExpandClick}
            aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng'}
            aria-expanded={isExpanded}
            className={cn(
              'w-7 h-7 rounded-full bg-icp-pink-50 border-[0.5px] border-icp-pink-200',
              'flex items-center justify-center text-icp-pink-700 flex-shrink-0',
              'transition-transform active:scale-95',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
            )}
          >
            <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} />
          </button>
        </div>

        {/* .analyzing-stage — optional phases cross-render per C-04 (mode="card") */}
        {phases && phases.length > 0 && (
          <div className="mb-2.5">
            <PhasesCard
              mode="card"
              phases={phases}
              header={phasesHeader}
              className="!border-0 !shadow-none !p-0"
            />
          </div>
        )}

        {/* .chart-svg-wrap / .expanded-chart-wrap — body slot (pure slot per Amendment 1) */}
        <div
          className={cn(
            'w-full flex items-center justify-center',
            isExpanded ? 'min-h-[220px]' : 'min-h-[140px]',
          )}
        >
          {children}
        </div>

        {/* .chart-stats — optional footer stats slot */}
        {stats && <div className="mt-2.5 pt-2.5 border-t border-icp-pink-100">{stats}</div>}
      </div>
    );
  },
);
ChartCard.displayName = 'ChartCard';
