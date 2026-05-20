// =============================================================================
// apps/web/tailwind.config.ts — Tailwind v3.4 config for ICP Web
// =============================================================================
// Slice:    S-01 UI Foundation
// Task:     T01 Tokens + Utility Foundation
//           T02 PATCH — add icp-green ramp (C-11) + shadcn semantic tokens (C-12)
//           T06 PATCH — add errorPulse keyframe + 'error-pulse' animation (C-26 Q-Final-A)
//           T07 PATCH — extend content array with stories/**/*.{ts,tsx} (ST-NEW-1)
//
// Source:   docs/phases/PHASE_00_DESIGN_SYSTEM.md Sections 1.3-1.6 (color ramps),
//                                                Section 5 (Motion) +
//           reports/S-01_SEMANTIC_COMPONENTS.md Section 1.1 (16 keyframes).
//           docs/handoff/PHASE_00_CROSS_INTENT_PATTERNS.md §3.1 (trend-green C-11)
//           components/ui/{button,input,badge,...}.tsx (shadcn HSL semantics C-12)
//
// Decisions:
// - D-03 LOCKED — Tailwind 3.4.x pin (NOT v4).
// - D-04        — Hybrid animation: 16 keyframes CSS-only path (registered here).
//                 Framer Motion defer T04 (MicButton), T06 (BottomSheet, ChartCard).
// - C-09        — Vitest substitution: no Jest plugin needed in Tailwind config.
// - C-11        — Trend-green ramp added (T02). MoMo palette extension per
//                 CROSS_INTENT_PATTERNS §3.1. CSS vars in globals.css :root.
// - C-12        — Shadcn HSL semantic tokens added (background/foreground/primary/
//                 secondary/destructive/muted/accent/border/input/ring). Maps via
//                 hsl(var(--name)) consumed by shadcn primitives in components/ui/.
//                 HSL 3-value format in globals.css :root.
// - C-18        — Tier 4 lock: NO `@layer components` classes. Content path
//                 extension below is Tier 1 base config scope, not Tier 4 — safe.
// - ST-NEW-1    — T07 stories at apps/web/stories/** — outside default scan paths.
//                 Extend content array so Tailwind picks up utility classes used in
//                 story files. Without this, story-only utilities tree-shake out at
//                 build, breaking Storybook visual fidelity.
//
// Extends:
// - S-00b T08 baseline (pink ramp only) → T01 added rose/orange/amber + 16
//   keyframes + 16 animations + data-state variant plugin → T02 added green ramp +
//   shadcn semantic tokens → T06 added errorPulse keyframe → T07 adds stories
//   content scan path.
//
// Notes:
// - Theme `extend.colors` maps CSS vars (defined in `app/globals.css`). Tailwind
//   classes like `bg-icp-pink-600` resolve to `var(--pink-600)` at runtime.
// - `keyframes` keys camelCase per Tailwind v3 convention; `animation` aliases
//   kebab-case to match utility class names in `globals.css` @layer utilities.
// - Shadcn semantic tokens use hsl(var(--token)) pattern so bg-primary/90 opacity
//   modifier works (Tailwind v3 alpha-value plugin).
// - T07 content scan: `./stories/**/*.{ts,tsx}` picks up Storybook story files.
//   Tailwind purge in production build needs to see classes used in stories to
//   keep them. Safe because stories share globals.css via .storybook/preview.ts.
// =============================================================================

