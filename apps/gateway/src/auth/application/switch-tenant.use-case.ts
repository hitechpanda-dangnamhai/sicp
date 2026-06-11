/**
 * apps/gateway/src/auth/application/switch-tenant.use-case.ts
 *
 * S-P0-01 T02 (ADR-046 amendment c) — switch-tenant = đổi LANDING HINT, KHÔNG
 * re-issue token.
 *
 * Pattern Linear/Vercel/GitHub: active tenant = URL `/s/<slug>`, KHÔNG phải
 * claim/state. "Switch shop" chỉ:
 *   1. Verify membership (user ∈ tenant) — 403 nếu không.
 *   2. UPDATE sessions.last_active_tenant_id (hint cho lần vào root URL kế tiếp).
 *   3. Trả { tenant_id, slug, redirect_url } để FE router.push('/s/<slug>').
 *
 * KHÔNG đụng JWT/cookie (token mang tenant_ids[] không đổi khi switch). Multi-tab
 * tự nhiên: mỗi tab có URL riêng = active tenant riêng.
 */

import { Injectable } from '@nestjs/common';
import { PostgresMembershipRepository } from '../infrastructure/postgres-membership.repo';
import { PostgresSessionRepository } from '../infrastructure/postgres-session.repo';
import { TenantSwitchRejectedError } from '../domain/errors';

export interface SwitchTenantCommand {
  userId: string;
  jti: string;
  targetTenantId: string;
}

export interface SwitchTenantResult {
  tenantId: string;
  slug: string;
  redirectUrl: string;
  fromTenantId: string | null;
}

@Injectable()
export class SwitchTenantUseCase {
  constructor(
    private readonly memberships: PostgresMembershipRepository,
    private readonly sessions: PostgresSessionRepository,
  ) {}

  async execute(cmd: SwitchTenantCommand): Promise<SwitchTenantResult> {
    const allowed = await this.memberships.isMember(cmd.userId, cmd.targetTenantId);
    if (!allowed) {
      throw new TenantSwitchRejectedError('not_member');
    }

    // Hint cũ (cho log from→to) trước khi ghi đè.
    const before = await this.sessions.getLastActiveTenant(cmd.jti);

    await this.sessions.updateLastActiveTenant(cmd.jti, cmd.targetTenantId);

    // Slug để dựng redirect_url (join tenants, status active).
    const after = await this.sessions.getLastActiveTenant(cmd.jti);
    if (!after) {
      // Member nhưng tenant không active (suspended/archived) — không cho switch.
      throw new TenantSwitchRejectedError('not_member');
    }

    return {
      tenantId: after.tenant_id,
      slug: after.slug,
      redirectUrl: `/s/${after.slug}`,
      fromTenantId: before?.tenant_id ?? null,
    };
  }
}
