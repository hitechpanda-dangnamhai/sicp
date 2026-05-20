/**
 * apps/web/app/dev/organism-smoke/order-summary/page.tsx
 *
 * Dev preview — visual smoke for <OrderSummary> organism in 2 modes.
 * Slice: S-01 T06 AC-24.
 */

import { OrderSummary } from '@/components/icp/organisms';

const sampleItems = [
  { brand: 'VINAMILK', name: 'Sữa tươi tiệt trùng 1L', qty: 2, price: 32000 },
  { brand: 'TH TRUE MILK', name: 'Sữa tươi không đường 1L', qty: 1, price: 35000 },
  { brand: 'KINH ĐÔ', name: 'Bánh mì sandwich 6 cái', qty: 3, price: 25000 },
];

const subtotal = sampleItems.reduce((acc, it) => acc + it.price * it.qty, 0);
const delivery = 15000;
const discount = 10000;
const total = subtotal + delivery - discount;

export default function OrderSummarySmokePage() {
  return (
    <main className="min-h-screen bg-icp-bg-page p-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <header>
          <h1 className="text-xl font-bold text-icp-pink-900">OrderSummary Smoke</h1>
          <p className="text-sm text-icp-pink-700 mt-1">2 modes side-by-side: confirm + receipt</p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <section>
            <h2 className="text-sm font-bold text-icp-pink-700 mb-2 uppercase tracking-wider">
              Mode: confirm (pre-payment)
            </h2>
            <OrderSummary
              items={sampleItems}
              subtotal={subtotal}
              delivery={delivery}
              discount={discount}
              total={total}
              mode="confirm"
            />
          </section>

          <section>
            <h2 className="text-sm font-bold text-icp-pink-700 mb-2 uppercase tracking-wider">
              Mode: receipt (post-payment)
            </h2>
            <OrderSummary
              items={sampleItems}
              subtotal={subtotal}
              delivery={delivery}
              discount={discount}
              total={total}
              mode="receipt"
              receiptMeta={{
                orderId: 'ICP-20260519-0042',
                timestamp: '19/05/2026 14:32',
              }}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
