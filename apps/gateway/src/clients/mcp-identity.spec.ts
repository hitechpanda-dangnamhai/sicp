/**
 * apps/gateway/src/clients/mcp-identity.spec.ts
 *
 * S-P0-01 T03d — unit cho buildMcpIdentityHeaders: LUÔN build CẢ X-User-Id +
 * X-Tenant-Id (Gateway siết tenant strict → tenant non-null; bỏ nhánh skip-khi-null
 * của T02c). Rỗng khi vắng identity (caller chưa wire).
 */

import { describe, it, expect } from 'vitest';
import { buildMcpIdentityHeaders } from './mcp-identity';

describe('buildMcpIdentityHeaders', () => {
  it('builds both headers when user + tenant present', () => {
    const h = buildMcpIdentityHeaders({ userId: 'u-1', tenantId: 't-1' });
    expect(h).toEqual({ 'x-user-id': 'u-1', 'x-tenant-id': 't-1' });
  });

  it('always emits X-Tenant-Id (T03d: tenant strict, non-null) — không còn skip', () => {
    const h = buildMcpIdentityHeaders({ userId: 'u-2', tenantId: 't-9' });
    expect(h['x-tenant-id']).toBe('t-9');
    expect(h['x-user-id']).toBe('u-2');
  });

  it('returns empty object when identity absent (unwired caller)', () => {
    expect(buildMcpIdentityHeaders(undefined)).toEqual({});
  });
});