import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx,mdx}',
    './components/**/*.{ts,tsx}',
    './stories/**/*.{ts,tsx}', // T07 — Storybook stories utility scan (ST-NEW-1)
  ],
  theme: {
    extend: {
      colors: {
        // === Section 1.3 Pink Ramp (PRIMARY 70%) =============================
        'icp-pink': {
          50: 'var(--pink-50)',
          100: 'var(--pink-100)',
          200: 'var(--pink-200)',
          300: 'var(--pink-300)',
          400: 'var(--pink-400)',
          500: 'var(--pink-500)',
          600: 'var(--pink-600)',
          700: 'var(--pink-700)',
          800: 'var(--pink-800)',
          900: 'var(--pink-900)',
        },
        // === Section 1.4 Rose Ramp (Secondary primary) =======================
        'icp-rose': {
          50: 'var(--rose-50)',
          100: 'var(--rose-100)',
          200: 'var(--rose-200)',
          500: 'var(--rose-500)',
          600: 'var(--rose-600)',
          700: 'var(--rose-700)',
          800: 'var(--rose-800)',
        },
        // === Section 1.5 Orange Ramp (Accent 20%) ============================
        'icp-orange': {
          50: 'var(--orange-50)',
          100: 'var(--orange-100)',
          200: 'var(--orange-200)',
          300: 'var(--orange-300)',
          400: 'var(--orange-400)',
          500: 'var(--orange-500)',
          600: 'var(--orange-600)',
          700: 'var(--orange-700)',
          800: 'var(--orange-800)',
          900: 'var(--orange-900)',
        },
        // === Section 1.6 Amber Ramp (10%) — note no 600 stop per spec ========
        'icp-amber': {
          50: 'var(--amber-50)',
          100: 'var(--amber-100)',
          200: 'var(--amber-200)',
          300: 'var(--amber-300)',
          400: 'var(--amber-400)',
          500: 'var(--amber-500)',
          700: 'var(--amber-700)',
          800: 'var(--amber-800)',
          900: 'var(--amber-900)',
        },
        // === Section 1.6b Trend-Green Ramp (C-11 T02 amendment) ==============
        // Source: PHASE_00_CROSS_INTENT_PATTERNS.md §3.1 LOCKED.
        // Note: no 300/400/800 stops per §3.1 spec — keep parity.
        'icp-green': {
          50: 'var(--trend-green-50)',
          100: 'var(--trend-green-100)',
          200: 'var(--trend-green-200)',
          500: 'var(--trend-green-500)',
          600: 'var(--trend-green-600)',
          700: 'var(--trend-green-700)',
          900: 'var(--trend-green-900)',
        },
        // === Semantic surface tokens =========================================
        'icp-bg': {
          page: 'var(--bg-page-frame)',
          frame: 'var(--bg-page-frame)',
          surface: 'var(--bg-surface)',
          tinted: 'var(--bg-tinted)',
        },
        'icp-text': {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          muted: 'var(--text-muted)',
          'on-color': 'var(--text-on-color)',
          'on-light': 'var(--text-on-light)',
        },
        'icp-border': {
          subtle: 'var(--border-subtle)',
          pink: 'var(--border-pink)',
          orange: 'var(--border-orange)',
          divider: 'var(--border-divider)',
        },

        // === Section 6 Shadcn Semantic Tokens (C-12 T02 amendment) ===========
        // Maps shadcn primitives (button/input/badge/dialog/sheet/form) HSL
        // tokens to MoMo palette via globals.css :root mapping.
        //
        // hsl(var(--name)) pattern enables Tailwind v3 opacity modifiers:
        //   bg-primary/90 → hsl(340 82% 52% / 0.9)
        //
        // CSS vars consumed: --background, --foreground, --primary, --secondary,
        //   --destructive, --muted, --accent, --border, --input, --ring + their
        //   *-foreground variants. All defined in globals.css :root Section 6.
        // =====================================================================
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        card: 'var(--radius-card)',
        page: 'var(--radius-page)',
        frame: 'var(--radius-frame)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        'icp-pink-sm': 'var(--shadow-pink-sm)',
        'icp-pink-md': 'var(--shadow-pink-md)',
        'icp-pink-lg': 'var(--shadow-pink-lg)',
        'icp-pink-xl': 'var(--shadow-pink-xl)',
        'icp-orange-md': 'var(--shadow-orange-md)',
        'icp-orange-lg': 'var(--shadow-orange-lg)',
        'icp-card': 'var(--shadow-card)',
        'icp-list': 'var(--shadow-list)',
        'icp-input': 'var(--shadow-input)',
        'icp-mic': 'var(--shadow-mic)',
      },
      transitionTimingFunction: {
        'icp-out': 'var(--ease-out)',
        'icp-spring': 'var(--ease-spring)',
      },
      transitionDuration: {
        'icp-fast': '150ms',
        'icp-normal': '250ms',
        'icp-slow': '400ms',
      },

      // =====================================================================
      // 16 keyframes per S-01_SEMANTIC_COMPONENTS.md Section 1.1 (AC-8)
      // =====================================================================
      keyframes: {
        // 1. pop — entrance scale (66 file freq, 8/8 intents)
        pop: {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        // 2. pulseRing — mic/orb halo (61, 9/8)
        pulseRing: {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        // 3. drift — subtle vertical bob (58, 8/8)
        drift: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
        // 4. spin — loading spinner (57, 8/8)
        spin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        // 5. slideUp — entrance translateY (53, 6/8)
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        // 6. shimmer — skeleton overlay (46, 5/8)
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        // 7. glow — status indicator (42, 5/8)
        glow: {
          '0%, 100%': { opacity: '0.7', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        // 8. bump — cart-add microinteraction (34, 4/8)
        bump: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.2)' },
        },
        // 9. shake — error horizontal shake (28, 4/8)
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-4px)' },
          '40%, 80%': { transform: 'translateX(4px)' },
        },
        // 10. brainGlow — Family B brain icon halo (24, 3/8)
        brainGlow: {
          '0%, 100%': { filter: 'drop-shadow(0 0 4px rgba(233,30,99,0.4))' },
          '50%': { filter: 'drop-shadow(0 0 12px rgba(233,30,99,0.8))' },
        },
        // 11. nodePulse — network node pulse (24, 3/8)
        nodePulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.8' },
          '50%': { transform: 'scale(1.15)', opacity: '1' },
        },
        // 12. checkPop — success checkmark entrance (21, 3/8)
        checkPop: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '60%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        // 13. wave — voice wave (21, 2/8)
        wave: {
          '0%, 100%': { transform: 'scaleY(0.4)' },
          '50%': { transform: 'scaleY(1)' },
        },
        // 14. confettiFall — success celebration fallback (15, 2/8 I05/I06)
        confettiFall: {
          '0%': { transform: 'translateY(-100vh) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(100vh) rotate(720deg)', opacity: '0' },
        },
        // 15. elasticPop — button press micro (14, 2/8) — keyframe key camelCase
        elasticPop: {
          '0%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(0.92)' },
          '70%': { transform: 'scale(1.04)' },
          '100%': { transform: 'scale(1)' },
        },
        // 16. floatTag — tag idle float (2, 2/8) — keyframe key camelCase
        floatTag: {
          '0%, 100%': { transform: 'translateY(0) rotate(-1deg)' },
          '50%': { transform: 'translateY(-2px) rotate(1deg)' },
        },

        // =====================================================================
        // T06 chart-scope keyframes (Tier 3 exception per C-18, AC-13)
        // =====================================================================
        // Source: intent-07-state-J-error.html @keyframes errorPulse — scale +
        // opacity oscillation distinct from T01 `glow` (opacity-only no scale)
        // and T01 `bump` (scale 1↔1.2, 300ms one-shot vs needs 1.6s infinite).
        // Used by: ErrorState <OrbPulse> halo, ChartCard error mode.
        //
        // NOTE: livePulse SKIPPED — identical to Tailwind built-in animate-pulse
        // per Q-Final-A VERIFY Phiên 18 (opacity 1↔0.5 oscillation match).
        // NOTE: errorShake SKIPPED — reuse T01 `shake` (1px translateX diff
        // sub-perceptual per BRIEF R-4 visual-equivalent rule).
        errorPulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.15)', opacity: '0.5' },
        },
      },

      // =====================================================================
      // 16 animation aliases mapping keyframes with duration + easing (AC-9)
      // =====================================================================
      animation: {
        pop: 'pop 500ms cubic-bezier(0.16, 1, 0.3, 1) backwards',
        'pulse-ring': 'pulseRing 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite',
        drift: 'drift 4s ease-in-out infinite',
        spin: 'spin 1s linear infinite',
        'slide-up': 'slideUp 400ms cubic-bezier(0.16, 1, 0.3, 1) backwards',
        shimmer: 'shimmer 1.5s linear infinite',
        glow: 'glow 1.6s ease-in-out infinite',
        bump: 'bump 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        shake: 'shake 400ms ease-in-out',
        'brain-glow': 'brainGlow 2.5s ease-in-out infinite',
        'node-pulse': 'nodePulse 1.8s ease-in-out infinite',
        'check-pop': 'checkPop 400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        wave: 'wave 1.2s ease-in-out infinite',
        'confetti-fall': 'confettiFall 3s linear forwards',
        'elastic-pop': 'elasticPop 350ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'float-tag': 'floatTag 3s ease-in-out infinite',
        // T06 chart-scope (AC-14) — see keyframes errorPulse above
        'error-pulse': 'errorPulse 1.6s ease-in-out infinite',
      },

      zIndex: {
        base: '0',
        sticky: '10',
        sheet: '50',
        modal: '100',
        toast: '1000',
      },
    },
  },
  plugins: [
    // ========================================================================
    // data-state variant plugin (AC-10)
    // Enables: <div data-state="active" className="data-active:bg-icp-pink-600">
    // ========================================================================
    plugin(({ addVariant }) => {
      addVariant('data-active', '&[data-state="active"]');
      addVariant('data-done', '&[data-state="done"]');
      addVariant('data-pending', '&[data-state="pending"]');
    }),
  ],
};

export default config;
