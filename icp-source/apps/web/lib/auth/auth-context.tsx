'use client';

/**
 * apps/web/lib/auth/auth-context.tsx
 *
 * AuthProvider + useAuth() — Parallel API to TanStack `useMe()` per D-21.
 *
 * Slice:    S-03 T04 — Auth Pages
 *
 * **Architecture decision (D-21):**
 *   AuthContext internally CONSUMES `useMe()` TanStack hook (single source of
 *   truth = QueryClient cache). Exposes same user identity via React Context API
 *   for consumers who prefer Context pattern (deep prop-drilling avoidance)
 *   instead of calling useMe() hook directly.
 *
 *   → NO drift risk — both APIs read same QueryClient cache.
 *
 * **Consumer flexibility patterns:**
 *   - `const { user, isLoading } = useAuth()` → React Context consumer
 *   - `const meQuery = useMe()` → TanStack hook consumer (T03b precedent)
 *
 * **Why both APIs:** V-SLICE S-04..S-10 consumers may need user identity in
 * deeply nested components (avoid prop-drilling); Context API simpler. T03b
 * DashboardHeader already uses useMe() direct — pattern preserved.
 *
 * **Wrap position in layout.tsx**:
 *   <QueryProvider>          ← T03b owner (singleton QueryClient)
 *     <AuthProvider>         ← T04 owner (consumes useMe internally)
 *       {children}
 *
 *   AuthProvider depends on QueryClient → must be INSIDE QueryProvider.
 *
 * **Type shape (subset of MeResponseDto)** — re-export shared-types directly.
 *
 * **SSR caveat:** Server-rendered children see `user: undefined` initially
 * (useMe returns loading state on client mount). For protected routes, rely on
 * middleware cookie check (already T03b shipped) — NOT on useAuth() during SSR.
 *
 * S-03 T04 emit per D-21 LOCKED.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { MeResponseDto } from '@icp/shared-types/api';
import { useMe } from '@/lib/dashboard/use-me';

/**
 * AuthContextValue — shape exposed by `useAuth()` hook.
 *
 * Mirrors `useMe()` UseQueryResult subset most consumers need:
 *   - `user`: MeResponseDto | undefined (undefined while loading/unauth)
 *   - `isLoading`: query in-flight (initial mount or after invalidate)
 *   - `isError`: query failed (401 = logged out; cookie expired/revoked)
 *   - `error`: Error object if isError
 */
export interface AuthContextValue {
  user: MeResponseDto | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider — wraps children + provides AuthContext value derived from useMe().
 *
 * Must be rendered INSIDE QueryProvider (depends on QueryClient).
 * Pattern: layout.tsx → <QueryProvider><AuthProvider>{children}</AuthProvider></QueryProvider>
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const meQuery = useMe();

  const value: AuthContextValue = {
    user: meQuery.data,
    isLoading: meQuery.isLoading,
    isError: meQuery.isError,
    error: meQuery.error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth — hook reading AuthContext.
 *
 * @throws Error if called outside <AuthProvider> (developer mistake).
 *
 * @example
 *   const { user, isLoading } = useAuth();
 *   if (isLoading) return <Spinner />;
 *   if (!user) return <SignedOutView />;
 *   return <div>Hello, {user.display_name}</div>;
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error(
      'useAuth() must be called inside <AuthProvider>. Wrap your app in <AuthProvider> at layout.tsx (inside <QueryProvider>).',
    );
  }
  return ctx;
}
