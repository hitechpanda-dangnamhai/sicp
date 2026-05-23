'use client';

/**
 * apps/web/app/dev/organism-smoke/login-form/page.tsx
 *
 * Dev preview — visual smoke for <LoginForm> organism.
 * Slice: S-01 T06 AC-27.
 *
 * Demonstrates:
 * - onSubmit async callback with loading state
 * - external error banner (server-side rejection)
 * - eye-toggle password visibility
 * - email + password validation (react-hook-form built-in rules)
 */

import { useState } from 'react';
import { LoginForm, type LoginFormData } from '@/components/icp/organisms';
import { PhoneFrame, MainScroll } from '@/components/icp/layout';

export default function LoginFormSmokePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [lastSubmit, setLastSubmit] = useState<LoginFormData | null>(null);

  const handleSubmit = async (data: LoginFormData) => {
    setError(undefined);
    setLoading(true);
    setLastSubmit(data);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1200));
    // Simulate failure if email contains "fail"
    if (data.email.includes('fail')) {
      setError('Email hoặc mật khẩu không đúng');
    } else {
      alert(`Đăng nhập thành công: ${data.email}`);
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-icp-bg-page p-6 flex justify-center">
      <PhoneFrame mode="app">
        <MainScroll noBottomPadding>
          <div className="px-6 py-8 flex flex-col gap-6">
            <header className="text-center">
              <h1 className="text-2xl font-bold text-icp-pink-900">Đăng nhập</h1>
              <p className="text-sm text-icp-pink-700 mt-1">Welcome back to ICP</p>
              <p className="text-xs text-icp-text-muted mt-2 italic">
                Hint: nhập email có chữ &quot;fail&quot; để xem error state
              </p>
            </header>

            <LoginForm onSubmit={handleSubmit} loading={loading} error={error} />

            {lastSubmit && (
              <div className="rounded-xl bg-icp-bg-tinted px-3 py-2 text-[11px] font-mono text-icp-pink-700">
                <strong>Last submit:</strong> {lastSubmit.email} / {'*'.repeat(lastSubmit.password.length)}
              </div>
            )}
          </div>
        </MainScroll>
      </PhoneFrame>
    </main>
  );
}
