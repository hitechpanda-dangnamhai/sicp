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
  tenantId: string | null;
}

/** Header thuần cho outbound MCP call. Rỗng khi vắng identity (caller cũ chưa wire). */
export function buildMcpIdentityHeaders(identity?: McpIdentity): Record<string, string> {
  if (!identity?.userId) return {};
  const headers: Record<string, string> = { 'x-user-id': identity.userId };
  if (identity.tenantId) headers['x-tenant-id'] = identity.tenantId;
  return headers;
}
