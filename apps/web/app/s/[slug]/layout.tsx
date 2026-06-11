/**
 * apps/web/app/s/[slug]/layout.tsx
 *
 * S-P0-01 T02 (ADR-046 amendment b) — storefront deploy model `icp.vn/s/<slug>`.
 *
 * Resolve tenant_id từ slug 1 lần (qua TenantProvider → `/public/tenant-by-slug`)
 * + cache session → mọi request anonymous bên dưới (tracking/public) tự kèm
 * `X-Tenant-Id` (api-client interceptor). Authed request vẫn ưu tiên JWT claim.
 *
 * Client layout vì TenantProvider dùng React context + useEffect fetch.
 */

'use client';

import { type ReactNode } from 'react';
import { TenantProvider } from '@/lib/providers/tenant-provider';

export interface StorefrontLayoutProps {
  children: ReactNode;
  // Next 14 App Router: params là object thuần (không phải Promise như Next 15).
  params: { slug: string };
}

export default function StorefrontLayout({ children, params }: StorefrontLayoutProps): JSX.Element {
  return <TenantProvider slug={params.slug}>{children}</TenantProvider>;
}
