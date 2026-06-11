/**
 * `@icp/shared-types/tenant.ts`
 *
 * S-P0-01 T01 NEW — multi-tenant SaaS contract (ADR-040 + ADR-046).
 *
 * Single Source of Truth cho shape của `tenants` + `tenant_memberships` +
 * JWT active-tenant claim, dùng chung Gateway (resolve membership → JWT) ↔ FE
 * (switch-shop UI). Mirror V011 migration (`infra/migrations/V011__multi_tenant.sql`).
 *
 * **Dual access pattern** (giống cart/products):
 * - FE subpath: `import { TenantSchema } from '@icp/shared-types/tenant'`
 * - BE root:    `import { TenantSchema } from '@icp/shared-types'`
 *
 * **Mirror invariants** (sync khi schema DB đổi):
 * - `TenantStatusSchema` ↔ V011 `tenants.status CHECK`
 * - `MembershipRoleSchema` ↔ V011 `tenant_memberships.role CHECK`
 * - `ActiveTenantClaimSchema` ↔ ADR-046 amendment: JWT claim `tenant_id`
 *   = tenant đang active; customer GLOBAL → null (không có membership).
 */

import { z } from 'zod';

import { IsoDateSchema, UuidSchema } from './primitives';

/** Trạng thái tenant — mirror V011 `tenants.status` CHECK. */
export const TenantStatusSchema = z.enum(['active', 'suspended', 'archived']);
export type TenantStatus = z.infer<typeof TenantStatusSchema>;

/** Vai trò trong tenant — mirror V011 `tenant_memberships.role` CHECK. */
export const MembershipRoleSchema = z.enum(['owner', 'staff']);
export type MembershipRole = z.infer<typeof MembershipRoleSchema>;

/**
 * Tenant (shop). `slug` = DNS-safe key (subdomain/path) — V011 VARCHAR(63),
 * lowercase alnum + hyphen.
 */
export const TenantSchema = z.object({
  id: UuidSchema,
  slug: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'slug phải DNS-safe (a-z0-9-)'),
  name: z.string().min(1).max(120),
  status: TenantStatusSchema,
  created_at: IsoDateSchema,
});
export type Tenant = z.infer<typeof TenantSchema>;

/**
 * Membership merchant/staff ↔ tenant. Customer GLOBAL KHÔNG có row (ADR-046).
 * Khóa tự nhiên = (user_id, tenant_id).
 */
export const TenantMembershipSchema = z.object({
  user_id: UuidSchema,
  tenant_id: UuidSchema,
  role: MembershipRoleSchema,
  created_at: IsoDateSchema,
});
export type TenantMembership = z.infer<typeof TenantMembershipSchema>;

/**
 * JWT claim `tenant_id` = tenant đang active (ADR-046 amendment).
 * - merchant/staff: UUID tenant resolve từ membership lúc login.
 * - customer global: `null` (quyền mua hàng là quyền global, không scoped).
 * Switch shop = `POST /auth/switch-tenant` re-issue token (verify membership).
 * Precedence: JWT claim THẮNG header `X-Active-Tenant` (header chỉ là hint).
 */
export const ActiveTenantClaimSchema = UuidSchema.nullable();
export type ActiveTenantClaim = z.infer<typeof ActiveTenantClaimSchema>;
