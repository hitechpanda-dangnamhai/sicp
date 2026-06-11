/**
 * apps/web/lib/providers/tenant-provider.tsx
 *
 * S-P0-01 T02 (ADR-046 amendment b) — resolve tenant_id từ slug 1 LẦN cho
 * storefront `/s/<slug>`, cache session, expose qua React context.
 *
 * Side-effect quan trọng: `cacheTenantId(slug, id)` → `api-client.ts` +
 * tracker đọc `getActiveTenantId()` để attach `X-Tenant-Id` cho request
 * anonymous. Component muốn tên shop dùng `useTenant()`.
 */

'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { PublicService } from '@icp/shared-types/api';
import { cacheTenantId, getCachedTenantId } from '@/lib/tenant-context';

export interface TenantContextValue {
  slug: string;
  tenantId: string | null;
  name: string | null;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function useTenant(): TenantContextValue | null {
  return useContext(TenantContext);
}

export interface TenantProviderProps {
  slug: string;
  children: ReactNode;
}

export function TenantProvider({ slug, children }: TenantProviderProps): JSX.Element {
  const [value, setValue] = useState<TenantContextValue>(() => ({
    slug,
    tenantId: getCachedTenantId(slug),
    name: null,
  }));

  useEffect(() => {
    const cached = getCachedTenantId(slug);
    if (cached) {
      setValue({ slug, tenantId: cached, name: null });
      return;
    }
    let active = true;
    PublicService.publicControllerTenantBySlug(slug)
      .then((res) => {
        if (!active) return;
        cacheTenantId(slug, res.tenant_id);
        setValue({ slug, tenantId: res.tenant_id, name: res.name });
      })
      .catch(() => {
        // Slug không hợp lệ / tenant không active → để tenantId=null. Request
        // anonymous sẽ thiếu X-Tenant-Id → BE trả 400 (đúng chain ADR-046 b).
        if (active) setValue({ slug, tenantId: null, name: null });
      });
    return () => {
      active = false;
    };
  }, [slug]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}
