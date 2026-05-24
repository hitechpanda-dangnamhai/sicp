'use client';

/**
 * apps/web/components/icp/molecules/FollowupFilterChips.tsx
 *
 * Molecule: <FollowupFilterChips> — Variant A AI followup hint with 3 quick-filter chips (functional)
 *
 * Slice:    S-04 First Product Discovery
 * Task:     T04 NEW V-SLICE feature molecule (Phiên Sx04-9a per C-S04-I PHASE_02 §E EXCEPTION)
 *
 * Source:   docs/mockups/intent-03/intent-03A-state-0-happy.html lines 297-315
 *           Variant A `mode=basic_fallback` post-results AI followup hint with 3 quick-filter chips.
 *
 * Reach:    S-04 Variant A only (mode=basic_fallback). Functional re-search trigger per D-S04-08 LAW.
 *
 * Decisions applied:
 * - D-S04-08 LAW: Variant A AI followup chips are FUNCTIONAL (NOT decorative).
 *   Tap → mutates query state with hardcoded filter overlay → re-triggers search via use-search-stream.
 *   Emits `search.followup_filter_tapped` behavior event with chip identifier (T06 wires).
 * - D-S04-03 LAW: render only when mode === 'basic_fallback' (Variant A scope — page-level conditional).
 * - C-15 'use client' for onTap event handler
 * - Reuses S-01 ChipPill atom (variant='filter', color='pink', interactive, leftIcon optional)
 *
 * 3 default filter chips (page-level default, consumer-controlled):
 *   [0] price_max     → { filter: { price_max: 20000 }, label: "Dưới 20.000₫", icon: 'discount' }
 *   [1] badge=HOT     → { filter: { badge: 'HOT' },     label: "Chỉ HOT" }
 *   [2] exclude_brand → { filter: { exclude_brands: [...] }, label: "So sánh thương hiệu khác" }
 *
 * Note: Mockup line 307-309 shows ONLY chip 1 has leftIcon (discount). Chips 2+3 have no icon.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChipPill } from '@/components/icp/atoms';
import type { IconName } from '@/lib/icon-map';

/**
 * Filter payload shapes per D-S04-08 LAW.
 * Type union covers the 3 chip types; consumer page can extend or override.
 */
export type FilterPayload =
  | { price_max: number }
  | { badge: 'HOT' }
  | { exclude_brands: string[] }
  | Record<string, unknown>; // escape hatch for future filter types

export interface FilterChipSpec {
  /** Chip text label (VN hardcode per C-08). E.g. "Dưới 20.000₫" */
  label: string;
  /** Filter payload merged into query state on tap */
  filter: FilterPayload;
  /** Optional left icon. Mockup shows only chip 1 ("Dưới 20.000₫") has 'discount' icon. */
  icon?: IconName;
}

export interface FollowupFilterChipsProps {
  /** Filter chip specs. Typical 3 items per D-S04-08 LAW. */
  chips: FilterChipSpec[];
  /** Tap handler. Fires with filter payload + label for behavior tracking. */
  onTap: (filter: FilterPayload, label: string) => void;
  /** Optional className override. */
  className?: string;
}

export const FollowupFilterChips: React.FC<FollowupFilterChipsProps> = ({
  chips,
  onTap,
  className,
}) => {
  return (
    <div
      className={cn('flex flex-wrap gap-1.5', className)}
      role="group"
      aria-label="Bộ lọc gợi ý"
    >
      {chips.map((chip, idx) => (
        <ChipPill
          key={`${idx}-${chip.label}`}
          variant="filter"
          color="pink"
          size="md"
          interactive
          leftIcon={chip.icon}
          onClick={() => onTap(chip.filter, chip.label)}
        >
          {chip.label}
        </ChipPill>
      ))}
    </div>
  );
};
FollowupFilterChips.displayName = 'FollowupFilterChips';
