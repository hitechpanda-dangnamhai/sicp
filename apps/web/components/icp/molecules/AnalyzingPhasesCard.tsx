'use client';

/**
 * apps/web/components/icp/molecules/AnalyzingPhasesCard.tsx
 *
 * Molecule: <AnalyzingPhasesCard> — state-A 4-phase loading card.
 *
 * Slice:    S-07 T02 — Frontend Cluster
 *
 * Source:   `docs/mockups/intent-01/intent-01-state-A-analyzing.html` lines 158-340
 *           (per D-29 LAW Mockup filename is LAW)
 *
 * Phases (mockup state-A line 344 amended Phiên Sx07-E):
 *   phase_id 0: "Tải ảnh"                                  (active first)
 *   phase_id 1: "Đọc nhãn sản phẩm"                        (Gemini vision)
 *   phase_id 2: "Sinh dấu vân tay 512 chiều"               (CLIP embed)
 *   phase_id 3: "Phân tích thị trường"                     (gtrends + shopee)
 *
 * Decisions applied:
 * - **D-S04-14 LAW**: Adaptive Progressive Streaming — phases render
 *   sequentially even when backend `asyncio.gather` parallelizes enrichment.
 *   FE displays sequential UX for perceived-latency comfort; BE actually
 *   parallel.
 * - **D-S04-10 LAW**: Vespa CLIP 512-dim — phase 3 label explicitly cites
 *   "512 chiều" (mockup state-A line 344 amended Phiên Sx07-E)
 * - **D-29 LAW**: JSDoc cites mockup filename verbatim
 * - **C-S07-D**: 3 SSE events `phase_progress` x4 drive this card (Phiên Sx07-D)
 * - **C-07** navigation-agnostic — pure render of `phases` map prop
 * - **C-15** 'use client' — uses CSS animations (spinner)
 *
 * **Why 4 phases hardcoded (NOT generic N-phase):**
 * Intent 01 specifically has 4 phases per `02_INTENT_SPECS.md` Intent 01.
 * Other intents (S-04 Search has 4 phases; S-06 Checkout has 5 phases) use
 * their own state-A molecule (PhasesCard is generic for cross-intent;
 * AnalyzingPhasesCard is Intent 01-specific).
 *
 * Reach: S-07 V-SLICE state-A — single use site at /intent-01 page.
 */

import * as React from 'react';
import { Spinner, Icon } from '@/components/icp/atoms';
import { cn } from '@/lib/utils';

/** Per-phase slot — mirrors `PhaseProgressSlot` from search-state-machine. */
export interface AnalyzingPhaseSlot {
  phase_id: 0 | 1 | 2 | 3;
  /** Default Vietnamese label used if BE does NOT emit one. */
  label: string;
  status: 'active' | 'done' | 'pending';
  /** Elapsed ms (shown when status='done'). */
  ms?: number;
  /** Optional sub-text (e.g. "5 cửa hàng đã so sánh"). */
  meta?: string;
}

export interface AnalyzingPhasesCardProps {
  /** Map phase_id → slot. Empty/missing phase_id renders as 'pending'. */
  phases: Partial<Record<0 | 1 | 2 | 3, AnalyzingPhaseSlot>>;
  /** Optional className passthrough. */
  className?: string;
}

/**
 * Default phase labels per `02_INTENT_SPECS.md` Intent 01 + state-A mockup
 * amended Phiên Sx07-E (D-S04-10 LAW 512 chiều).
 */
const DEFAULT_LABELS: Record<0 | 1 | 2 | 3, string> = {
  0: 'Tải ảnh',
  1: 'Đọc nhãn sản phẩm',
  2: 'Sinh dấu vân tay 512 chiều',
  3: 'Phân tích thị trường',
};

const PHASE_IDS: ReadonlyArray<0 | 1 | 2 | 3> = [0, 1, 2, 3];

/** Format ms → human label (e.g. "412ms", "1.4s"). */
function formatMs(ms: number | undefined): string | null {
  if (ms == null) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function AnalyzingPhasesCard({ phases, className }: AnalyzingPhasesCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border-[0.5px] border-icp-pink-200 bg-white',
        'shadow-[0_8px_24px_rgba(233,30,99,0.12)]',
        'p-4 mb-4',
        className,
      )}
      aria-live="polite"
      aria-label="Đang phân tích sản phẩm"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3 pb-3 border-b-[0.5px] border-icp-pink-100">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center shadow-[0_3px_8px_rgba(233,30,99,0.3)]">
          <Icon name="sparkles" size={16} className="text-white" />
        </div>
        <div className="flex-1">
          <div className="text-[12px] font-bold uppercase tracking-wider text-icp-pink-900">
            AIDA ĐANG PHÂN TÍCH
          </div>
          <div className="text-[11px] text-icp-pink-700 mt-0.5">
            4 bước tự động, anh chờ vài giây nhé
          </div>
        </div>
      </div>

      {/* Phase rows */}
      <ul className="flex flex-col gap-2" role="list">
        {PHASE_IDS.map((id) => {
          const slot = phases[id];
          const status = slot?.status ?? 'pending';
          const label = slot?.label ?? DEFAULT_LABELS[id];
          const msText = formatMs(slot?.ms);
          const meta = slot?.meta;

          return (
            <li
              key={id}
              className={cn(
                'flex items-center gap-3 px-2 py-1.5 rounded-lg',
                status === 'active' && 'bg-pink-50/60',
              )}
              aria-current={status === 'active' ? 'step' : undefined}
            >
              {/* Status indicator — 24×24 circle */}
              <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                {status === 'done' && (
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-[0_2px_6px_rgba(16,185,129,0.4)]">
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  </div>
                )}
                {status === 'active' && <Spinner size="sm" color="pink" />}
                {status === 'pending' && (
                  <div className="w-3 h-3 rounded-full border-[1.5px] border-icp-pink-200" aria-hidden="true" />
                )}
              </div>

              {/* Label + meta */}
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    'text-[13px] font-medium',
                    status === 'done' && 'text-icp-pink-900',
                    status === 'active' && 'text-icp-pink-900 font-semibold',
                    status === 'pending' && 'text-icp-pink-700/70',
                  )}
                >
                  {label}
                </div>
                {meta && (
                  <div className="text-[11px] text-icp-pink-700 mt-0.5">{meta}</div>
                )}
              </div>

              {/* Elapsed ms (right-aligned, only when done) */}
              {status === 'done' && msText && (
                <div className="flex-shrink-0 text-[11px] font-mono text-emerald-700 font-semibold tabular-nums">
                  {msText}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
