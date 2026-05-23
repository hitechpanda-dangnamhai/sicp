/**
 * apps/web/stories/icp/organisms/SplashContent.stories.tsx
 *
 * Slice:    S-03 T04 — Auth Pages
 * Organism: <SplashContent> (T04 NEW)
 *
 * Source verified: components/icp/organisms/SplashContent.tsx
 *   Props: NONE — pure presentational (no consumer customization)
 *   Distribution: CLIENT ('use client' for SVG animations + Next.js Link prefetch)
 *
 * **Mockup-as-blueprint reference**: docs/mockups/intent-08/intent-08-state-0-splash.html
 *   - Phone-frame (414px max + gradient bg + 844px min-height)
 *   - Status bar mock (9:41 + signal/wifi/battery decorative)
 *   - Brain SVG 240x240 (animated brainGlow + nodePulse via 4 colored nodes)
 *   - Brand "Aida" 42px gradient pink→orange + tagline "HIỂU – HỌC – HÀNH ĐỘNG"
 *   - Subtitle "Mỗi quyết định đều được kết nối thông minh"
 *   - CTA Link → /auth/login (Next.js prefetch)
 *   - 3 decorative pagination dots (NOT interactive carousel per D-14 LOCKED)
 *
 * Decisions applied:
 * - **D-14** 3 dots = decorative verbatim mockup (NOT carousel, NOT remove)
 * - **D-15** "Aida" brand literal per Rule 6 mockup-as-LAW (distinct from "ICP" codebase namespace)
 * - **D-18** CTA Link Next.js SPA navigation to /auth/login
 *
 * **NO interactive states** — splash is a single immutable presentation.
 * Server Component cookie gate (D-16) decides whether to render or skip-redirect
 * upstream in app/page.tsx (T04 emit Batch 1).
 *
 * Story coverage: Default (only story — no variants possible per zero-props design)
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SplashContent } from '@/components/icp/organisms/SplashContent';

const meta = {
  title: 'Organisms/SplashContent',
  component: SplashContent,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          'Splash screen organism rendered by `app/page.tsx` (Server Component cookie gate decides ' +
          'whether to render or skip-redirect upstream per D-16). Pure presentational — no props, ' +
          'no interactive state. Animations: brain glow + 4 colored node pulses (CSS keyframes ' +
          'splash-prefixed in globals.css). CTA Link → /auth/login (Next.js prefetch). 3 dots ' +
          'decorative per D-14 (NOT carousel, NOT remove). Mockup verbatim per Rule 6.',
      },
    },
    nextjs: {
      appDirectory: true,
    },
  },
} satisfies Meta<typeof SplashContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Mockup-exact render of intent-08-state-0-splash.html. Phone-frame 414px width × 844px ' +
          'min-height + gradient bg #FCE7F0 → #FEEEE0 → #FFF8F0. Brain SVG with brainGlow aura + ' +
          '4 nodePulse colored circles (pink + orange + pink + orange alternating). Brand "Aida" ' +
          'gradient pink → orange. "Bắt đầu" CTA button with arrow icon. 3 decorative dots (pink ' +
          'active + 2 inactive pink-50). All animations CSS-only (no JS state).',
      },
    },
  },
};
