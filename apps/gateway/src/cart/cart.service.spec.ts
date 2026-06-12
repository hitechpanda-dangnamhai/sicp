/**
 * apps/gateway/src/cart/cart.service.spec.ts
 *
 * S-P0-01 T02c — CartService raw-fetch client forward identity header
 * X-User-Id/X-Tenant-Id qua 7 cart.* tool; GIỮ user_id trong params (2-phase).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { CartService } from './cart.service';

function okResponse(): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ jsonrpc: '2.0', result: {}, id: 'x' }),
  } as unknown as Response;
}

function lastFetch(spy: ReturnType<typeof vi.fn>): { headers: Record<string, string>; body: any } {
  const init = spy.mock.calls[0][1] as RequestInit;
  return {
    headers: init.headers as Record<string, string>,
    body: JSON.parse(init.body as string),
  };
}

describe('CartService identity headers (T02c)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('forwards X-User-Id + X-Tenant-Id on cart.get', async () => {
    const fetchSpy = vi.fn(async () => okResponse());
    vi.stubGlobal('fetch', fetchSpy);

    await new CartService().get('u-1', 't-1');

    const { headers, body } = lastFetch(fetchSpy);
    expect(headers['x-user-id']).toBe('u-1');
    expect(headers['x-tenant-id']).toBe('t-1');
    // 2-phase: user_id GIỮ trong params song song.
    expect(body.params.user_id).toBe('u-1');
    expect(body.method).toBe('cart.get');
  });

  it('omits X-Tenant-Id when tenant null (global)', async () => {
    const fetchSpy = vi.fn(async () => okResponse());
    vi.stubGlobal('fetch', fetchSpy);

    await new CartService().clear('u-2', null);

    const { headers } = lastFetch(fetchSpy);
    expect(headers['x-user-id']).toBe('u-2');
    expect(headers['x-tenant-id']).toBeUndefined();
  });

  it('forwards identity on cart.update_qty (addItem path) with tenant', async () => {
    const fetchSpy = vi.fn(async () => okResponse());
    vi.stubGlobal('fetch', fetchSpy);

    await new CartService().addItem('u-3', 't-3', 'prd-1', 2);

    const { headers, body } = lastFetch(fetchSpy);
    expect(headers['x-user-id']).toBe('u-3');
    expect(headers['x-tenant-id']).toBe('t-3');
    expect(body.params.product_id).toBe('prd-1');
  });
});
