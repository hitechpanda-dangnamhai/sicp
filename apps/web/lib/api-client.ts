/**
 * apps/web/lib/api-client.ts
 *
 * S-P0-01 T02 (ADR-046 amendment b) — interceptor attach `X-Tenant-Id` cho
 * request anonymous (không có JWT authed).
 *
 * Hai mặt:
 *  - `configureTenantHeader()`: set `OpenAPI.HEADERS` resolver → mọi request
 *    qua generated client (TanStack hooks) tự kèm X-Tenant-Id khi đang ở
 *    storefront `/s/<slug>` (đã resolve tenant). Authed request: BE ưu tiên
 *    JWT claim nên header chỉ là hint vô hại.
 *  - `tenantHeaders()`: object header thuần cho caller raw-fetch (tracker SDK).
 *
 * Nguồn tenant = `getActiveTenantId()` (session cache do TenantProvider set khi
 * resolve `/public/tenant-by-slug/<slug>`). Vắng tenant → không attach (BE 400
 * nếu endpoint cần tenant — đúng chain, KHÔNG silent).
 */

import { OpenAPI } from '@icp/shared-types/api';
import { getActiveTenantId } from './tenant-context';

/** Header thuần cho raw-fetch (tracker). Rỗng khi chưa resolve tenant. */
export function tenantHeaders(): Record<string, string> {
  const tenantId = getActiveTenantId();
  return tenantId ? { 'X-Tenant-Id': tenantId } : {};
}

let configured = false;

/**
 * Gắn resolver X-Tenant-Id vào generated OpenAPI client. Idempotent — gọi 1
 * lần lúc bootstrap (cạnh OpenAPI cookie config trong QueryProvider).
 */
export function configureTenantHeader(): void {
  if (configured) return;
  configured = true;
  // openapi-typescript-codegen: HEADERS = Resolver<Record<string,string>>.
  OpenAPI.HEADERS = async () => tenantHeaders();
}
