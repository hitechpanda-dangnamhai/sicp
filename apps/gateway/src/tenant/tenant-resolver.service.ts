/**
 * apps/gateway/src/tenant/tenant-resolver.service.ts
 *
 * S-P0-01 T02 — Resolve ACTIVE tenant cho request (ADR-046 amendment b + c).
 *
 * **amend (c) LOCKED:** active tenant = URL `/s/<slug>` = header `X-Tenant-Id`
 * (FE resolve slug→tenant_id qua `/api/v1/public/tenant-by-slug`). JWT KHÔNG
 * mang active tenant (chỉ `tenant_ids[]` = membership, dùng cho
 * TenantMembershipGuard authorize). Vì vậy resolver = HEADER-ONLY:
 *   - Có `X-Tenant-Id` (UUID) → dùng (source 'header').
 *   - Thiếu → `400 TenantContextMissing`. CẤM silent drop / NULL persist.
 *
 * **CẤM** parse Host/Referer, **CẤM** suy active tenant từ JWT (amend c
 * supersedes "active-tenant JWT" của amend a). Authorize (tenant ∈ tenant_ids)
 * là việc của TenantMembershipGuard, KHÔNG phải resolver.
 */

import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { TenantContextMissingError } from './tenant.errors';
import { createLogger, type IcpLogPayload } from '../observability';

/** UUID v1-5 guard cho header X-Tenant-Id (client-supplied → validate). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TenantSource = 'header';

export interface ResolvedTenant {
  tenantId: string;
  source: TenantSource;
}

@Injectable()
export class TenantResolverService {
  private readonly log = createLogger({
    service: 'gateway',
    version: process.env.APP_VERSION ?? '0.0.1',
    env: process.env.NODE_ENV ?? 'dev',
  }).child({ component: 'tenant.resolver' });

  /**
   * Resolve active tenant từ header X-Tenant-Id (URL). Thiếu → 400 (KHÔNG bao
   * giờ trả null — ném để propagate, đúng chain CẤM silent).
   */
  resolve(req: Request): ResolvedTenant {
    const tenantId = this.headerTenant(req);
    if (tenantId) {
      this.log.debug(
        { message: 'tenant.resolved', extras: { source: 'header' } } as IcpLogPayload,
        'tenant.resolved',
      );
      return { tenantId, source: 'header' };
    }
    this.log.warn(
      { message: 'tenant.context_missing', extras: { path: req.path } } as IcpLogPayload,
      'tenant.context_missing',
    );
    throw new TenantContextMissingError();
  }

  /**
   * Optional resolve cho path KHÔNG bắt buộc tenant (loopback event tenant ở
   * login/logout ngoài storefront). Trả tenantId hoặc null — KHÔNG ném,
   * KHÔNG log context_missing.
   */
  resolveOptional(req: Request): string | null {
    return this.headerTenant(req);
  }

  private headerTenant(req: Request): string | null {
    const header = req.header('x-tenant-id');
    return header && UUID_RE.test(header) ? header : null;
  }
}
