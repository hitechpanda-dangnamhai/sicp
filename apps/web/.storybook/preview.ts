// =============================================================================
// apps/web/.storybook/preview.ts — Storybook global preview config
// =============================================================================
// Slice:    S-01 UI Foundation
// Task:     T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
//
// Source:   Task Pack AC-3 — globals.css import (tokens + utilities + Bug 1/2 CSS),
//                            viewport preset mobile 414×844 default, layout centered
//
// Decisions:
// - C-15 — Stories run client-side; no SSR concern in Storybook preview iframe.
// - C-18 — Tier 4 lock: NO `@layer components` added. Preview just imports
//          globals.css (T01 single source of truth).
// - KI-4 T05 — Cross-browser smoke discipline: Storybook itself runs Chrome by
//          default; manual Firefox check defer to acceptance pages where Bug 1/2
//          actually surface (stories are isolated, less Bug-prone).
//
// Globals.css import:
// - Loads design tokens v3 (108 CSS vars) + 11 utility classes + Bug 1/2 CSS fixes
//   (`.phone-frame max-height`, `.bottom-bar z-index 10 + solid bg`) + body layout
//   (`align-items: center`).
// - Be Vietnam Pro font NOT auto-loaded in Storybook (next/font/google works only
//   in Next.js runtime, not Storybook preview iframe). Stories use system font
//   stack fallback. Acceptable for component visual smoke; acceptance pages get
//   real font via app/layout.tsx loader.
//
// Viewports:
// - Custom 'phone-default' 414×844 (iPhone 13/14 base — matches `.phone-frame`
//   width 414 + height 844 per T01 globals.css).
// - 'phone-small' 414×700 — simulates Bug 2 trigger viewport (laptop low height).
// - 'phone-wide' 414×900 — desktop typical case (no Bug 2 trigger).
// - Set 'phone-default' as default for component stories (most stories are mobile).
//
// Backgrounds:
// - 'app-bg' #FFF8F0 (matches T01 `--bg-page-from` start) — components on
//   acceptance page bg.
// - 'transparent' — for atoms in isolation (default).
//
// Layout:
// - parameters.layout = 'centered' — atoms/molecules center in preview iframe.
//   Organisms with PhoneFrame override per-story with 'fullscreen' if needed.
// =============================================================================

import type { Preview } from '@storybook/nextjs-vite';

// Global styles — T01 tokens + utilities + Bug 1/2 CSS
import '../app/globals.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    layout: 'centered',

    backgrounds: {
      default: 'transparent',
      values: [
        { name: 'transparent', value: 'transparent' },
        { name: 'app-bg', value: '#FFF8F0' },
        { name: 'dark', value: '#1a1a1a' },
      ],
    },

    viewport: {
      viewports: {
        'phone-default': {
          name: 'Phone (414×844 — iPhone 13/14)',
          styles: { width: '414px', height: '844px' },
          type: 'mobile',
        },
        'phone-small': {
          name: 'Phone (414×700 — Bug 2 trigger viewport)',
          styles: { width: '414px', height: '700px' },
          type: 'mobile',
        },
        'phone-wide': {
          name: 'Phone (414×900 — desktop typical)',
          styles: { width: '414px', height: '900px' },
          type: 'mobile',
        },
      },
      defaultViewport: 'phone-default',
    },

    // Options panel ordering — Atoms → Layout → Molecules → Organisms
    options: {
      storySort: {
        order: [
          'Atoms',
          'Layout',
          'Molecules',
          'Organisms',
          ['ConversationThread', 'ChatThreadLayout', 'ChartCard', 'Charts', 'BottomSheet', 'OrderSummary', 'EmptyState', 'ErrorState', 'LoginForm'],
        ],
      },
    },
  },
};

export default preview;
