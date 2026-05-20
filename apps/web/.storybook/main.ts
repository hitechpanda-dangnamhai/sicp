// =============================================================================
// apps/web/.storybook/main.ts — Storybook 9.1 framework config
// =============================================================================
// Slice:    S-01 UI Foundation
// Task:     T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
//
// Source:   Task Pack §2.3 Storybook decision + C-33 NEW resolution
//           Storybook 9 release notes:
//             https://storybook.js.org/blog/storybook-9/
//           nextjs-vite docs:
//             https://storybook.js.org/docs/get-started/frameworks/nextjs-vite
//
// Decisions:
// - Q1 revised — `@storybook/nextjs-vite` 9.1 + Vite builder.
// - C-33 NEW — Storybook version-framework compatibility resolved:
//   Option (a) Storybook 9.1.20 chosen (nextjs-vite first stable in 9.x line).
//   8.x lacks nextjs-vite framework; 10.x too new for hackathon scope.
//   Lesson: future framework version pin MUST verify via
//     `pnpm view <package> versions` BEFORE commit (extends C-31 Layer 2
//     numerical claim verify to npm version pins).
// - AC-2 — framework name + stories glob.
// - AC-3 — preview.ts handles globals.css + viewports (unchanged).
//
// Storybook 9 changes from 8.x (per official MIGRATION.md):
// - `@storybook/addon-essentials` REMOVED, consolidated into core `storybook`
//   package. Features (controls/actions/viewport/backgrounds/measure/outline/
//   toolbars) work out-of-box. To DISABLE a feature, use `features: { ... }`
//   config below (not addon options like in 8.x).
// - `@storybook/test` REMOVED — now imported from `storybook/test` subpath
//   of core package. Stories Bước 2 batch 2 will import from `storybook/test`
//   for `fn()` mock helpers.
// - addons[] list reserved for community/external addons only — empty here.
//
// Stories path:
// - Single source of truth: apps/web/stories/icp/{atoms,molecules,organisms}/**/*.stories.tsx
// - T02 stub stories at apps/web/components/icp/atoms/*.stories.tsx DELETED in T07
//   (per TASKLIST line 350 path lock + anh confirmation Bước 2 ACK #1).
// - Glob includes .tsx primary + .mdx for future docs pages (none in T07 scope).
//
// Framework options:
// - nextjs-vite auto-detects next.config.js + Next.js version 14.2.18.
// - No custom builder config — Vite defaults sufficient for hackathon scope.
//
// Pre-requisites verified (Storybook 9 official requirements):
// - Node 20+ ✓ (anh verify via `node -v` BEFORE pnpm install)
// - Next.js 14+ ✓ (project uses 14.2.18)
// - Vite 5+ ✓ (via Vitest 2.1.x deps tree)
// - TypeScript 4.9+ ✓ (project uses ^5.4.0)
// - pnpm 9+ ✓ (anh verify via `pnpm -v`)
// =============================================================================

import type { StorybookConfig } from '@storybook/nextjs-vite';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/nextjs-vite',
    options: {},
  },

  stories: [
    '../stories/icp/**/*.stories.@(ts|tsx|mdx)',
  ],

  // Storybook 9.x: essentials addons consolidated into core — empty list here.
  // Community addons (none for T07) would go here.
  addons: [],

  // Storybook 9.x features config (replaces 8.x addon-essentials options pattern).
  // All features enabled by default — controls + actions + viewport + backgrounds
  // + measure + outline + toolbars work out-of-box from core.
  // No disable needed for T07 scope.

  // Inherit typescript config from project tsconfig.json
  typescript: {
    check: false, // Defer type check to `pnpm typecheck` (avoid double-cost on Storybook boot)
  },

  // Static dir not needed — no /public/* assets imported in stories yet
  // staticDirs: ['../public'],

  // Docs page auto-generation off (T07 scope: stories only, no MDX docs)
  docs: {
    autodocs: false,
  },
};

export default config;
