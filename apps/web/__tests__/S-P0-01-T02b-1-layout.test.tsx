/**
 * apps/web/__tests__/S-P0-01-T02b-1-layout.test.tsx
 *
 * S-P0-01 T02b-1 (ADR-046 amend d) — StorefrontLayout validate slug ∈
 * membership: member render children; non-member → notFound(); đang load /
 * anonymous (data undefined) KHÔNG 404; 2 tenant không lẫn.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';

const notFoundMock = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound: () => notFoundMock() }));

let queryData: { tenants: { tenant_id: string; slug: string; name: string }[] } | undefined;
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: queryData }) }));

vi.mock('@icp/shared-types/api', () => ({
  AuthService: { landingControllerMyTenants: vi.fn() },
}));

vi.mock('@/lib/providers/tenant-provider', () => ({
  TenantProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tenant-provider">{children}</div>
  ),
}));

// Import sau mock (hoisted) để layout dùng bản mock.
import StorefrontLayout from '@/app/s/[slug]/layout';

describe('StorefrontLayout membership validation (ADR-046 amend d)', () => {
  beforeEach(() => {
    queryData = undefined;
    notFoundMock.mockClear();
  });

  it('renders children when the slug belongs to the user memberships', () => {
    queryData = { tenants: [{ tenant_id: '1', slug: 'demo', name: 'Demo' }] };
    const { getByText } = render(
      <StorefrontLayout params={{ slug: 'demo' }}>
        <span>child</span>
      </StorefrontLayout>,
    );
    expect(getByText('child')).toBeInTheDocument();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('calls notFound() when the slug is not in the user memberships', () => {
    queryData = { tenants: [{ tenant_id: '1', slug: 'other', name: 'Other' }] };
    expect(() =>
      render(
        <StorefrontLayout params={{ slug: 'demo' }}>
          <span>child</span>
        </StorefrontLayout>,
      ),
    ).toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalled();
  });

  it('does not 404 while the membership list is loading / anonymous (data undefined)', () => {
    queryData = undefined;
    const { getByText } = render(
      <StorefrontLayout params={{ slug: 'demo' }}>
        <span>child</span>
      </StorefrontLayout>,
    );
    expect(getByText('child')).toBeInTheDocument();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('keeps two tenants isolated — a member of tenant-a cannot open tenant-b', () => {
    queryData = { tenants: [{ tenant_id: 'a', slug: 'tenant-a', name: 'A' }] };
    expect(() =>
      render(
        <StorefrontLayout params={{ slug: 'tenant-b' }}>
          <span>x</span>
        </StorefrontLayout>,
      ),
    ).toThrow();
    expect(notFoundMock).toHaveBeenCalled();
  });
});
