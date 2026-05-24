'use client';

/**
 * apps/web/src/features/search/use-followup-filter.ts
 *
 * Hook: 3 hardcoded Variant A AI followup filter chip specs + tap handler.
 *
 * Slice:    S-04 First Product Discovery
 * Task:     T05 FE Page Wire (Phiên Sx04-10)
 *
 * Source:   docs/mockups/intent-03/intent-03A-state-0-happy.html lines 297-315
 *           3 chips: "Dưới 20.000₫" (discount icon) / "Chỉ HOT" / "So sánh thương hiệu khác"
 *
 * Decisions applied:
 * - D-S04-08 LAW: Variant A AI followup chips are FUNCTIONAL (NOT decorative).
 *   Tap mutates filter overlay + re-triggers same-query search via submitQuery.
 *   S-04 stub: re-submit query with same content (BE-side filter mutation deferred S-XX).
 * - D-S04-03 LAW: Variant A only — page-level conditional render guards visibility.
 * - W3 LOCK: search.followup_filter_tapped wired T06 Phiên Sx04-12 (replaces TODO).
 * - C-15 'use client' for useCallback.
 *
 * Consumer (T05 /intent-03/page.tsx):
 *   const { chips, handleFilterTap } = useFollowupFilter(stream.submitQuery, stream.state.query);
 *   {stream.state.mode === 'basic_fallback' && (
 *     <FollowupFilterChips chips={chips} onTap={handleFilterTap} />
 *   )}
 */

import { useCallback, useMemo } from 'react';
import type { FilterChipSpec, FilterPayload } from '@/components/icp/molecules';
import type { SearchMode } from './search-state-machine';
import { trackSearchFollowupFilterTapped } from './tracking-hooks';

/**
 * 3 default Variant A followup filter chips per D-S04-08 LAW.
 * Module-level const for stable reference (useMemo not strictly needed but used for clarity).
 */
const VARIANT_A_FOLLOWUP_CHIPS: FilterChipSpec[] = [
  {
    label: 'Dưới 20.000₫',
    filter: { price_max: 20000 },
    icon: 'discount',
  },
  {
    label: 'Chỉ HOT',
    filter: { badge: 'HOT' },
  },
  {
    label: 'So sánh thương hiệu khác',
    filter: { exclude_brands: [] },
  },
];

export interface UseFollowupFilterReturn {
  chips: FilterChipSpec[];
  handleFilterTap: (filter: FilterPayload, label: string) => void;
}

/**
 * @param submitQuery — stream.submitQuery from useSearchStream
 * @param currentQuery — stream.state.query (preserves last query content on filter re-search)
 */
export function useFollowupFilter(
  submitQuery: (query: string, mode?: SearchMode) => Promise<void>,
  currentQuery: string,
): UseFollowupFilterReturn {
  const chips = useMemo(() => VARIANT_A_FOLLOWUP_CHIPS, []);

  const handleFilterTap = useCallback(
    (filter: FilterPayload, label: string) => {
      // D-S04-08 LAW: emit search.followup_filter_tapped behavior event.
      // T06 Phiên Sx04-12 — wire via tracking-hooks (replaces deferred stub).
      const position = VARIANT_A_FOLLOWUP_CHIPS.findIndex((c) => c.label === label);
      trackSearchFollowupFilterTapped({
        query: currentQuery,
        filter_label: label,
        filter_position: position >= 0 ? position : 0,
      });
      void filter;
      // S-04 stub: re-submit same query in basic_fallback mode.
      // S-XX (post-S-04) will add BE-side filter merge into query state via /action POST.
      void submitQuery(currentQuery, 'basic_fallback');
    },
    [submitQuery, currentQuery],
  );

  return { chips, handleFilterTap };
}
