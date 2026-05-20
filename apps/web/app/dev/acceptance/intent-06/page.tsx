/**
 * apps/web/app/dev/acceptance/intent-06/page.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Acceptance pages
 * Intent:  I06 — Payment OTP (Xác thực OTP)
 * State:   state-G-otp
 *
 * ⚠️ CRITICAL Bug 1 + Bug 2 test page per KI-4 T05 lesson + bugs-regression.spec.ts
 *
 * Reference: docs/mockups/intent-06-payment-otp/state-G-otp.html
 *
 * Components composed:
 *   - Layout: PhoneFrame (mode="chat"), StatusBar, TopBar, MainScroll, BottomBar
 *   - Atoms: Button, ChipPill (countdown timer label)
 *   - Molecules: OtpField (length 6), PaymentMethodPicker
 *   - Organisms: OrderSummary (receipt mode), BottomSheet
 *
 * Per TASKLIST: "I06 → state-G-otp (OtpField, OrderSummary, BottomBar)"
 * + bugs-regression.spec.ts targets THIS page (alongside I05).
 *
 * data-testid attributes baked for Playwright targeting:
 *   - data-testid="phone-frame", "main-scroll", "bottom-bar"
 *   - data-testid="otp-field"
 *   - data-testid="order-summary"
 */
'use client';

import { useState } from 'react';
import { PhoneFrame, TopBar, MainScroll, BottomBar } from '@/components/icp/layout';
import { Button, ChipPill, StatusBar } from '@/components/icp/atoms';
import { OtpField, type PaymentMethod, PaymentMethodPicker } from '@/components/icp/molecules';
import { OrderSummary, BottomSheet } from '@/components/icp/organisms';

const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'momo',
    name: 'MoMo',
    subtitle: 'Số dư: 1.250.000₫',
    avatar: { type: 'gradient-text', bg: ['#E91E63', '#F43F5E'], content: 'Mo' },
    badge: { type: 'success', label: '-2%' },
  },
];

const ORDER_ITEMS = [
  { brand: 'Vinamilk', name: 'Sữa chua men sống 100g', qty: 2, price: 8000 },
  { brand: 'TH True Milk', name: 'Sữa tươi 1L', qty: 1, price: 32000 },
];

export default function IntentSixPage() {
  const [otpValue, setOtpValue] = useState('');
  const [methodSheet, setMethodSheet] = useState(false);

  return (
    <PhoneFrame mode="chat" data-testid="phone-frame">
      <StatusBar />
      <TopBar
        title="Xác thực thanh toán"
        onBack={() => alert('Back')}
      />
      <MainScroll data-testid="main-scroll">
        <div className="py-4 space-y-4">
          {/* OTP entry section */}
          <div className="px-2 text-center">
            <h2 className="text-lg font-bold text-icp-text-primary mb-1">
              Nhập mã OTP
            </h2>
            <p className="text-sm text-icp-text-muted mb-4">
              Mã đã gửi đến +84 *** *** 789
            </p>
            <div className="flex justify-center" data-testid="otp-field">
              <OtpField
                length={6}
                value={otpValue}
                onChange={setOtpValue}
                autoFocus={false}
              />
            </div>
            <div className="mt-3">
              <ChipPill variant="badge" color="amber" size="sm">
                Còn lại 1:23
              </ChipPill>
            </div>
          </div>

          {/* Selected payment method preview */}
          <div
            className="rounded-2xl bg-white border border-icp-pink-200 p-3 mx-2"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-icp-pink-700 mb-2">
              Thanh toán bằng
            </div>
            <button
              type="button"
              className="w-full text-left"
              onClick={() => setMethodSheet(true)}
            >
              <PaymentMethodPicker
                methods={PAYMENT_METHODS}
                selected="momo"
                onSelect={() => setMethodSheet(true)}
              />
            </button>
          </div>

          {/* Order summary inline (compact) */}
          <div className="rounded-2xl bg-white border border-icp-pink-200 p-3 mx-2" data-testid="order-summary">
            <OrderSummary
              items={ORDER_ITEMS}
              subtotal={48000}
              delivery={15000}
              total={63000}
              mode="confirm"
            />
          </div>

          {/* Footer hint */}
          <p className="text-center text-xs text-icp-text-muted px-4">
            Bằng việc xác nhận, anh đồng ý với điều khoản giao dịch của MoMo.
          </p>

          {/* Bumper content để force scroll past viewport for Bug 1 test */}
          <div className="h-40 rounded-lg bg-icp-bg-tinted flex items-center justify-center text-sm text-icp-text-muted mx-2">
            Vùng dưới — scroll xuống đây để verify Bug 1
          </div>
        </div>
      </MainScroll>

      <BottomBar data-testid="bottom-bar">
        <Button
          variant="pink-grad"
          className="flex-1"
          disabled={otpValue.length < 6}
          onClick={() => alert('Xác nhận OTP')}
        >
          {otpValue.length === 6 ? 'Xác nhận' : `Nhập đủ 6 chữ số (${otpValue.length}/6)`}
        </Button>
      </BottomBar>

      <BottomSheet
        open={methodSheet}
        onOpenChange={setMethodSheet}
        title="Chọn phương thức"
        footer={
          <Button variant="pink-grad" className="flex-1" onClick={() => setMethodSheet(false)}>
            Xong
          </Button>
        }
      >
        <div className="px-4 py-2">
          <PaymentMethodPicker
            methods={PAYMENT_METHODS}
            selected="momo"
          />
        </div>
      </BottomSheet>
    </PhoneFrame>
  );
}
