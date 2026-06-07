'use client';

/**
 * apps/web/components/icp/organisms/SplashContent.tsx
 *
 * Organism: <SplashContent> — splash state-0 client component for `/` route.
 *
 * Slice:    S-03 T04 — Auth Pages
 *
 * Source:   `docs/mockups/intent-08/intent-08-state-0-splash.html` (159 LOC)
 *           Rule 6 MOCKUP IS LAW — pixel-fidelity render: phone-frame gradient
 *           bg, animated Brain SVG (240×240 with aura/synapse/4 satellite
 *           nodes), gradient brand "Aida", tagline "Hiểu — Học — Hành động",
 *           sub-tagline "Mỗi quyết định đều được kết nối thông minh",
 *           "Bắt đầu" CTA gradient button, 3 decorative pagination dots.
 *
 * Decisions applied:
 * - **D-14** — 3 pagination dots decorative verbatim mockup (NOT carousel, NOT
 *   remove). Dot 1 active gradient pink→orange; dots 2+3 inactive #FBCFE8.
 * - **D-15** — Brand literal "Aida" per mockup (cross-screen split with T03b
 *   DashboardHeader "ICP" intentional — Aida=UX brand, ICP=codebase namespace).
 * - **D-18** — "Bắt đầu" CTA uses Next.js <Link href="/auth/login"> for SPA
 *   nav (prefetch enabled; instant navigation; no full reload).
 *
 * Animation strategy:
 *   Inline keyframes via <style jsx> equivalent NOT used — instead reuse Tailwind
 *   `animate-pulse-ring` (T03b C-27 pattern lock) + custom utility classes for
 *   `brainGlow`/`nodePulse`/`pop`/`slideUp`/`btnBump` via globals.css OR inline
 *   `style={{ animation: ... }}` per mockup CSS (preserved verbatim).
 *
 *   Per C-18 Tier 4 Tailwind utility-first LAW: where Tailwind cannot express
 *   complex keyframes (e.g., `brainGlow` with both opacity + transform scale),
 *   use inline `style={{ animation: 'brainGlow 3s ...' }}` directly. Keyframes
 *   defined in globals.css (added T04 patch — see globals.css update).
 *
 * Layout per mockup:
 *   .phone-frame: gradient #FCE7F0→#FEEEE0→#FFF8F0, border-radius 24px, min-height 844px,
 *                 max-width 414px (mobile-first), centered with phone-frame border + shadow
 *   Status bar mock: 9:41 + signal/wifi/battery SVGs (color #831447)
 *   Main: flex column centered, padding 30px 24px 60px
 *   Brain: 240×240 animated SVG (gradients + 5 white synapse circles + 4 satellite pulse nodes)
 *   Brand: "Aida" 42px gradient pink→orange; "Hiểu — Học — Hành động" 11px uppercase letter-spacing
 *   Sub-tagline: "Mỗi quyết định đều được kết nối thông minh" 15px color #831447
 *   CTA: "Bắt đầu →" 14px gradient button bump animation
 *   Pagination: 3 dots bottom absolute, dot 1 = 22×3px active gradient, dots 2+3 = 6×3px inactive
 */

import Link from 'next/link';

