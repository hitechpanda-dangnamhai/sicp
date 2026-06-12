/**
 * apps/web/app/s/[slug]/layout.tsx
 *
 * S-P0-01 T02 (ADR-046 amend b) — storefront deploy model `icp.vn/s/<slug>`:
 * resolve tenant_id từ slug 1 lần (TenantProvider → `/public/tenant-by-slug`)
 * → api-client tự kèm `X-Tenant-Id` cho request anonymous.
 *
 * S-P0-01 T02b-1 (ADR-046 amend d) — VALIDATE slug thuộc membership của user
 * authed: `∉ jwt.tenant_ids → 404`. JWT httpOnly không decode client-side →
 * dùng `GET /auth/tenants` (join slug). Khách anonymous (query 401, không có
 * jwt.tenant_ids) → KHÔNG 404 ở đây; TenantProvider validate qua
 * `/public/tenant-by-slug`. Enforcement an ninh thật vẫn ở BE
 * (TenantMembershipGuard 403) — 404 này chỉ là UX.
 *
 * Client layout vì cần React Query + notFound() theo membership.
 */

'use client';

import { type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { AuthService } from '@icp/shared-types/api';
import { TenantProvider } from '@/lib/providers/tenant-provider';

export interface StorefrontLayoutProps {
  children: ReactNode;
  // Next 14 App Router: params là object thuần (không phải Promise như Next 15).
  params: { slug: string };
}

export default function StorefrontLayout({ children, params }: StorefrontLayoutProps): JSX.Element {
  const { slug } = params;

  // Membership list (authed). retry:false → 401 anonymous không spam retry.
  const { data } = useQuery({
    queryKey: ['auth', 'my-tenants'],
    queryFn: () => AuthService.landingControllerMyTenants(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // Chỉ 404 khi CÓ membership list (authed) mà slug không thuộc. data===undefined
  // (đang load / anonymous 401) → render bình thường, không chặn storefront công khai.
  if (data && !data.tenants.some((t) => t.slug === slug)) {
    notFound();
  }

  return <TenantProvider slug={slug}>{children}</TenantProvider>;
}
