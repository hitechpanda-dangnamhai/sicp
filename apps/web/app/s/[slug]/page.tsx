/**
 * apps/web/app/s/[slug]/page.tsx
 *
 * S-P0-01 T02b-2 (carry-over từ T02b-1 report) — storefront index. Bare
 * `/s/<slug>` (đích của switch-tenant `redirect_url` + landing `/s/<slug>`)
 * trước đây 404 vì không có page tại segment gốc. Redirect sang `/s/<slug>/home`
 * (hub mặc định) — slug từ params (server), qua tenantHref để KHÔNG hardcode
 * `/s/` (grep gate T02b-3). Membership đã được layout validate (∉ → 404).
 */

import { redirect } from 'next/navigation';
import { tenantHref } from '@/lib/tenant-href';

export interface StorefrontIndexProps {
  params: { slug: string };
}

export default function StorefrontIndexPage({ params }: StorefrontIndexProps): never {
  redirect(tenantHref('/home', params.slug));
}
