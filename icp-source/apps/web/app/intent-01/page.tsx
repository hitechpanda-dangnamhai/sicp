/**
 * apps/web/app/intent-01/page.tsx — Placeholder for Intent 01 (Image AI / Nhập hàng).
 *
 * Slice:    S-03 T03b — Home Dashboard hub (placeholder routes per R1 mapping)
 * Mapping:  Hero tile "Nhập hàng" → /intent-01 → future S-07 V-SLICE owner
 *
 * Per S-03 D-11 + C-23 LOCKED Phiên 35 — 6 placeholder routes provide post-Dashboard
 * navigation target until V-SLICE V-07 (Image AI) ships real Intent 01 flow.
 * Each route renders minimal "Coming soon" stub.
 *
 * **Why explicit per-route files (vs catch-all `[intent]/page.tsx` dynamic route)**:
 *   - Static route auto-included in Next.js build manifest (better dev DX, hot reload)
 *   - V-SLICE consumer (S-07) replaces THIS file with real page logic — no
 *     dynamic-route refactoring needed
 *   - middleware.ts `config.matcher` already lists each route explicitly
 *
 * Auth-gated per middleware (`apps/web/middleware.ts`) — accessible only with
 * valid `icp_session` cookie. Otherwise redirect to /auth/login.
 *
 * S-03 T03b emit (Phiên 36 Batch 5).
 */

import Link from 'next/link';

export default function Intent01PlaceholderPage() {
  return (
    <div className="min-h-screen bg-pink-50/40 flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-4">📷</div>
      <h1 className="text-[20px] font-bold text-rose-900 mb-2">Nhập hàng (Intent 01)</h1>
      <p className="text-[13px] text-pink-700 mb-6 max-w-xs">
        Tính năng chụp ảnh nhận diện sản phẩm đang được phát triển. Vui lòng quay lại sau.
      </p>
      <Link
        href="/home"
        className="bg-gradient-to-r from-pink-600 to-orange-400 text-white text-[13px] font-semibold px-5 py-2.5 rounded-full shadow-[0_6px_16px_rgba(233,30,99,0.25)]"
      >
        ← Trang chính
      </Link>
    </div>
  );
}
