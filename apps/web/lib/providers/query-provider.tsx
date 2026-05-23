/**
 * QueryProvider — TanStack Query Provider with singleton QueryClient.
 *
 * Slice:    S-03 T03b — Home Dashboard hub
 * Decision: T03b OWNS creation per C-26 RESOLVED Phiên 35 (NOT EXISTS in app/layout
 *           pre-T03b; future T04 + V-SLICE consumers reuse).
 *
 * **Singleton QueryClient pattern** (TanStack docs SSR best-practice):
 *   - `useState(() => new QueryClient())` instead of module-level `new QueryClient()`
 *   - Each browser tab gets ONE client; suspended/streamed React tree shares it
 *   - Prevents data leak across users in SSR multi-tenant deployments
 *
 * **OpenAPI codegen cookie config**:
 *   - `OpenAPI.WITH_CREDENTIALS = true` — send icp_session cookie cross-origin
 *     (Web at :3000 + Gateway at :3001 = cross-origin in dev; CORS allowed
 *     per gateway main.ts `enableCors({ credentials: true })` per S-02)
 *   - `OpenAPI.CREDENTIALS = 'include'` — fetch credentials mode
 *   - `OpenAPI.BASE` — env-driven override; defaults `http://localhost:3001`
 *     per codegen (works dev). Production rebuild generates with prod URL.
 *
 * **Defaults per `useStats` + `useMe` pattern**:
 *   - `staleTime: 30s` — stats don't change often (stub anyway); UI feels snappy
 *   - `refetchOnWindowFocus: false` — avoid surprise refetches during demo
 *   - `retry: 1` — auth-protected endpoints; 401 means logged out, retry pointless
 *
 * CLIENT component — `'use client'` for hooks usage (QueryClientProvider needs
 * React context, only works client-side).
 *
 * @see https://tanstack.com/query/v5/docs/framework/react/guides/ssr
 *
 * S-03 T03b emit (Phiên 36 Batch 5) per C-26 RESOLVED.
 */

'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OpenAPI } from '@icp/shared-types/api';

// Configure OpenAPI codegen client to send icp_session cookie cross-origin.
// Side-effect runs ONCE on module load (top-level mutation safe — OpenAPI is
// a singleton config object per codegen).
if (typeof window !== 'undefined') {
  OpenAPI.WITH_CREDENTIALS = true;
  OpenAPI.CREDENTIALS = 'include';
  // BASE remains codegen default 'http://localhost:3001' for dev;
  // Override via NEXT_PUBLIC_GATEWAY_URL if needed at consumer init.
  if (process.env.NEXT_PUBLIC_GATEWAY_URL) {
    OpenAPI.BASE = process.env.NEXT_PUBLIC_GATEWAY_URL;
  }
}

export interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // Per-tab singleton — useState lazy init only runs once per mount.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
