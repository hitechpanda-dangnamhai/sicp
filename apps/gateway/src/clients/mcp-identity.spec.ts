/**
 * apps/gateway/src/clients/mcp-identity.spec.ts
 *
 * S-P0-01 T02c — unit cho buildMcpIdentityHeaders: build X-User-Id +
 * X-Tenant-Id; bỏ X-Tenant-Id khi tenant null (customer global); rỗng khi vắng.
 */

import { describe, it, expect } from 'vitest';
import { buildMcpIdentityHeaders } from './mcp-identity';

describe('buildMcpIdentityHeaders', () => {
  it('builds both headers when user + tenant present', () => {
    const h = buildMcpIdentityHeaders({ userId: 'u-1', tenantId: 't-1' });
    expect(h).toEqual({ 'x-user-id': 'u-1', 'x-tenant-id': 't-1' });
  });

  it('omits X-Tenant-Id when tenant null (customer global)', () => {
    const h = buildMcpIdentityHeaders({ userId: 'u-1', tenantId: null });
    expect(h).toEqual({ 'x-user-id': 'u-1' });
    expect(h['x-tenant-id']).toBeUndefined();
  });

  it('returns empty object when identity absent (unwired caller)', () => {
    expect(buildMcpIdentityHeaders(undefined)).toEqual({});
  });
});
