/**
 * apps/web/app/intent-06/page.tsx — Placeholder for Intent 06 (Thanh toán).
 *
 * Slice:    S-05 T03 — placeholder per D-S05-06 LAW (state-B 3 CTAs routing target)
 * Mapping:  → /intent-06 → future S-06 V-SLICE owner (Payment flow)
 *
 * Cloned from `apps/web/app/intent-04/page.tsx` template per D-S05-06 LAW (T03b
 * placeholder pattern). Swap emoji to 💳 + title "Thanh toán (Intent 06)".
 *
 * Referenced from:
 *   - intent-05/page.tsx state-B EmptyState 3rd CTA "Thanh toán (Intent 06)" link
 *   - intent-05/page.tsx CartSummary checkout button (when stock OK + non-empty)
 *
 * S-05 T03 emit (Phiên Sx05-3 per D-S05-06 LAW).
 */

import Link from 'next/link';

export default function Intent06PlaceholderPage() {
  return (
    <div className="min-h-screen bg-pink-50/40 flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-4">💳</div>
      <h1 className="text-[20px] font-bold text-rose-900 mb-2">Thanh toán (Intent 06)</h1>
      <p className="text-[13px] text-pink-700 mb-6 max-w-xs">
        Tính năng thanh toán đang được phát triển. Vui lòng quay lại sau.
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
