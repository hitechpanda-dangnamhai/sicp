/**
 * apps/web/app/dev/acceptance/intent-03/page.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Acceptance pages
 * Intent:  I03 — Search Products (Tìm hàng)
 * State:   state-0-happy variant A
 *
 * Reference: docs/mockups/intent-03-search-products/state-0-happy-A.html
 *
 * Components composed:
 *   - Layout: PhoneFrame (mode="app"), StatusBar, AppHeader
 *   - Atoms: ChipPill
 *   - Molecules: ProductCard (I03A_138 preset carousel)
 *
 * Per TASKLIST: "I03 → state-0-happy variant A (ProductCard carousel)"
 *
 * Note: mode="app" Family B per phoneFrame source — page-level scroll.
 * Adds StatusBar at top for visual completeness per Task Pack §2.2 coverage.
 */
'use client';

import { PhoneFrame, AppHeader } from '@/components/icp/layout';
import { ChipPill, StatusBar } from '@/components/icp/atoms';
import { ProductCard, I03A_138 } from '@/components/icp/molecules';

const FILTER_CHIPS = [
  { id: 'all', label: 'Tất cả', active: true },
  { id: 'milk', label: 'Sữa' },
  { id: 'snack', label: 'Bánh' },
  { id: 'drink', label: 'Đồ uống' },
];

const PRODUCTS_CAROUSEL = [
  { brand: 'Vinamilk', name: 'Sữa chua men sống 100g', price: 8000, originalPrice: 10000, badge: { type: 'hot' as const, label: 'HOT' } },
  { brand: 'TH True Milk', name: 'Sữa tươi 1L', price: 32000, rating: 4.5, soldCount: '12k' },
  { brand: 'Vinamilk', name: 'Sữa chua trái cây', price: 9000, badge: { type: 'new' as const, label: 'MỚI' } },
  { brand: 'Cocoxim', name: 'Nước dừa 250ml', price: 12000, rating: 4.8 },
  { brand: 'Lavie', name: 'Nước suối 500ml', price: 5000 },
];

export default function IntentThreePage() {
  return (
    <PhoneFrame mode="app">
      {/* A9 patch: sticky header + filter chips per mode="app" page scroll fix */}
      <div className="sticky top-0 z-10 bg-icp-bg-page">
        <StatusBar />
        <AppHeader
          title="Tìm hàng"
          subtitle="Kết quả tìm kiếm"
          onBack={() => alert('Back')}
        />

        {/* Filter chips row */}
        <div className="px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {FILTER_CHIPS.map((chip) => (
            <ChipPill
              key={chip.id}
              variant="filter"
              color="pink"
              size="md"
              interactive
              selected={chip.active}
              onClick={() => alert(`Filter: ${chip.id}`)}
            >
              {chip.label}
            </ChipPill>
          ))}
        </div>
      </div>

      {/* ProductCard carousel — I03A_138 preset (width 138 + addButton image-overlay pink) */}
      <div className="px-4 pb-6 pt-3">
        <h2 className="text-sm font-bold text-icp-text-primary mb-3">
          Sản phẩm phổ biến
        </h2>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          {PRODUCTS_CAROUSEL.map((product, i) => (
            <ProductCard
              key={i}
              {...I03A_138}
              brand={product.brand}
              name={product.name}
              price={product.price}
              originalPrice={product.originalPrice}
              badge={product.badge}
              rating={product.rating}
              soldCount={product.soldCount}
              onAdd={() => alert(`Add ${product.name}`)}
            />
          ))}
        </div>
      </div>

      {/* Section 2 */}
      <div className="px-4 pb-6">
        <h2 className="text-sm font-bold text-icp-text-primary mb-3">
          Khuyến mãi hôm nay
        </h2>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          {PRODUCTS_CAROUSEL.slice(0, 3).map((product, i) => (
            <ProductCard
              key={`promo-${i}`}
              {...I03A_138}
              brand={product.brand}
              name={product.name}
              price={product.price}
              originalPrice={product.originalPrice}
              badge={{ type: 'sale', label: '-20%' }}
              onAdd={() => alert(`Add ${product.name}`)}
            />
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}
