/**
 * apps/web/app/dev/acceptance/intent-08/page.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Acceptance pages
 * Intent:  I08 — Login Flow (Đăng nhập)
 * State:   state-A-login
 *
 * Reference: docs/mockups/intent-08-login/state-A-login.html
 *
 * Components composed:
 *   - Layout: PhoneFrame (mode="app"), StatusBar
 *   - Atoms: BrainIcon (brand logo), Button
 *   - Molecules: (none — LoginForm composes own atoms)
 *   - Organisms: LoginForm
 *
 * Per TASKLIST: "I08 → state-A-login (LoginForm, PhoneFrame mode='app')"
 *
 * Note: LoginForm onSubmit stub here per C-29 — V-SLICE S-03 attaches
 * Server Action. T07 acceptance page = visual smoke only.
 */
'use client';

import { useState } from 'react';
import { PhoneFrame, MainScroll } from '@/components/icp/layout';
import { BrainIcon, StatusBar } from '@/components/icp/atoms';
import { LoginForm, type LoginFormData } from '@/components/icp/organisms';

export default function IntentEightPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setError(undefined);

    // Simulate Server Action (V-SLICE S-03 will replace with real action)
    await new Promise((r) => setTimeout(r, 1500));

    // Mock validation
    if (data.email === 'wrong@example.com') {
      setError('Email hoặc mật khẩu không đúng. Vui lòng thử lại.');
    } else {
      alert(`Đăng nhập thành công: ${data.email}`);
    }

    setLoading(false);
  };

  return (
    <PhoneFrame mode="chat">
      {/* A13 patch: switch mode="app" → mode="chat" + <MainScroll noBottomPadding>
          to contain scroll within frame. Same root cause as I04. I08 has no
          BottomBar so noBottomPadding=true to override T01 baseline 130px. */}
      <StatusBar />

      <MainScroll noBottomPadding>
        <div className="px-6 py-8 flex flex-col items-center">
          {/* Brand header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-icp-pink-500 to-icp-rose-500 shadow-icp-pink-lg mb-4">
              <BrainIcon size="lg" className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-icp-text-primary">
              Chào mừng đến với MoMo
            </h1>
            <p className="text-sm text-icp-text-muted mt-1">
              Đăng nhập để tiếp tục
            </p>
          </div>

          {/* Login form */}
          <div className="w-full">
            <LoginForm
              onSubmit={handleSubmit}
              loading={loading}
              error={error}
              defaultValues={{ email: '' }}
            />
          </div>

          {/* Footer links */}
          <div className="mt-6 text-center">
            <button
              type="button"
              className="text-sm text-icp-pink-700 font-semibold"
              onClick={() => alert('Quên mật khẩu')}
            >
              Quên mật khẩu?
            </button>
          </div>

          <div className="mt-8 text-center text-xs text-icp-text-muted">
            <p>
              Chưa có tài khoản?{' '}
              <button
                type="button"
                className="text-icp-pink-700 font-semibold"
                onClick={() => alert('Đăng ký')}
              >
                Đăng ký ngay
              </button>
            </p>
          </div>
        </div>
      </MainScroll>
    </PhoneFrame>
  );
}
