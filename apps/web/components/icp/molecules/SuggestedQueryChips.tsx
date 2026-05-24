'use client';

/**
 * apps/web/components/icp/molecules/SuggestedQueryChips.tsx
 *
 * Molecule: <SuggestedQueryChips> — pre-query welcome state chip row
 *
 * Slice:    S-04 First Product Discovery
 * Task:     T04 NEW V-SLICE feature molecule (Phiên Sx04-9a per C-S04-I PHASE_02 §E EXCEPTION)
 *
 * Source:   NO direct mockup — synthesized per D-S04-07 LAW Rule 6 EXCEPTION (S-03 D-28 precedent).
 *           Designer 14 mockup all show post-query state; pre-query welcome state is designer-gap.
 *
 * Reach:    S-04 pre-query welcome state (/intent-03 page mount with no active query)
 *
 * Decisions applied:
 * - D-S04-07 LAW: pre-query welcome state Rule 6 EXCEPTION per S-03 D-28 cross-task callback indirection
 * - D-S04-12 LAW Part 2: 3 hardcoded chips swap (consumer page-level decision):
 *     [0] "Nước tương cho phở"       (anchor — mockup-perfect 4 cards exact match)
 *     [1] "Đồ cay cay ăn phở"        (semantic abstraction → tuong_ot via CLIP multilingual)
 *     [2] "Soy sauce for pho"        (cross-language English → Vietnamese WOW moment)
 *   Note: this molecule accepts arbitrary queries[]; the 3 D-S04-12 LAW strings are PAGE-LEVEL
 *   default hardcoded at consumer (T05 /intent-03/page.tsx), NOT inside this molecule.
 * - C-15 'use client' for onTap event handler
 * - Reuses S-01 ChipPill atom (variant='tag', color='pink', interactive)
 *
 * Behavior:
 *   - Renders flex-wrap chip row using S-01 ChipPill atom
 *   - Each chip tap fires onTap(query, position) → T05 wires to behavior event
 *     `search.suggested_chip_tapped` + setQuery + POST /intent
 *   - Empty queries[] → renders no chips (accessibility verified no broken aria)
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChipPill } from '@/components/icp/atoms';

export interface SuggestedQueryChipsProps {
  /** Query string array. Typically 3 items per D-S04-12 LAW Part 2 (consumer-controlled). */
  queries: string[];
  /** Tap handler. Fires with the query string + its 0-indexed position in array. */
  onTap: (query: string, position: number) => void;
  /** Optional className override. */
  className?: string;
}

export const SuggestedQueryChips: React.FC<SuggestedQueryChipsProps> = ({
  queries,
  onTap,
  className,
}) => {
  return (
    <div
      className={cn('flex flex-wrap gap-2', className)}
      role="group"
      aria-label="Gợi ý truy vấn"
    >
      {queries.map((query, idx) => (
        <ChipPill
          key={`${idx}-${query}`}
          variant="tag"
          color="pink"
          size="md"
          interactive
          leftIcon="sparkles"
          onClick={() => onTap(query, idx)}
        >
          {query}
        </ChipPill>
      ))}
    </div>
  );
};
SuggestedQueryChips.displayName = 'SuggestedQueryChips';
