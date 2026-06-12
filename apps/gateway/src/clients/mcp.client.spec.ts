/**
 * apps/gateway/src/clients/mcp.client.spec.ts
 *
 * S-P0-01 T02c — McpClient.call() forward identity header X-User-Id/X-Tenant-Id
 * (ADR-047 amend) trên outbound /rpc; vắng identity → không gửi.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { McpClient } from './mcp.client';

function okResponse(): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ jsonrpc: '2.0', result: { ok: true }, id: 1 }),
  } as unknown as Response;
}

function lastFetchHeaders(spy: ReturnType<typeof vi.fn>): Record<string, string> {
  return (spy.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
}

describe('McpClient.call identity headers (T02c)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends X-User-Id + X-Tenant-Id when identity provided', async () => {
    const fetchSpy = vi.fn(async () => okResponse());
    vi.stubGlobal('fetch', fetchSpy);

    await new McpClient().call('cards.list_pending', { user_id: 'u-1' }, {
      userId: 'u-1',
      tenantId: 't-1',
    });

    const headers = lastFetchHeaders(fetchSpy);
    expect(headers['x-user-id']).toBe('u-1');
    expect(headers['x-tenant-id']).toBe('t-1');
  });

  it('T03d: luôn gửi X-Tenant-Id khi có identity (tenant strict, non-null)', async () => {
    const fetchSpy = vi.fn(async () => okResponse());
    vi.stubGlobal('fetch', fetchSpy);

    await new McpClient().call('cards.list_pending', {}, { userId: 'u-1', tenantId: 't-7' });

    const headers = lastFetchHeaders(fetchSpy);
    expect(headers['x-user-id']).toBe('u-1');
    expect(headers['x-tenant-id']).toBe('t-7');
  });

  it('sends no identity header when identity omitted (backward compatible)', async () => {
    const fetchSpy = vi.fn(async () => okResponse());
    vi.stubGlobal('fetch', fetchSpy);

    await new McpClient().call('system.list_tools', {});

    const headers = lastFetchHeaders(fetchSpy);
    expect(headers['x-user-id']).toBeUndefined();
    expect(headers['x-tenant-id']).toBeUndefined();
  });
});
