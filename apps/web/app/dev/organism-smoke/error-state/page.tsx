'use client';

/**
 * apps/web/app/dev/organism-smoke/error-state/page.tsx
 *
 * Dev preview — visual smoke for <ErrorState> organism in 3 scenarios.
 * Slice: S-01 T06 AC-26.
 *
 * Scenarios: network error (S-03 login), chart error (S-10), shake toggle demo.
 * Demonstrates: animate-error-pulse (T06 new) + animate-shake (T01 reuse) toggle.
 */

import { useState } from 'react';
import { ErrorState } from '@/components/icp/organisms';
import { Button, Icon, OrbPulse } from '@/components/icp/atoms';

export default function ErrorStateSmokePage() {
  // shake toggle to demonstrate animate-shake T01 reuse
  const [shakeNetwork, setShakeNetwork] = useState(false);

  return (
    <main className="min-h-screen bg-icp-bg-page p-6">
      <div className="max-w-5xl mx-auto flex flex-col gap-8">
        <header>
          <h1 className="text-xl font-bold text-icp-pink-900">ErrorState Smoke</h1>
          <p className="text-sm text-icp-pink-700 mt-1">
            3 scenarios + shake toggle demo (animate-error-pulse + animate-shake)
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Scenario 1 — Network error (S-03 login) with shake toggle */}
          <section className="bg-white rounded-2xl border-[0.5px] border-icp-pink-200 p-2">
            <h2 className="text-xs font-bold text-icp-pink-700 mb-2 uppercase tracking-wider text-center">
              Network error + shake toggle
            </h2>
            <ErrorState
              errorOrb={<OrbPulse state="error" size="md" />}
              errorCode="NETWORK_TIMEOUT"
              title="Mất kết nối mạng"
              subtitle="Em không thể kết nối tới máy chủ"
              shake={shakeNetwork}
              tips={[
                { icon: <Icon name="wifi-off" size={14} />, text: 'Kiểm tra wifi hoặc 4G' },
                { icon: <Icon name="refresh" size={14} />, text: 'Thử lại sau vài giây' },
              ]}
              actions={
                <>
                  <Button
                    variant="pink-grad"
                    onClick={() => {
                      setShakeNetwork(true);
                      // Reset shake after animation (400ms per T01 baseline)
                      setTimeout(() => setShakeNetwork(false), 450);
                    }}
                  >
                    Thử lại (shake)
                  </Button>
                  <Button variant="ghost">Quay lại</Button>
                </>
              }
            />
          </section>

          {/* Scenario 2 — Chart error (S-10) */}
          <section className="bg-white rounded-2xl border-[0.5px] border-icp-pink-200 p-2">
            <h2 className="text-xs font-bold text-icp-pink-700 mb-2 uppercase tracking-wider text-center">
              Chart error (S-10)
            </h2>
            <ErrorState
              errorOrb={<OrbPulse state="error" size="md" />}
              errorCode="DATA_FETCH_FAILED"
              title="Không tải được dữ liệu"
              subtitle="Hệ thống đang gặp sự cố"
              tips={[
                { icon: <Icon name="clock" size={14} />, text: 'Em đang khôi phục, vui lòng đợi' },
              ]}
              actions={<Button variant="ghost">Báo cáo lỗi</Button>}
            />
          </section>

          {/* Scenario 3 — Auth fail compact density */}
          <section className="bg-white rounded-2xl border-[0.5px] border-icp-pink-200 p-2">
            <h2 className="text-xs font-bold text-icp-pink-700 mb-2 uppercase tracking-wider text-center">
              Auth fail (compact)
            </h2>
            <ErrorState
              density="compact"
              errorOrb={<Icon name="alert-circle" size={32} className="text-icp-rose-600" />}
              title="Đăng nhập thất bại"
              subtitle="Email hoặc mật khẩu không đúng"
            />
          </section>
        </div>
      </div>
    </main>
  );
}
