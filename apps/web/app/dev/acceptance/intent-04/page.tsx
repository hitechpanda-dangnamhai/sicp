/**
 * apps/web/app/dev/acceptance/intent-04/page.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Acceptance pages
 * Intent:  I04 — Add to Cart (Thêm giỏ)
 * State:   state-E-cart
 *
 * Reference: docs/mockups/intent-04-add-to-cart/state-E-cart.html
 *
 * Components composed:
 *   - Layout: PhoneFrame (mode="app"), StatusBar, AppHeader, BottomBar
 *   - Atoms: Button, ChipPill
 *   - Molecules: ProductCard (I04_172 preset grid)
 *
 * Per TASKLIST: "I04 → state-E-cart (ProductCard grid + cart-bump animation)"
 *
 * Note: I04 is Family B mode="app". Cart counter button bottom-right.
 */
'use client';

import { useState } from 'react';
import { PhoneFrame, AppHeader, BottomBar, MainScroll } from '@/components/icp/layout';
import { Button, ChipPill, StatusBar } from '@/components/icp/atoms';
import { ProductCard, I04_172 } from '@/components/icp/molecules';

// A7 patch: ProductCard renders `{confidence}%` literal → caller must pass INTEGER
// (e.g. 94 → "94%"), not decimal (0.94 → "0.94%"). Verified ProductCard.tsx
// ProductImageSection.tsx confidence chip line.
const PRODUCTS_GRID = [
  {
    brand: 'Vinamilk',
    name: 'Sữa chua men sống 100g',
    price: 8000,
    originalPrice: 10000,
    confidence: 94,
    aiReason: 'Tăng 45% doanh số 7 ngày',
    badge: { type: 'hot' as const, label: 'HOT' },
  },
  {
    brand: 'TH True Milk',
    name: 'Sữa tươi nguyên kem 1L',
    price: 32000,
    confidence: 88,
    aiReason: 'Phù hợp với mùa',
  },
  {
    brand: 'Vinamilk',
    name: 'Sữa chua trái cây 100g',
    price: 9000,
    confidence: 82,
    badge: { type: 'new' as const, label: 'MỚI' },
  },
  {
    brand: 'Cocoxim',
    name: 'Nước dừa 250ml',
    price: 12000,
    confidence: 91,
    aiReason: 'Cân bằng dinh dưỡng',
  },
  {
    brand: 'Lavie',
    name: 'Nước suối 500ml',
    price: 5000,
    confidence: 76,
  },
  {
    brand: 'Vinamilk',
    name: 'Sữa hộp 100ml',
    price: 7500,
    confidence: 85,
    badge: { type: 'discount' as const, label: '-15%' },
  },
];

export default function IntentFourPage() {
  const [cartCount, setCartCount] = useState(3);

  const handleAdd = (productName: string) => {
    setCartCount((prev) => prev + 1);
    alert(`Thêm: ${productName}`);
  };

  return (
    <PhoneFrame mode="chat">
      {/* A13 patch: switch mode="app" → mode="chat" + <MainScroll> wrapper.
          Root cause: PhoneFrame mode="app" với overflow-y-auto + BottomBar
          position absolute scroll theo content height thay vì pin frame bottom.
          Fix: dùng MainScroll pattern (T01 baseline có padding-bottom 130px
          baked + flex:1 overflow-y:auto) → PhoneFrame stays overflow:hidden
          → BottomBar absolute đúng pin frame bottom. */}
      <StatusBar />
      <AppHeader
        title="Sản phẩm gợi ý"
        subtitle="AI chọn dựa trên giỏ hiện tại"
        live
        onBack={() => alert('Back')}
      />

      <MainScroll>
        {/* Category chips — A10 spacing pt-2 pb-4 + items-center */}
        <div className="pt-2 pb-4 flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-2 px-2">
          <ChipPill variant="filter" color="pink" interactive selected>
            Tất cả
          </ChipPill>
          <ChipPill variant="filter" color="pink" interactive>
            Đề xuất AI
          </ChipPill>
          <ChipPill variant="filter" color="pink" interactive>
            Khuyến mãi
          </ChipPill>
        </div>

        {/* ProductCard grid — I04_172 preset (width 172 + addButton price-row green).
            No bottom padding needed: MainScroll T01 baseline has padding-bottom 130px. */}
        <div className="grid grid-cols-2 gap-3 justify-items-center pt-2">
          {PRODUCTS_GRID.map((product, i) => (
            <ProductCard
              key={i}
              {...I04_172}
              brand={product.brand}
              name={product.name}
              price={product.price}
              originalPrice={product.originalPrice}
              badge={product.badge}
              confidence={product.confidence}
              aiReason={product.aiReason}
              onAdd={() => handleAdd(product.name)}
            />
          ))}
        </div>
      </MainScroll>

      <BottomBar>
        <Button
          variant="pink-grad"
          className="flex-1"
          rightIcon="chevron-right"
          onClick={() => alert(`Đi tới giỏ (${cartCount})`)}
        >
          Giỏ hàng ({cartCount})
        </Button>
      </BottomBar>
    </PhoneFrame>
  );
}
