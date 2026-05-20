'use client';

/**
 * apps/web/app/dev/organism-smoke/bottom-sheet/page.tsx
 *
 * Dev preview — visual smoke for <BottomSheet> organism.
 * Slice: S-01 T06 AC-23.
 *
 * Demonstrates: I05 cart use case — sheet opens with CartItemRow list composed inside.
 */

import { useState } from 'react';
import { BottomSheet } from '@/components/icp/organisms';
import { CartItemRow } from '@/components/icp/molecules';
import { Button } from '@/components/icp/atoms';

export default function BottomSheetSmokePage() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([
    { id: 'p1', brand: 'VINAMILK', name: 'Sữa tươi tiệt trùng 1L', price: 32000, qty: 2 },
    { id: 'p2', brand: 'TH TRUE MILK', name: 'Sữa tươi không đường 1L', price: 35000, qty: 1 },
    { id: 'p3', brand: 'KINH ĐÔ', name: 'Bánh mì sandwich 6 cái', price: 25000, qty: 3 },
  ]);

  const subtotal = items.reduce((acc, it) => acc + it.price * it.qty, 0);

  return (
    <main className="min-h-screen bg-icp-bg-page p-6 flex flex-col items-center justify-center gap-6">
      <h1 className="text-lg font-bold text-icp-pink-900">BottomSheet smoke</h1>
      <p className="text-sm text-icp-pink-700 text-center max-w-sm">
        Bấm nút bên dưới để mở bottom sheet với danh sách CartItemRow composed inside.
      </p>
      <Button variant="pink-grad" size="lg" onClick={() => setOpen(true)}>
        Mở giỏ hàng ({items.length} sản phẩm)
      </Button>

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Giỏ hàng của em"
        description={`${items.length} sản phẩm · Tạm tính ${subtotal.toLocaleString('vi-VN')} ₫`}
        footer={
          <Button
            variant="pink-grad"
            size="lg"
            className="w-full"
            onClick={() => {
              alert(`Thanh toán ${subtotal.toLocaleString('vi-VN')} ₫`);
              setOpen(false);
            }}
          >
            Thanh toán
          </Button>
        }
      >
        <div className="py-2">
          {items.map((item) => (
            <CartItemRow
              key={item.id}
              product={{ brand: item.brand, name: item.name, price: item.price }}
              qty={item.qty}
              onQtyChange={(newQty) => {
                if (newQty < 1) return;
                setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, qty: newQty } : it)));
              }}
            />
          ))}
        </div>
      </BottomSheet>
    </main>
  );
}
