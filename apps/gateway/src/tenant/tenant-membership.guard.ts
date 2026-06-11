/**
 * apps/gateway/src/tenant/tenant-membership.guard.ts
 *
 * S-P0-01 T02 (ADR-046 amendment c) — guard chain bước 2 (sau JwtAuthGuard).
 *
 * Authorize active tenant: tenant_id (từ URL/header, resolve qua
 * TenantResolverService) PHẢI ∈ jwt.tenant_ids (membership). Không → 403.
 * Gắn `req.tenant_id` cho downstream (dashboard/intent) dùng làm scope.
 *
 * Đặt SAU JwtAuthGuard trong `@UseGuards(JwtAuthGuard, TenantMembershipGuard)`
 * — cần req.user.tenant_ids đã populate. Case (item 16):
 *   1. URL tenant ∈ jwt.tenant_ids → pass + set req.tenant_id.
 *   2. URL tenant ∉ → 403.
 *   3. Không URL/header → resolver ném 400 (TenantContextMissing).
 *   4. Không JWT → JwtAuthGuard đã 401 trước đó.
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { TenantResolverService } from './tenant-resolver.service';
import { createLogger, type IcpLogPayload } from '../observability';

@Injectable()
export class TenantMembershipGuard implements CanActivate {
  private readonly log = createLogger({
    service: 'gateway',
    version: process.env.APP_VERSION ?? '0.0.1',
    env: process.env.NODE_ENV ?? 'dev',
  }).child({ component: 'tenant.membership_guard' });

  constructor(private readonly resolver: TenantResolverService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    // Resolve active tenant từ URL/header (ném 400 nếu thiếu — case 3).
    const { tenantId } = this.resolver.resolve(req);

    // req.user do JwtAuthGuard populate (chạy trước). Phòng thủ nếu thiếu.
    const tenantIds = req.user?.tenant_ids ?? [];
    if (!tenantIds.includes(tenantId)) {
      this.log.warn(
        {
          message: 'tenant.membership_denied',
          user_id: req.user?.id,
          tenant_id: tenantId,
          extras: { member_count: tenantIds.length },
        } as IcpLogPayload,
        'tenant.membership_denied',
      );
      throw new ForbiddenException({
        error: { code: 'TENANT_FORBIDDEN', message: 'Not a member of this tenant' },
      });
    }

    // Active tenant hợp lệ → gắn cho downstream scope (withTenant / AI forward).
    req.tenant_id = tenantId;
    return true;
  }
}
