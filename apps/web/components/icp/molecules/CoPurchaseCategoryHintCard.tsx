'use client';

/**
 * apps/web/components/icp/molecules/CoPurchaseCategoryHintCard.tsx
 *
 * Molecule: <CoPurchaseCategoryHintCard> — category-level co-purchase AI bubble
 * with up to 3 CTA buttons (mockup state-0 lines 326-344 designer-locked).
 *
 * Slice:    S-09 First Image-Based Product Recommendation (Intent 04)
 * Task:     T02 FE + wire (Phiên Sx09-F) — AC32
 *
 * Source:   docs/mockups/intent-04/intent-04-state-0-happy.html lines 326-344
 *           (AI bubble 3: "CHIA SẺ TỪ DỮ LIỆU SHOP" header + body + 2 CTAs)
 *
 * Decisions applied:
 * - **D-S09-NN-A LAW (downstream)**: hint payload comes from `final.co_purchase_hint`
 *   (RecommendationResponseSchema `co_purchase_hint: CoPurchaseHint | null`).
 * - SEMANTIC mismatch from S-04 `CoPurchaseHintCard`: S-04 is product-level
 *   cross-sell ("CHIN-SU tương ớt 250g, 17.000₫") with hardcoded suggested_product
 *   shape; S-09 is category-level ("nước ngọt", "trứng gà") with target_categories
 *   array. Separate molecule per Phiên Sx09-E Section 6.E "CANNOT direct reuse" audit.
 * - C-07 navigation-agnostic — onCategoryTap callback (parent attaches routing).
 * - C-08 + D-05 VN inline — heading + body text consumer-provided per BE detected.
 * - C-15 'use client' for onCategoryTap event handler.
 * - C-18 Tier 4 Tailwind utility inline.
 *
 * Public API:
 *   <CoPurchaseCategoryHintCard
 *     sourceCategory="mì ăn liền cay"
 *     targetCategories={['nước ngọt', 'trứng gà']}        // 1-3 items per CoPurchaseHintSchema.max(3)
 *     confidence={0.85}                                    // not rendered but available for telemetry
 *     onCategoryTap={(cat) => router.push(`/intent-03?q=${cat}`)}
 *   />
 *
 * Mockup ground truth — designer copy "Khách mua {source} thường mua kèm
 * {target1} hoặc {target2}." with 2 buttons (default icons glass-full + egg
 * for category="nước ngọt"/"trứng gà"). For other categories we use generic
 * `category` icon fallback — designer noted icon hint is decorative.
 */

import * as React from 'react';
import { Icon } from '@/components/icp/atoms';
import type { IconName } from '@/lib/icon-map';
import { cn } from '@/lib/utils';

export interface CoPurchaseCategoryHintCardProps {
  /** Source category detected from upload (e.g. "mì ăn liền cay"). */
  sourceCategory: string;
  /** 1-3 co-bought target categories from analytics.co_purchased aggregation. */
  targetCategories: readonly string[];
  /** Confidence 0..1 from BE (analytics frequency / threshold). Available for telemetry. */
  confidence?: number;
  /** Optional callback when a category CTA is tapped (parent attaches routing). */
  onCategoryTap?: (category: string, position: number) => void;
  /**
   * Optional icon mapping per category name (decorative). When omitted, all
   * CTAs use the same fallback `'category'` icon. Mockup uses contextual icons
   * (glass-full, egg) — pass via this map for richer UX.
   */
  iconMap?: Record<string, IconName>;
  className?: string;
}

/** Default fallback when iconMap[category] absent. */
const DEFAULT_ICON: IconName = 'tag';

