/**
 * apps/web/app/layout.tsx — Root Layout
 *
 * Slice:    S-00b Foundation Scaffold (T08)
 * Source:   slices/S-00b_EXECUTION_GUIDE.md Section 4.8 lines 2465-2481.
 *
 * Minimal scaffold:
 * - `<html lang="vi">` — Vietnamese locale (00_CONTEXT.md Section 9).
 * - Imports `globals.css` for MoMo design tokens + Tailwind base.
 * - Metadata title + description for browser tab + SEO baseline.
 *
 * Deferred to S-02 (NOT in T08):
 * - QueryProvider wrap (TanStack Query — ADR-035).
 * - AuthContext provider.
 * - Toaster (notifications — S-01 H-UI).
 * - next/font Be Vietnam Pro loader (S-01 H-UI styles `--font-be-vietnam`).
 * - Behavior tracker init (`lib/tracker.ts` — S-02).
 */
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ICP — Intelligent Commerce Platform',
  description: 'AI-powered shop assistant',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
