/**
 * apps/gateway/src/intent/intent-policy.guard.ts
 *
 * S-P0-01 T03e (ADR-050) — thay TenantMembershipGuard tại POST /intent +
 * POST /:rid/action.
 *
 * Tenant strict MỌI intent (resolver.resolve() → 400 thiếu X-Tenant-Id; gắn
 * req.tenant_id cho downstream forward, pattern cart T03d).
 *
 *   - POST /intent: classify (modality, hint) → membership_required
 *     (intentRequiresMembership). required → enforce tenant ∈ jwt.tenant_ids
 *     (403 TENANT_FORBIDDEN); gắn req.membership_required cho controller ghi vào
 *     intent:cache VALUE (ADR-050 §4).
 *   - POST /:rid/action: action body KHÔNG mang (modality, hint) → policy đọc
 *     từ intent:cache SAU assertOwnership (ADR-050 §4, controller). Guard chỉ
 *     đảm bảo tenant strict + set req.tenant_id.
 *
 * Đặt SAU JwtAuthGuard: cần req.user.tenant_ids đã populate.
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { TenantResolverService } from '../tenant/tenant-resolver.service';
import { createLogger, type IcpLogPayload } from '../observability';
import { intentRequiresMembership } from './intent-policy';

declare module 'express' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Request {
    /**
     * S-P0-01 T03e — IntentPolicyGuard tính lúc POST /intent; controller forward
     * vào intent:cache VALUE (ADR-050 §4) để /:rid/action enforce sau ownership.
     */
    membership_required?: boolean;
  }
}

@Injectable()
export class IntentPolicyGuard implements CanActivate {
  private readonly log = createLogger({
    service: 'gateway',
    version: process.env.APP_VERSION ?? '0.0.1',
    env: process.env.NODE_ENV ?? 'dev',
  }).child({ component: 'intent.policy_guard' });

  constructor(private readonly resolver: TenantResolverService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    // Tenant strict mọi intent (ADR-050 §1 + cart T03d). Thiếu header → 400.
    const { tenantId } = this.resolver.resolve(req);
    req.tenant_id = tenantId;

    // POST /:rid/action — policy nằm trong intent:cache (ghi lúc POST), enforce
    // ở controller SAU assertOwnership (ADR-050 §4). Guard chỉ tenant strict.
    if (req.params?.rid) return true;

    // POST /intent — classify (modality, hint) → membership_required.
    const body = (req.body ?? {}) as { modality?: unknown; hint?: unknown };
    const required = intentRequiresMembership(body.modality, body.hint);
    req.membership_required = required;

    if (required) {
      const tenantIds = req.user?.tenant_ids ?? [];
      if (!tenantIds.includes(tenantId)) {
        this.log.warn(
          {
            message: 'intent.policy_denied',
            user_id: req.user?.id,
            tenant_id: tenantId,
            extras: {
              modality: typeof body.modality === 'string' ? body.modality : null,
              hint: typeof body.hint === 'string' ? body.hint : null,
              member_count: tenantIds.length,
            },
          } as IcpLogPayload,
          'intent.policy_denied',
        );
        throw new ForbiddenException({
          error: {
            code: 'TENANT_FORBIDDEN',
            message: 'Intent requires tenant membership',
          },
        });
      }
    }

    return true;
  }
}
