/**
 * apps/gateway/src/auth/infrastructure/postgres-membership.repo.ts
 *
 * S-P0-01 T02 NEW — Postgres repository cho `tenant_memberships` (V011).
 *
 * Quan hệ merchant/staff ↔ tenant (ADR-046 model #2). Customer GLOBAL KHÔNG có
 * row ở đây — quyền mua hàng là quyền global, không scoped.
 *
 * **KHÔNG đi qua withTenant():** `tenant_memberships` KHÔNG nằm trong danh sách
 * 10 bảng tenant-scoped của V011 (không ENABLE RLS) — nó là bảng ánh xạ
 * user↔tenant, query bằng user_id để RESOLVE tenant (chính nó không thể tự
 * scope theo tenant chưa biết). Dưới role icp_app: GRANT SELECT đủ, không cần GUC.
 *
 * Thao tác (ADR-046 amend c — JWT mang tenant_ids[], active tenant = URL):
 *   - findTenantIds(userId): danh sách tenant_id user là member (JWT claim).
 *   - findTenants(userId): + slug/name cho onboarding/switcher.
 *   - isMember(userId, tenantId): verify cho switch-tenant + TenantMembershipGuard.
 *
 * OTel: pg.query span auto-emit (T01 setup); manual span KHÔNG cần.
 */

import { Injectable } from '@nestjs/common';
import { PgPool } from '../../database';

@Injectable()
export class PostgresMembershipRepository {
  constructor(private readonly pg: PgPool) {}

  /**
   * Danh sách tenant_id user là member (ADR-046 amendment c — JWT.tenant_ids).
   * KHÔNG chọn "active" — active tenant là URL, không phải claim. Customer
   * global (không membership) → []. Sắp owner-trước rồi created_at để ổn định
   * (FE onboarding hiển thị theo thứ tự này).
   */
  async findTenantIds(userId: string): Promise<string[]> {
    const result = await this.pg.query<{ tenant_id: string }>(
      `SELECT tenant_id
         FROM tenant_memberships
        WHERE user_id = $1
        ORDER BY (role = 'owner') DESC, created_at ASC`,
      [userId],
    );
    return result.rows.map((r) => r.tenant_id);
  }

  /**
   * S-P0-01 T02 (ADR-046 amend c) — danh sách shop (tenant_id + slug + name)
   * user là member, cho FE onboarding/switcher hiển thị. JWT chỉ mang tenant_ids
   * (UUID) + httpOnly → FE KHÔNG đọc được; endpoint này join tenants để có
   * slug/name. Chỉ tenant active. owner-trước rồi created_at (ổn định).
   */
  async findTenants(userId: string): Promise<Array<{ tenant_id: string; slug: string; name: string }>> {
    const result = await this.pg.query<{ tenant_id: string; slug: string; name: string }>(
      `SELECT t.id AS tenant_id, t.slug AS slug, t.name AS name
         FROM tenant_memberships m
         JOIN tenants t ON t.id = m.tenant_id
        WHERE m.user_id = $1
          AND t.status = 'active'
        ORDER BY (m.role = 'owner') DESC, m.created_at ASC`,
      [userId],
    );
    return result.rows;
  }

  /**
   * Verify user là member của tenant — gate cho POST /auth/switch-tenant
   * (re-issue token chỉ khi membership hợp lệ; chống client tự khai tenant).
   */
  async isMember(userId: string, tenantId: string): Promise<boolean> {
    const result = await this.pg.query<{ one: number }>(
      `SELECT 1 AS one
         FROM tenant_memberships
        WHERE user_id = $1 AND tenant_id = $2
        LIMIT 1`,
      [userId, tenantId],
    );
    return result.rows.length > 0;
  }
}
