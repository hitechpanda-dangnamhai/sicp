'use client';

/**
 * apps/web/app/dev/molecule-smoke/payment-method-picker/page.tsx
 *
 * Dev preview for <PaymentMethodPicker> molecule — T05 AC-8.
 *
 * Renders 5 methods matching intent-06 state-B-method.html exactly:
 *  - MoMo  (gradient-text "Mo",  D946EF→BE185D, with -2% cashback badge — initial selected)
 *  - VNPay (gradient-text "VNPay", 1565C0→0D47A1)
 *  - Bank  (gradient-icon "wallet", 6366F1→4338CA)
 *  - COD   (gradient-icon "wallet", 10B981→047857, with +15.000₫ surcharge badge)
 *  - Mock  (gradient-icon "credit-card", 9CA3AF→4B5563, dashed border)
 *
 * Interactive useState selection toggle — click any method to update selected.
 *
 * Route: /dev/molecule-smoke/payment-method-picker
 */

import * as React from 'react';
import { PhoneFrame } from '@/components/icp/PhoneFrame';
import { MainScroll } from '@/components/icp/layout';
import { PaymentMethodPicker, type PaymentMethod } from '@/components/icp/molecules';

const METHODS: PaymentMethod[] = [
  {
    id: 'momo',
    name: 'Ví MoMo',
    subtitle: 'SĐT •••• 5678 • Còn 1.250.000₫',
    avatar: { type: 'gradient-text', bg: ['#D946EF', '#BE185D'], content: 'Mo' },
    badge: { type: 'success', label: '−2%' },
  },
  {
    id: 'vnpay',
    name: 'VNPay QR',
    subtitle: 'Quét mã QR bằng app ngân hàng',
    avatar: { type: 'gradient-text', bg: ['#1565C0', '#0D47A1'], content: 'VNPay' },
  },
  {
    id: 'bank',
    name: 'Chuyển khoản ngân hàng',
    subtitle: '17 ngân hàng • Internet Banking',
    avatar: { type: 'gradient-icon', bg: ['#6366F1', '#4338CA'], content: 'wallet' },
  },
  {
    id: 'cod',
    name: 'Thanh toán khi nhận hàng',
    subtitle: 'Tiền mặt cho shipper',
    avatar: { type: 'gradient-icon', bg: ['#10B981', '#047857'], content: 'wallet' },
    badge: { type: 'warning', label: '+15.000₫' },
  },
  {
    id: 'mock',
    name: 'Thẻ test (Mock)',
    subtitle: 'Stripe test card • Demo only',
    avatar: { type: 'gradient-icon', bg: ['#9CA3AF', '#4B5563'], content: 'credit-card', dashed: true },
  },
];

export default function PaymentMethodPickerSmokePage(): React.ReactElement {
  const [selected, setSelected] = React.useState<string>('momo');

  return (
    <PhoneFrame mode="app">
      <MainScroll>
        <div className="p-4 space-y-3">
          <h1 className="text-[14px] font-bold text-icp-pink-900">PaymentMethodPicker smoke</h1>
          <div className="text-[11px] text-icp-pink-700">
            Selected: <span className="font-mono font-bold">{selected}</span>
          </div>
          <PaymentMethodPicker methods={METHODS} selected={selected} onSelect={setSelected} />
        </div>
      </MainScroll>
    </PhoneFrame>
  );
}
