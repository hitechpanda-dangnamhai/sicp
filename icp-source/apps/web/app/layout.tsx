/**
 * apps/web/app/layout.tsx — Root layout with Be Vietnam Pro font loader.
 *
 * Slice:    S-01 UI Foundation (T02) — fonts. Extended S-03 T03b (Phiên 36)
 *           — `<QueryProvider>` wrap per C-26 RESOLVED Phiên 35.
 *           Extended S-03 T04 — `<AuthProvider>` wrap per D-21 LOCKED
 *           (parallel API to TanStack useMe for V-SLICE consumer flexibility).
 *
 * Source:   docs/phases/PHASE_00_DESIGN_SYSTEM.md Section 2 (Typography).
 *           T01 KI-3 deferred font loader → T02 implements.
 *
 * Pattern:  next/font/google self-hosted via Next.js automatic optimization.
 *           Sets `--font-be-vietnam-pro` CSS var on <body>; globals.css consumes
 *           via `--font-sans` already pointing to 'Be Vietnam Pro' name (T01).
 *
 * **Provider nesting order (T04 update)**:
 *   <QueryProvider>            ← T03b: singleton QueryClient + OpenAPI config
 *     <AuthProvider>           ← T04: consumes useMe internally, exposes Context
 *       {children}
 *
 * AuthProvider depends on QueryClient (via useMe → useQuery) → MUST be inside
 * QueryProvider. Reverse order throws "useQuery outside provider" error.
 *
 * Why CSS variable strategy: future flexibility if T03+ needs theme switching
 * without touching layout. Tailwind's font-sans utility will inherit through
 * --font-sans CSS var chain.
 *
 * Note: Be Vietnam Pro Variable not available in next/font/google as of 2026-05;
 *       fall back to weighted versions (400/500/600/700) covering type scale.
 */

import type { Metadata } from 'next';
import { Be_Vietnam_Pro, JetBrains_Mono } from 'next/font/google';
import { QueryProvider } from '@/lib/providers/query-provider';
import { AuthProvider } from '@/lib/auth/auth-context';
import './globals.css';

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-be-vietnam-pro',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Aida — Intelligent Commerce Platform',
  description: 'Hiểu — Học — Hành động. Trợ lý AI thông minh cho thương mại.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`${beVietnamPro.variable} ${jetbrainsMono.variable}`}>
      <body>
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
