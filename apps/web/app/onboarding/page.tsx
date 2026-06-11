/**
 * apps/web/app/onboarding/page.tsx
 *
 * S-P0-01 T02 (ADR-046 amendment c) — chọn shop khi không có landing hint.
 *
 * GET /auth/landing trả `/onboarding` khi `sessions.last_active_tenant_id` NULL
 * (chưa từng switch / vừa thêm membership). Trang này liệt kê shop user là
 * member (JWT.tenant_ids → /auth/tenants) để chọn → switch → /s/<slug>.
 */

import { TenantSwitcher } from '@/components/icp/organisms/TenantSwitcher';

export default function OnboardingPage(): JSX.Element {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Chọn shop</h1>
        <p className="text-sm text-gray-500">Chọn shop bạn muốn vào để tiếp tục.</p>
      </header>
      <TenantSwitcher />
    </main>
  );
}
