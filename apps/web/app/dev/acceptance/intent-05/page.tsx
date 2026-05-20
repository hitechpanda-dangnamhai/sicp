/**
 * apps/web/app/dev/acceptance/intent-05/page.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Acceptance pages
 * Intent:  I05 — Confirm Shipping (Xác nhận giao)
 * State:   state-0-happy
 *
 * ⚠️ CRITICAL Bug 1 + Bug 2 test page per KI-4 T05 lesson + bugs-regression.spec.ts
 *
 * Reference: docs/mockups/intent-05-confirm-shipping/state-0-happy.html
 *
 * Components composed:
 *   - Layout: PhoneFrame (mode="chat"), StatusBar, TopBar, MainScroll, BottomBar
 *   - Atoms: Button, Spinner (em demo loading state)
 *   - Molecules: CartItemRow (with stockIssue='out' to test rose banner)
 *   - Organisms: BottomSheet (payment picker), OrderSummary, EmptyState
 *
 * Per TASKLIST: "I05 → state-0-happy (CartItemRow, BottomSheet, BottomBar)"
 * + bugs-regression.spec.ts targets THIS page for:
 *   - Bug 1: scroll mid (300, 500, 800px) — content NOT leak through BottomBar
 *   - Bug 2: viewport (700, 750, 820px) — frame shrinks within bounds
 *
 * data-testid attributes baked for Playwright targeting:
 *   - data-testid="phone-frame" (root)
 *   - data-testid="main-scroll" (scroll container)
 *   - data-testid="bottom-bar" (sticky bottom)
 *   - data-testid="cart-item-list" (scroll content)
 */
'use client';

import { useState } from 'react';
import { PhoneFrame, TopBar, MainScroll, BottomBar } from '@/components/icp/layout';
import { Button, StatusBar } from '@/components/icp/atoms';
import { CartItemRow } from '@/components/icp/molecules';
import { BottomSheet, OrderSummary, EmptyState } from '@/components/icp/organisms';

const CART_ITEMS = [
  { product: { brand: 'Vinamilk', name: 'Sữa chua men sống 100g', price: 8000 }, qty: 2 },
  { product: { brand: 'TH True Milk', name: 'Sữa tươi 1L', price: 32000 }, qty: 1 },
  { product: { brand: 'Vinamilk', name: 'Sữa chua trái cây', price: 9000 }, qty: 3 },
  { product: { brand: 'Cocoxim', name: 'Nước dừa 250ml', price: 12000 }, qty: 2 },
  { product: { brand: 'Lavie', name: 'Nước suối 500ml', price: 5000 }, qty: 6 },
  { product: { brand: 'Vinamilk', name: 'Sữa hộp 100ml', price: 7500 }, qty: 4, stockIssue: 'out' as const },
  { product: { brand: 'Vinamilk', name: 'Sữa chua không đường', price: 8500 }, qty: 1 },
  { product: { brand: 'TH True Milk', name: 'Sữa tươi có đường 500ml', price: 18000 }, qty: 2 },
];

const ORDER_ITEMS = CART_ITEMS.map((c) => ({
  brand: c.product.brand,
  name: c.product.name,
  qty: c.qty,
  price: c.product.price,
}));

const SUBTOTAL = CART_ITEMS.reduce((sum, c) => sum + c.product.price * c.qty, 0);
const DELIVERY = 15000;
const TOTAL = SUBTOTAL + DELIVERY;

export default function IntentFivePage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);

  return (
    <PhoneFrame mode="chat" data-testid="phone-frame">
      <StatusBar />
      <TopBar
        title="Xác nhận giao hàng"
        onBack={() => alert('Back')}
        action={
          <Button variant="link" size="sm" onClick={() => setShowEmpty(!showEmpty)}>
            {showEmpty ? 'Hủy' : 'Trống'}
          </Button>
        }
      />
      <MainScroll data-testid="main-scroll">
        {showEmpty ? (
          <EmptyState
            title="Giỏ hàng trống"
            subtitle="Hãy thêm sản phẩm vào giỏ"
            actions={
              <Button variant="pink-grad" onClick={() => setShowEmpty(false)}>
                Thêm sản phẩm
              </Button>
            }
          />
        ) : (
          <div className="py-4 space-y-3" data-testid="cart-item-list">
            {/* 8 cart items — đủ để scroll qua viewport 844 + force Bug 1 test */}
            {CART_ITEMS.map((item, i) => (
              <CartItemRow
                key={i}
                product={item.product}
                qty={item.qty}
                stockIssue={item.stockIssue}
                onQtyChange={(newQty) => alert(`Qty change ${i}: ${newQty}`)}
                onResolveStockIssue={() => alert(`Resolve stock ${i}`)}
              />
            ))}

            {/* Bumper content để force scroll deep */}
            <div className="h-32 rounded-lg bg-icp-bg-tinted flex items-center justify-center text-sm text-icp-text-muted">
              Cuối giỏ hàng — scroll qua đây để test Bug 1
            </div>
          </div>
        )}
      </MainScroll>
      <BottomBar data-testid="bottom-bar">
        <Button
          variant="pink-grad"
          className="flex-1"
          onClick={() => setSheetOpen(true)}
        >
          Chọn phương thức thanh toán
        </Button>
      </BottomBar>

      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Tóm tắt đơn hàng"
        description="Xem trước trước khi thanh toán"
        footer={
          <Button variant="pink-grad" className="flex-1" onClick={() => alert('Confirm')}>
            Xác nhận thanh toán
          </Button>
        }
      >
        <div className="px-4 py-2">
          <OrderSummary
            items={ORDER_ITEMS}
            subtotal={SUBTOTAL}
            delivery={DELIVERY}
            total={TOTAL}
            mode="confirm"
          />
        </div>
      </BottomSheet>
    </PhoneFrame>
  );
}