export function SplashContent() {
  return (
    <div className="fixed inset-0 overflow-y-auto flex items-start justify-center bg-[#FDF2F4] px-[14px] py-6 lg:p-8 text-[#831447]">
      <div
        className="w-full max-w-[414px] rounded-3xl overflow-hidden flex flex-col relative
                   border-[0.5px] border-[#F9D8E4]
                   shadow-[0_20px_60px_rgba(233,30,99,0.18)] lg:shadow-[0_32px_80px_rgba(233,30,99,0.24)]"
        style={{
          background: 'linear-gradient(180deg, #FCE7F0 0%, #FEEEE0 40%, #FFF8F0 100%)',
          minHeight: 844,
        }}
      >
        {/* STATUS BAR (mock per mockup lines 56-74) */}
        <div className="flex justify-between items-center px-[22px] pt-[14px] flex-shrink-0 font-mono text-[13px] font-bold text-[#831447]">
          <span>9:41</span>
          <div className="flex gap-1.5 items-center">
            {/* Signal bars */}
            <svg width="16" height="11" viewBox="0 0 16 11" fill="none" aria-hidden="true">
              <rect x="0" y="6" width="2" height="4" rx="0.5" fill="#831447" />
              <rect x="4" y="4" width="2" height="6" rx="0.5" fill="#831447" />
              <rect x="8" y="2" width="2" height="8" rx="0.5" fill="#831447" />
              <rect x="12" y="0" width="2" height="10" rx="0.5" fill="#831447" />
            </svg>
            {/* Wi-Fi */}
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
              <path
                d="M7 9.5 L1 4 a8 8 0 0 1 12 0z"
                stroke="#831447"
                strokeWidth="1.2"
                fill="none"
                strokeLinejoin="round"
              />
            </svg>
            {/* Battery */}
            <div className="relative w-[22px] h-[11px] border border-[#831447] rounded-[3px] p-px">
              <div className="w-[80%] h-full bg-[#831447] rounded-[1px]" />
              <div className="absolute -right-[3px] top-[3px] w-[2px] h-[5px] bg-[#831447] rounded-r-[1px]" />
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-[30px] pb-[60px] relative">
          {/* BRAIN SVG 240×240 with pop animation */}
          <div className="mb-9" style={{ animation: 'splash-pop 0.7s ease-out backwards' }}>
            <svg width="240" height="240" viewBox="0 0 240 240" aria-hidden="true">
              <defs>
                <radialGradient id="splash-brainCore" cx="40%" cy="35%">
                  <stop offset="0%" stopColor="#FFE4E6" />
                  <stop offset="60%" stopColor="#F9A8D4" />
                  <stop offset="100%" stopColor="#BE185D" />
                </radialGradient>
                <radialGradient id="splash-aura" cx="50%" cy="50%">
                  <stop offset="0%" stopColor="rgba(233,30,99,0.4)" />
                  <stop offset="60%" stopColor="rgba(251,146,60,0.2)" />
                  <stop offset="100%" stopColor="rgba(251,146,60,0)" />
                </radialGradient>
                <radialGradient id="splash-brainHighlight" cx="35%" cy="30%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </radialGradient>
              </defs>

              {/* Aura with glow animation */}
              <circle
                cx="120"
                cy="120"
                r="106"
                fill="url(#splash-aura)"
                style={{ animation: 'splash-brainGlow 3s ease-in-out infinite' }}
              />

              {/* Brain core organic shape */}
              <path
                d="M 77 104 Q 69 86 86 77 Q 94 65 111 70 Q 120 58 132 66 Q 154 62 158 85 Q 172 94 162 111 Q 172 128 158 140 Q 154 158 132 158 Q 120 172 108 158 Q 86 158 82 140 Q 69 128 77 111 Z"
                fill="url(#splash-brainCore)"
                filter="drop-shadow(0 12px 26px rgba(190,24,93,0.4))"
              />

              {/* Highlight */}
              <path
                d="M 80 90 Q 110 100 140 90 Q 158 92 158 100 Q 158 108 140 108 Q 110 105 80 100 Z"
                fill="url(#splash-brainHighlight)"
                opacity="0.55"
              />

              {/* Synapse curves */}
              <path
                d="M 94 86 Q 120 95 137 86 M 86 112 Q 120 120 154 112 M 94 137 Q 120 130 137 137 M 120 72 Q 120 95 120 112 M 102 86 Q 106 120 102 146 M 137 86 Q 134 120 137 146"
                fill="none"
                stroke="#fff"
                strokeWidth="1.4"
                strokeLinecap="round"
                opacity="0.7"
              />

              {/* 5 white synapse nodes */}
              <circle cx="94" cy="86" r="3" fill="#fff" />
              <circle cx="137" cy="86" r="3" fill="#fff" />
              <circle cx="120" cy="112" r="3" fill="#fff" />
              <circle cx="102" cy="137" r="3" fill="#fff" />
              <circle cx="137" cy="137" r="3" fill="#fff" />

              {/* 4 satellite nodes with staggered pulse */}
              <circle
                cx="34"
                cy="72"
                r="4.5"
                fill="#E91E63"
                style={{ animation: 'splash-nodePulse 2s ease-in-out infinite' }}
              />
              <circle
                cx="34"
                cy="72"
                r="7"
                fill="#E91E63"
                opacity="0.25"
                style={{ animation: 'splash-nodePulse 2s ease-in-out infinite' }}
              />

              <circle
                cx="206"
                cy="86"
                r="4.5"
                fill="#FB923C"
                style={{ animation: 'splash-nodePulse 2s ease-in-out infinite 0.5s' }}
              />
              <circle
                cx="206"
                cy="86"
                r="7"
                fill="#FB923C"
                opacity="0.25"
                style={{ animation: 'splash-nodePulse 2s ease-in-out infinite 0.5s' }}
              />

              <circle
                cx="32"
                cy="168"
                r="4.5"
                fill="#E91E63"
                style={{ animation: 'splash-nodePulse 2s ease-in-out infinite 1s' }}
              />
              <circle
                cx="32"
                cy="168"
                r="7"
                fill="#E91E63"
                opacity="0.25"
                style={{ animation: 'splash-nodePulse 2s ease-in-out infinite 1s' }}
              />

              <circle
                cx="206"
                cy="180"
                r="4.5"
                fill="#FB923C"
                style={{ animation: 'splash-nodePulse 2s ease-in-out infinite 1.5s' }}
              />
              <circle
                cx="206"
                cy="180"
                r="7"
                fill="#FB923C"
                opacity="0.25"
                style={{ animation: 'splash-nodePulse 2s ease-in-out infinite 1.5s' }}
              />
            </svg>
          </div>

          {/* BRAND TEXT — "Aida" gradient pink→orange + tagline + sub-tagline */}
          <div style={{ animation: 'splash-slideUp 0.6s ease-out 0.3s backwards' }}>
            <div
              className="text-[42px] font-bold mb-2 leading-none tracking-[-1.2px] bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(135deg, #E91E63, #FB923C)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Aida
            </div>
            <div className="text-[11px] text-[#BE185D] font-bold uppercase mb-[18px] tracking-[3px]">
              Hiểu — Học — Hành động
            </div>
            <div className="text-[15px] text-[#831447] font-medium leading-[1.55] max-w-[260px] mx-auto">
              Mỗi quyết định
              <br />
              đều được kết nối thông minh
            </div>
          </div>

          {/* BẮT ĐẦU CTA — Next.js Link for SPA navigation (D-18 pattern) */}
          <Link
            href="/auth/login"
            className="mt-[42px] inline-flex items-center gap-2 px-11 py-3.5 rounded-[28px] text-white text-[14px] font-bold tracking-[0.3px] no-underline"
            style={{
              background: 'linear-gradient(135deg, #E91E63, #F43F5E)',
              boxShadow: '0 12px 28px rgba(233,30,99,0.42)',
              animation: 'splash-slideUp 0.6s ease-out 0.5s backwards, splash-btnBump 2.4s ease-in-out infinite',
            }}
          >
            Bắt đầu
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 12h14M13 18l6-6-6-6"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>

          {/* PAGINATION 3 DOTS — decorative D-14 (NOT carousel, NOT remove) */}
          <div
            className="absolute bottom-[42px] left-0 right-0 flex justify-center gap-1.5"
            style={{ animation: 'splash-slideUp 0.6s ease-out 0.7s backwards' }}
            aria-hidden="true"
          >
            <div
              className="h-[3px] w-[22px] rounded-sm"
              style={{ background: 'linear-gradient(90deg, #E91E63, #FB923C)' }}
            />
            <div className="h-[3px] w-[6px] rounded-sm bg-[#FBCFE8]" />
            <div className="h-[3px] w-[6px] rounded-sm bg-[#FBCFE8]" />
          </div>
        </div>
      </div>
    </div>
  );
}