export function CoPurchaseCategoryHintCard({
  sourceCategory,
  targetCategories,
  // confidence reserved for telemetry hookup at caller (not rendered visually)
  confidence: _confidence,
  onCategoryTap,
  iconMap,
  className,
}: CoPurchaseCategoryHintCardProps): React.ReactElement | null {
  // Defensive — if no categories, do not render (caller should also gate render
  // via `state.coPurchaseHint != null` check).
  if (targetCategories.length === 0) return null;

  // Designer copy template (mockup line 336): "Khách mua {source} thường mua
  // kèm {target1} hoặc {target2}."
  // Generalize for 1-3 targets via Vietnamese natural list ("X", "X hoặc Y", "X, Y hoặc Z").
  const joinedTargets = formatVietnameseList(targetCategories);

  return (
    <div className={cn('flex gap-2 items-start', className)}>
      {/* AI orb mini — 30x30 sparkles gradient (matches state-0 line 327-330) */}
      <div className="w-[30px] h-[30px] flex-shrink-0 rounded-full flex items-center justify-center bg-[radial-gradient(circle_at_30%_30%,_#FFF_0%,_#FFE4E6_40%,_#FB923C_100%)] shadow-[0_4px_10px_rgba(190,24,93,0.25)]">
        <Icon name="sparkles" size={14} className="text-icp-pink-700" />
      </div>

      <div className="flex-1 max-w-[calc(100%-38px)]">
        <div className="relative bg-gradient-to-br from-white to-icp-pink-50 border-[0.5px] border-icp-pink-200 rounded-[18px] rounded-tl-[4px] px-3.5 pt-3 pb-3 shadow-[0_6px_16px_rgba(233,30,99,0.08)] overflow-hidden">
          {/* Decorative orange glow top-right per mockup line 333 */}
          <div className="absolute -top-[30px] -right-[30px] w-[100px] h-[100px] rounded-full bg-[radial-gradient(circle,_rgba(251,146,60,0.15),_transparent_70%)] pointer-events-none" />

          <div className="relative">
            {/* Section label "CHIA SẺ TỪ DỮ LIỆU SHOP" per mockup line 335 */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-icp-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.7)] animate-pulse" />
              <span className="text-[9px] text-icp-pink-700 font-semibold tracking-[0.4px]">
                CHIA SẺ TỪ DỮ LIỆU SHOP
              </span>
            </div>

            {/* Body copy with gradient-text emphasis */}
            <div className="text-[13px] text-icp-pink-900 font-semibold leading-[1.45] mb-2">
              Khách mua{' '}
              <span className="font-bold bg-gradient-to-br from-icp-pink-600 to-icp-orange-500 bg-clip-text text-transparent">
                {sourceCategory}
              </span>{' '}
              thường mua kèm {joinedTargets}.
            </div>

            {/* CTA buttons — up to 3 per CoPurchaseHintSchema.max(3) */}
            <div className="flex gap-1.5">
              {targetCategories.slice(0, 3).map((cat, i) => {
                const icon = iconMap?.[cat] ?? DEFAULT_ICON;
                // Primary style for first CTA per mockup line 338; secondary for rest
                const isPrimary = i === 0;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => onCategoryTap?.(cat, i)}
                    className={cn(
                      'flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-[11px] text-[11px] font-bold border-0',
                      isPrimary
                        ? 'bg-gradient-to-br from-icp-pink-500 to-icp-orange-500 text-white shadow-[0_4px_10px_rgba(233,30,99,0.3)]'
                        : 'bg-white border-[0.5px] border-icp-pink-200 text-icp-pink-700',
                    )}
                  >
                    <Icon name={icon} size={13} />
                    Xem {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Vietnamese natural-list joiner for category names. Mirrors designer copy
 * grammar from mockup line 336.
 *
 *   ['A']           → "A"
 *   ['A', 'B']      → "A hoặc B"
 *   ['A', 'B', 'C'] → "A, B hoặc C"
 */
function formatVietnameseList(items: readonly string[]): React.ReactNode {
  const sliced = items.slice(0, 3);
  if (sliced.length === 0) return null;
  if (sliced.length === 1) return wrap(sliced[0]);
  if (sliced.length === 2) {
    return (
      <>
        {wrap(sliced[0])} hoặc {wrap(sliced[1])}
      </>
    );
  }
  return (
    <>
      {wrap(sliced[0])}, {wrap(sliced[1])} hoặc {wrap(sliced[2])}
    </>
  );
}

function wrap(text: string): React.ReactNode {
  return (
    <span className="font-bold bg-gradient-to-br from-icp-pink-600 to-icp-orange-500 bg-clip-text text-transparent">
      {text}
    </span>
  );
}
