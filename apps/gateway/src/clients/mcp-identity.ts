/**
 * apps/gateway/src/clients/mcp-identity.ts
 *
 * S-P0-01 T02c (ADR-047 amend 2026-06-12) — NƠI DUY NHẤT build identity header
 * `X-User-Id` + `X-Tenant-Id` cho MỌI caller Gateway→MCP /rpc.
 *
 * Gateway = security perimeter resolve user_id (JWT) + tenant_id (URL header,
 * TenantResolverService) → forward qua header. MCP tin header (KHÔNG verify JWT,
 * cùng pattern Gateway→AI của T02). `tenantId` null = customer global → bỏ
 * `X-Tenant-Id` (giống `ai.client.ts` forwardHeaders).
 *
 * **2-PHASE:** T02c CHỈ THÊM header (MCP chưa enforce → header thừa vô hại);
 * params `user_id` GIỮ song song, xoá ở T03 khi MCP đọc header + fail-closed
 * (ADR-047 amend c). Áp vào CẢ 2 client: `mcp.client.ts` (cards/products/
 * suggest-attrs/dashboard) + `cart/cart.service.ts` raw-fetch (7 cart.* tool).
 */

export interface McpIdentity {
  userId: string;
  /**
   * S-P0-01 T03d: tenantId BẮT BUỘC non-null. Sau khi Gateway siết tenant
   * strict (mọi controller resolve() — merchant + cart đều ném 400 khi thiếu
   * header), MỌI call Gateway→MCP có tenant hiện diện → buildMcpIdentityHeaders
   * luôn phát X-Tenant-Id (bỏ nhánh skip-khi-null của T02c). Type này ép compiler
   * bắt mọi call-site truyền tenant non-null.
   */
  tenantId: string;
}

/** Header thuần cho outbound MCP call. Rỗng khi vắng identity (caller cũ chưa wire). */
export function buildMcpIdentityHeaders(identity?: McpIdentity): Record<string, string> {
  if (!identity?.userId) return {};
  // T03d: luôn gửi CẢ 2 header (tenant strict ở Gateway — tenant luôn hiện diện).
  return { 'x-user-id': identity.userId, 'x-tenant-id': identity.tenantId };
}
