'use client';

/**
 * apps/web/lib/providers/tracker-provider.tsx
 *
 * TrackerProvider — Client component that initializes the behavior Tracker
 * singleton once per browser tab and starts auto-flush ticker.
 *
 * Slice:    S-03 T05 — C-NN-T05-NEW-5 RESOLVED-INLINE (Phiên N+3)
 *
 * **Why this exists** (root cause C-NN-T05-NEW-5):
 *   T03b shipped `nav.tile_clicked` emit (Phiên 36 home/page.tsx) and T05
 *   ships `nav.settings_section_opened` × 3 stub routes + `error.report_requested`,
 *   but NO consumer ever called `getTracker(init)` with init params before
 *   first `getTracker().track(...)`. Per `tracker.ts:290`:
 *     `if (!init) throw new Error('getTracker(): init params required...')`.
 *   Result: every `track()` call threw → wrapped in try/catch → silent fail.
 *   DB verified Phiên N+3: 0 rows for `nav.*` events. Bug latent T03b ship,
 *   surfaced by T05 AC-37 DB verify smoke (Bước 4 Check 5).
 *
 * **Fix design** (Provider-mount init pattern):
 *   1. Mount in `app/layout.tsx` alongside QueryProvider + AuthProvider.
 *   2. Inside QueryProvider AND AuthProvider (last in chain) so the inner
 *      `<TrackerUserSync>` child can call `useMe()` to read user id.
 *   3. On mount: lazy-init Tracker singleton with sessionId (sessionStorage
 *      persist per tab lifetime) + appVersion + start auto-flush ticker.
 *   4. When `useMe` resolves user identity → `tracker.setUserId(me.id)` so
 *      subsequent events carry `user_id` (pseudonymized analytics).
 *   5. On unmount: `tracker.stop()` clears flush timer (StrictMode safe —
 *      `_tracker` singleton ref NOT reset, only timer killed).
 *
 * **sessionId persistence** (per browser tab):
 *   - Stored in `sessionStorage['icp_tracker_session_id']` to survive page
 *     navigations within the same tab (lifetime of the tab).
 *   - Closes tab → next tab gets new sessionId (matches user-session semantics
 *     per 07_BEHAVIOR_LOGS §7).
 *   - SSR-safe: `useState` lazy initializer wraps `typeof window` check;
 *     during SSR the init function isn't actually called because we wrap
 *     the whole tracker init in `useEffect` (client-only).
 *
 * **userId sync** (separate child component):
 *   Splits responsibility — outer `<TrackerProvider>` handles init+start
 *   without depending on auth context (decoupled). Inner `<TrackerUserSync>`
 *   reads useMe and updates tracker.setUserId — failures here don't block
 *   tracker start.
 *
 * Decisions applied:
 * - **D-04 (S-02)** — Auto-flush 5s LOCKED. Tracker.start() schedules ticker.
 * - **C-NN-T05-NEW-5** — Tracker init missing from app boot, resolved here.
 *
 * S-03 T05 emit (Phiên N+3 Bước 4 inline-fix — initial commit only after
 * Check 5 smoke surfaces 0-row DB anomaly via psql verify).
 */

import * as React from 'react';
import { getTracker } from '@/lib/tracker';
import { useMe } from '@/lib/dashboard/use-me';

const SESSION_STORAGE_KEY = 'icp_tracker_session_id';

/** Generate stable per-tab session id (uuid v4 prefix). Persists in
 *  sessionStorage so navigations within tab share the same id. */
function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') {
    // SSR fallback — should never be used because tracker init runs in
    // useEffect (client-only). Return throwaway value.
    return 'ssr-no-tracker';
  }
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
  } catch {
    // sessionStorage might throw in incognito/privacy modes — fall through.
  }
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `s-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, id);
  } catch {
    // Silent fail OK — tracker still works, just regenerates id per mount.
  }
  return id;
}

/**
 * Inner component — consumes useMe and pushes user identity to tracker.
 *
 * Split from outer so tracker init doesn't depend on auth resolution; events
 * fire as anonymous (`user_id: undefined`) until useMe resolves, then
 * subsequent events carry the user id per 07_BEHAVIOR_LOGS §9.1 (user_id
 * optional, pseudonymized).
 */
function TrackerUserSync({ children }: { children: React.ReactNode }) {
  const meQuery = useMe();
  const userId = meQuery.data?.id;

  React.useEffect(() => {
    if (userId === undefined) return;
    try {
      getTracker().setUserId(userId);
    } catch {
      // Tracker not initialized yet — shouldn't happen because outer effect
      // runs first, but guard anyway.
    }
  }, [userId]);

  return <>{children}</>;
}

export interface TrackerProviderProps {
  children: React.ReactNode;
}

export function TrackerProvider({ children }: TrackerProviderProps) {
  // **Init in useState lazy initializer** (runs synchronously in render phase,
  // BEFORE any child useEffect). This is critical because stub route pages
  // (`/me/{notifications,security,help}/page.tsx`) call `getTracker().track(...)`
  // in their useEffect → which fires BEFORE parent's useEffect (effects fire
  // bottom-up: child first, then parent). If we init in useEffect here, the
  // child stub page's track() call hits an uninitialized singleton → throws.
  //
  // Lazy init guard: `typeof window !== 'undefined'` skips SSR (getTracker
  // touches sessionStorage). React StrictMode double-render guard: getTracker
  // singleton itself is idempotent on repeat init params (returns cached).
  const [initialized] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false; // SSR: skip
    try {
      const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0';
      const sessionId = getOrCreateSessionId();
      // First call initializes singleton; subsequent calls return cached
      // (no re-init on StrictMode double-render).
      getTracker({ sessionId, appVersion });
      return true;
    } catch (err) {
      if (typeof console !== 'undefined') {
        console.error('TrackerProvider: failed to init tracker', err);
      }
      return false;
    }
  });

  // Start auto-flush ticker on mount (useEffect — needs browser timer).
  React.useEffect(() => {
    if (!initialized) return;
    try {
      getTracker().start();
    } catch (err) {
      if (typeof console !== 'undefined') {
        console.error('TrackerProvider: failed to start tracker', err);
      }
    }

    return () => {
      // Stop ticker on unmount (StrictMode double-mount safe — singleton
      // retained, only the auto-flush interval is cleared).
      try {
        getTracker().stop();
      } catch {
        // Tracker not init OR already stopped — silent OK.
      }
    };
  }, [initialized]);

  return <TrackerUserSync>{children}</TrackerUserSync>;
}
