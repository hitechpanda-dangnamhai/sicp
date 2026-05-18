// =============================================================================
// apps/web/tailwind.config.ts — Tailwind v3.4 config for ICP Web
// =============================================================================
// Slice:    S-00b Foundation Scaffold (T08)
//
// Source:   slices/S-00b_EXECUTION_GUIDE.md Section 4.8 lines 2321-2349 +
//           docs/phases/PHASE_00_DESIGN_SYSTEM.md Section 1 (MoMo color tokens).
//
// Decisions:
// - D-03 LOCKED — Tailwind 3.4.x pin (NOT 4.x to avoid ESM-only breakage in
//   shadcn ecosystem; shadcn currently targets Tailwind 3 stable).
// - C10 applied  — Theme references CSS variables defined in `app/globals.css`
//   (modern `shadcn` cssVariables: true pattern, NOT legacy hardcoded hex).
// - ADR-033      — shadcn/ui + Tailwind v3 stack baseline.
//
// Strategy:
// - `theme.extend.colors.icp-pink` maps to globals.css `--pink-*` CSS vars.
//   Full color ramp (Rose/Orange/Amber/Sky/Mint/Lilac per PHASE_00) deferred
//   to S-01 H-UI when shadcn components actually consume them. T08 scaffold
//   exposes pink ramp as proof-of-pattern; S-01 will extend.
// - `fontFamily.sans` references `--font-be-vietnam` CSS var. Actual font
//   loading (next/font/google or local) deferred to S-01 H-UI; T08 leaves
//   var undefined → fallback to system-ui per CSS var fallback chain.
// =============================================================================

import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx,mdx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // MoMo Premium pink ramp — maps to CSS vars in globals.css.
        // Full set (Rose/Orange/Amber/Sky/Mint/Lilac) extended in S-01 H-UI
        // as shadcn components are added.
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
      },
      fontFamily: {
        sans: ['var(--font-be-vietnam)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
