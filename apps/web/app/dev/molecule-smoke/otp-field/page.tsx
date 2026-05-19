'use client';

/**
 * apps/web/app/dev/molecule-smoke/otp-field/page.tsx
 *
 * Dev preview for <OtpField> molecule — T05 AC-9.
 *
 * Renders 3 instances:
 *  - 6-digit empty (initial focus on cell 0)
 *  - 6-digit partial filled (initial value "8421" → 4 filled + cursor at 5 + empty 6)
 *  - 4-digit length variant (showcase prop flexibility)
 *
 * Each instance interactive — type digits, paste 6-digit code, backspace navigation.
 *
 * Route: /dev/molecule-smoke/otp-field
 */

import * as React from 'react';
import { PhoneFrame } from '@/components/icp/PhoneFrame';
import { MainScroll } from '@/components/icp/layout';
import { OtpField } from '@/components/icp/molecules';

export default function OtpFieldSmokePage(): React.ReactElement {
  const [otp1, setOtp1] = React.useState<string>('');
  const [otp2, setOtp2] = React.useState<string>('8421');
  const [otp3, setOtp3] = React.useState<string>('');

  return (
    <PhoneFrame mode="app">
      <MainScroll>
        <div className="p-4 space-y-6">
          <h1 className="text-[14px] font-bold text-icp-pink-900">OtpField smoke</h1>

          <section className="space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-icp-pink-700 font-semibold">
              6-digit empty
            </div>
            <OtpField length={6} value={otp1} onChange={setOtp1} autoFocus={false} />
            <div className="text-[11px] font-mono text-icp-pink-700">
              Value: <span className="font-bold">{otp1 || '(empty)'}</span>
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-icp-pink-700 font-semibold">
              6-digit partial (pre-filled &ldquo;8421&rdquo; per mockup state-G)
            </div>
            <OtpField length={6} value={otp2} onChange={setOtp2} autoFocus={false} />
            <div className="text-[11px] font-mono text-icp-pink-700">
              Value: <span className="font-bold">{otp2 || '(empty)'}</span>
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-icp-pink-700 font-semibold">
              4-digit length variant
            </div>
            <OtpField length={4} value={otp3} onChange={setOtp3} autoFocus={false} />
            <div className="text-[11px] font-mono text-icp-pink-700">
              Value: <span className="font-bold">{otp3 || '(empty)'}</span>
            </div>
          </section>

          <div className="bg-icp-pink-50 border-[0.5px] border-icp-pink-200 rounded-lg p-3 text-[11px] text-icp-pink-700 leading-[1.5]">
            <b>Manual tests:</b>
            <br />• Type digit → cursor advances to next box
            <br />• Backspace empty cell → focus previous, clear it
            <br />• Paste 6-digit code → autofills all boxes
            <br />• Tab/Shift-Tab → native browser navigation
          </div>
        </div>
      </MainScroll>
    </PhoneFrame>
  );
}
