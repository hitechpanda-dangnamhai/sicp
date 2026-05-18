// =============================================================================
// apps/web/next.config.js — ICP Web (Next.js 14.2) production config
// =============================================================================
// Slice:    S-00b Foundation Scaffold (T08)
//
// Source:   slices/S-00b_EXECUTION_GUIDE.md Section 4.8 lines 2530-2536.
//
// Decisions:
// - D-03 LOCKED  — Next.js 14.2.x pin (avoid Next 15 + React 19 breaking changes).
// - `output: 'standalone'` REQUIRED — produces self-contained server.js +
//   minimal node_modules under .next/standalone, consumed by multi-stage
//   Dockerfile (`apps/web/Dockerfile` runner stage). Without this, Dockerfile
//   `node apps/web/server.js` would not exist.
//
// Deferred to S-02 / Phase 06 (NOT touched in T08):
// - images.domains / images.remotePatterns
// - headers() / rewrites() / redirects()
// - i18n config (Vietnamese-only locale already in app/layout.tsx `lang="vi"`)
// - env exposure (NEXT_PUBLIC_* already loaded via .env.example at runtime)
// - experimental.serverActions (S-02 may enable for form-heavy intents)
// =============================================================================

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
};

module.exports = nextConfig;
