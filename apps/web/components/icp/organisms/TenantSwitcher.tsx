/**
 * apps/web/components/icp/organisms/TenantSwitcher.tsx
 *
 * S-P0-01 T02 (ADR-046 amendment c) — chọn/đổi shop.
 *
 * Pattern URL-as-active: switch KHÔNG re-issue token. Gọi
 * `POST /auth/switch-tenant` → BE update landing hint + trả `redirect_url`
 * (`/s/<slug>`) → `router.push(redirect_url)`. KHÔNG refresh token, KHÔNG sync
 * state — URL mới = active tenant mới.
 *
 * Danh sách shop từ `GET /auth/tenants` (FE không đọc được tenant_ids httpOnly).
 * Dùng ở /onboarding (chưa có last_active) và header switcher.
 */

'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AuthService } from '@icp/shared-types/api';

export function TenantSwitcher(): JSX.Element {
  const router = useRouter();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['auth', 'my-tenants'],
    queryFn: () => AuthService.landingControllerMyTenants(),
  });

  const switchTenant = useMutation({
    mutationFn: (tenantId: string) =>
      AuthService.authControllerSwitchTenant({ tenant_id: tenantId }),
    // amend c: KHÔNG refresh token sau switch — chỉ điều hướng theo redirect_url.
    onSuccess: (res) => router.push(res.redirect_url),
  });

  if (isLoading) {
    return <p className="text-sm text-gray-500">Đang tải danh sách shop…</p>;
  }
  if (isError || !data) {
    return <p className="text-sm text-red-600">Không tải được danh sách shop.</p>;
  }
  if (data.tenants.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Bạn chưa thuộc shop nào. Liên hệ chủ shop để được thêm vào.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {data.tenants.map((t) => (
        <li key={t.tenant_id}>
          <button
            type="button"
            disabled={switchTenant.isPending}
            onClick={() => switchTenant.mutate(t.tenant_id)}
            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-left hover:bg-gray-50 disabled:opacity-50"
          >
            <span className="font-medium">{t.name}</span>
            <span className="ml-2 text-xs text-gray-400">/s/{t.slug}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
