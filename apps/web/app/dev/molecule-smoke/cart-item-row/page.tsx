'use client';

/**
 * apps/web/app/dev/molecule-smoke/cart-item-row/page.tsx
 *
 * Dev preview for <CartItemRow> molecule — T05 AC-7.
 *
 * Renders 5 row variants:
 *  - Row 1: base (qty=2, original price strikethrough) — mockup I05 state-0 line 148-175
 *  - Row 2: base (qty=1, no original price)            — mockup I05 state-0 line 178-200
 *  - Row 3: qty=3 (larger qty)
 *  - Row 4: corner badge 'discount -15%'
 *  - Row 5: stockIssue='out' (red banner + "Bỏ" CTA)   — mockup I05 state-E line 185-212
 *
 * Wrapped in <PhoneFrame mode="app"> + <MainScroll> per C-01 Family B layout.
 *
 * Route: /dev/molecule-smoke/cart-item-row
 */

import * as React from 'react';
import { PhoneFrame } from '@/components/icp/PhoneFrame';
import { MainScroll } from '@/components/icp/layout';
import { CartItemRow } from '@/components/icp/molecules';

interface CartLine {
  id: string;
  brand: string;
  name: string;
  price: number;
  originalPrice?: number;
  qty: number;
  imageGradient?: string;
  stockIssue?: 'out';
  cornerBadge?: { type: 'discount' | 'new'; label: string };
}

const INITIAL_LINES: CartLine[] = [
  {
    id: '1',
    brand: 'MAGGI',
    name: 'Nước tương Maggi đậm đặc 700ml',
    price: 25500,
    originalPrice: 30000,
    qty: 2,
    imageGradient: 'linear-gradient(135deg, #FEF3C7, #FCD34D)',
    cornerBadge: { type: 'discount', label: '-15%' },
  },
  {
    id: '2',
    brand: 'CHIN-SU',
    name: 'Tương ớt Chin-su 250g',
    price: 17000,
    qty: 1,
    imageGradient: 'linear-gradient(135deg, #FEE2E2, #FCA5A5)',
  },
  {
    id: '3',
    brand: 'NAM NGƯ',
    name: 'Nước mắm Nam Ngư 500ml',
    price: 32000,
    qty: 3,
    imageGradient: 'linear-gradient(135deg, #DBEAFE, #93C5FD)',
  },
  {
    id: '4',
    brand: 'MAGGI',
    name: 'Hạt nêm Maggi vị thịt heo 400g',
    price: 35000,
    qty: 1,
    imageGradient: 'linear-gradient(135deg, #DBEAFE, #93C5FD)',
    cornerBadge: { type: 'new', label: 'MỚI' },
  },
  {
    id: '5',
    brand: 'CHIN-SU',
    name: 'Tương ớt Chin-su 250g (Hết hàng demo)',
    price: 17000,
    qty: 1,
    imageGradient: 'linear-gradient(135deg, #FEE2E2, #FCA5A5)',
    stockIssue: 'out',
  },
];

export default function CartItemRowSmokePage(): React.ReactElement {
  const [lines, setLines] = React.useState<CartLine[]>(INITIAL_LINES);

  const handleQtyChange = (id: string, newQty: number) => {
    setLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, qty: Math.max(0, newQty) } : line))
    );
  };

  const handleResolveStockIssue = (id: string) => {
    setLines((prev) => prev.filter((line) => line.id !== id));
  };

  return (
    <PhoneFrame mode="app">
      <MainScroll>
        <div className="p-4">
          <h1 className="text-[14px] font-bold text-icp-pink-900 mb-3">
            CartItemRow smoke ({lines.length} items)
          </h1>
          {lines.map((line) => (
            <CartItemRow
              key={line.id}
              product={{
                brand: line.brand,
                name: line.name,
                price: line.price,
                originalPrice: line.originalPrice,
                imageGradient: line.imageGradient,
              }}
              qty={line.qty}
              onQtyChange={(n) => handleQtyChange(line.id, n)}
              stockIssue={line.stockIssue}
              onResolveStockIssue={() => handleResolveStockIssue(line.id)}
              cornerBadge={line.cornerBadge}
            />
          ))}
        </div>
      </MainScroll>
    </PhoneFrame>
  );
}
