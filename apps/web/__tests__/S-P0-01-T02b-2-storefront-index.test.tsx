/**
 * apps/web/__tests__/S-P0-01-T02b-2-storefront-index.test.tsx
 *
 * S-P0-01 T02b-2 (carry-over) — base page `/s/<slug>` redirect sang
 * `/s/<slug>/home` qua tenantHref (KHÔNG hardcode /s/). Fix bare /s/<slug> 404
 * (đích switch-tenant redirect_url + landing).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const redirectMock = vi.fn();
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirectMock(url) }));

import StorefrontIndexPage from '@/app/s/[slug]/page';

describe('StorefrontIndexPage (T02b-2 carry-over)', () => {
  beforeEach(() => redirectMock.mockClear());

  it('redirects bare /s/<slug> to the slug-scoped /home hub', () => {
    StorefrontIndexPage({ params: { slug: 'demo' } });
    expect(redirectMock).toHaveBeenCalledWith('/s/demo/home');
  });

  it('keeps two tenants isolated — redirect carries the requested slug', () => {
    StorefrontIndexPage({ params: { slug: 'tenant-b' } });
    expect(redirectMock).toHaveBeenCalledWith('/s/tenant-b/home');
  });
});
