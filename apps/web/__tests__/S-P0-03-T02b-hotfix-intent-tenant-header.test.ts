/**
 * apps/web/__tests__/S-P0-03-T02b-hotfix-intent-tenant-header.test.ts
 *
 * S-P0-03/T02b-hotfix — FE intent POST attach X-Tenant-Id.
 *
 * Regression (phát hiện T02b-2 spike): 6 intent stream-hook POST /api/v1/intent
 * THIẾU X-Tenant-Id → BE 400 TENANT_CONTEXT_MISSING (resolver HEADER-ONLY,
 * ADR-046 amend c LOCKED). Fix: hook attach `...tenantHeaders()` (nguồn
 * getActiveTenantId). Test representative = use-search-stream (cả 6 hook cùng
 * pattern). Tenant-gate: active-tenant set → header có; vắng → header vắng (BE 400).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/lib/tenant-context', () => ({ getActiveTenantId: vi.fn() }));
vi.mock('@/lib/sse-client', () => ({ streamIntent: vi.fn(() => () => {}) }));

import { getActiveTenantId } from '@/lib/tenant-context';
import { useSearchStream } from '@/src/features/search/use-search-stream';

const mockGetTenant = vi.mocked(getActiveTenantId);
const DEMO = '11111111-1111-1111-1111-111111111111';

describe('T02b-hotfix — intent POST attach X-Tenant-Id (use-search-stream)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 202, json: async () => ({ request_id: 'r1' }) });
    vi.stubGlobal('fetch', fetchMock);
    mockGetTenant.mockReset();
  });

  it('attaches X-Tenant-Id when active tenant set (→ BE resolve, no 400)', async () => {
    mockGetTenant.mockReturnValue(DEMO);
    const { result } = renderHook(() => useSearchStream());
    await act(async () => {
      await result.current.submitQuery('nước mắm');
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/intent',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Tenant-Id': DEMO }),
      }),
    );
  });

  it('omits X-Tenant-Id when no active tenant (tenant-gate: BE → 400 đúng scope)', async () => {
    mockGetTenant.mockReturnValue(null);
    const { result } = renderHook(() => useSearchStream());
    await act(async () => {
      await result.current.submitQuery('test');
    });
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['X-Tenant-Id']).toBeUndefined();
  });
});
