'use client';

/**
 * apps/web/app/dev/molecule-smoke/product-card/page.tsx
 *
 * Dev preview for <ProductCard> molecule — T05 AC-6.
 *
 * Renders both presets per Concern 2 mitigation:
 * - Section "Carousel (I03A 138px)" — 3 cards horizontal scroll, varied badges + rating
 * - Section "Grid (I04 172px)" — 2 cards in flex row with confidence + cornerBadge + aiReason + green add-btn
 *
 * Wrapped in <PhoneFrame mode="app"> per C-01 Family B layout.
 *
 * Route: /dev/molecule-smoke/product-card
 */

import * as React from 'react';
import { PhoneFrame } from '@/components/icp/PhoneFrame';
import { MainScroll } from '@/components/icp/layout';
import { ProductCard, I03A_138, I04_172 } from '@/components/icp/molecules';

export default function ProductCardSmokePage(): React.ReactElement {
  const [addLog, setAddLog] = React.useState<string[]>([]);
  const logAdd = (label: string) => setAddLog((prev) => [...prev.slice(-2), `+ ${label}`]);

  return (
    <PhoneFrame mode="app">
      <MainScroll>
        <div className="px-1 py-4 space-y-6">
          <h1 className="text-[14px] font-bold text-icp-pink-900">ProductCard smoke</h1>

          {/* Section 1: Carousel (I03A 138) */}
          <section>
            <div className="text-[11px] uppercase tracking-wider text-icp-pink-700 font-semibold mb-2">
              Carousel — I03A 138px
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1">
              <ProductCard
                {...I03A_138}
                brand="MAGGI"
                name="Nước tương Maggi đậm đặc 700ml"
                price={25500}
                originalPrice={30000}
                rating={4.8}
                soldCount="Đã bán 1.2k"
                badge={[
                  { type: 'hot', label: 'HOT' },
                  { type: 'discount', label: '-15%' },
                ]}
                imageGradient="linear-gradient(135deg, #FEF3C7, #FCD34D)"
                onAdd={() => logAdd('Maggi 700ml')}
              />
              <ProductCard
                {...I03A_138}
                brand="CHIN-SU"
                name="Tương ớt Chin-su 250g"
                price={17000}
                rating={4.6}
                soldCount="Đã bán 850"
                badge={{ type: 'sale', label: 'SALE' }}
                imageGradient="linear-gradient(135deg, #FEE2E2, #FCA5A5)"
                onAdd={() => logAdd('Chin-su 250g')}
              />
              <ProductCard
                {...I03A_138}
                brand="NAM NGƯ"
                name="Nước mắm Nam Ngư 500ml"
                price={32000}
                rating={4.7}
                soldCount="Đã bán 2.1k"
                imageGradient="linear-gradient(135deg, #DBEAFE, #93C5FD)"
                onAdd={() => logAdd('Nam Ngu 500ml')}
              />
            </div>
          </section>

          {/* Section 2: Grid (I04 172) */}
          <section>
            <div className="text-[11px] uppercase tracking-wider text-icp-pink-700 font-semibold mb-2">
              Grid — I04 172px
            </div>
            <div className="flex flex-wrap gap-1">
              <ProductCard
                {...I04_172}
                brand="Samyang"
                name="Mì cay Buldak phô mai 140g"
                price={35000}
                confidence={98}
                cornerBadge={{ type: 'hot', label: 'HOT' }}
                aiReason="Cùng vị cay, gói đỏ giống hệt"
                soldCount="đã bán 1.2k"
                imageGradient="linear-gradient(135deg, #DC2626 0%, #F59E0B 100%)"
                onAdd={() => logAdd('Samyang Buldak')}
              />
              <ProductCard
                {...I04_172}
                brand="Nongshim"
                name="Mì Shin Ramyun cay đỏ 120g"
                price={22000}
                originalPrice={28000}
                confidence={94}
                cornerBadge={{ type: 'sale', label: 'SALE' }}
                aiReason="Mì Hàn cay top sale tuần này"
                imageGradient="linear-gradient(135deg, #B91C1C 0%, #DC2626 100%)"
                onAdd={() => logAdd('Nongshim Shin')}
              />
            </div>
          </section>

          {/* Add log */}
          {addLog.length > 0 ? (
            <section>
              <div className="text-[11px] uppercase tracking-wider text-icp-pink-700 font-semibold mb-2">
                Add log
              </div>
              <div className="bg-icp-pink-50 border-[0.5px] border-icp-pink-200 rounded-lg p-3 text-[11px] font-mono text-icp-pink-900">
                {addLog.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </MainScroll>
    </PhoneFrame>
  );
}
