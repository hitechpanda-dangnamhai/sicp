/**
 * apps/web/stories/icp/atoms/Icon.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Atom:    <Icon> (T02, AC-3)
 *
 * Source verified: components/icp/atoms/Icon.tsx + lib/icon-map.ts
 *   Props: name: IconName (REQUIRED, union from lib/icon-map.ts ICON_MAP keys),
 *          size?: number (default 16),
 *          strokeWidth?: number (default 2)
 *   Extends Omit<React.SVGAttributes<SVGSVGElement>, 'name'>.
 *
 * Decisions:
 * - C-22: IconName type imported from '@/lib/icon-map' (NOT atoms barrel — KI-6 T03 lesson)
 * - C-30 T06: icon-map extended +6 icons (mail/lock/wifi-off/inbox/key/shield-check). Total 66+.
 * - C-15: Server (no handlers, pure SVG wrapper)
 * - Q4 Registry: SINGLE-INTENT (type-safe lucide wrapper — used All intents but no states/slots)
 *
 * Conservative subset choice: Em sử dụng common icon names verified register in icon-map per
 * T02 AC-4 (73 base) + KI-7 T03 (more-vertical confirmed) + C-30 T06 (+6 LoginForm/ErrorState):
 *   mic, search, check, x, home, more-vertical, chevron-right, chevron-left,
 *   mail, lock, eye, eye-off, plus, minus, trash-2, settings
 * Risk: if a name not registered → console.warn + render null (per Icon.tsx line 46).
 *
 * Story coverage: Default + 3 sizes + strokeWidth variant + showcase grid
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Icon } from '@/components/icp/atoms';
import type { IconName } from '@/lib/icon-map';

const meta = {
  title: 'Atoms/Icon',
  component: Icon,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Type-safe lucide-react wrapper. Icon names from `lib/icon-map.ts` ICON_MAP keys ' +
          '(73 base T02 + 6 added T06 = 66+ entries). Dev-mode console.warn if name not registered. ' +
          'Brand SVGs (BrainIcon, OrbPulse) NOT routed through Icon — they have dedicated atoms.',
      },
    },
  },
  argTypes: {
    name: {
      control: 'select',
      options: [
        'mic', 'search', 'check', 'x', 'user',
        'more-vertical', 'chevron-right', 'chevron-left',
        'mail', 'lock', 'eye', 'eye-off',
        'plus', 'minus', 'trash', 'settings',
      ] satisfies IconName[],
      description: 'Icon name — must be registered in lib/icon-map.ts',
    },
    size: {
      control: { type: 'number', min: 12, max: 48 },
      description: 'Pixel size (default 16)',
    },
    strokeWidth: {
      control: { type: 'number', min: 1, max: 3, step: 0.25 },
      description: 'Stroke width (default 2; mockup uses 2.5 often)',
    },
  },
  args: {
    name: 'mic',
    size: 16,
    strokeWidth: 2,
  },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Size24: Story = {
  name: 'Size 24px',
  args: { name: 'mic', size: 24 },
};

export const ThickStroke: Story = {
  name: 'Stroke 2.5 (mockup default)',
  args: { name: 'check', size: 20, strokeWidth: 2.5 },
};

const SHOWCASE_NAMES: IconName[] = [
  'mic', 'search', 'check', 'x',
  'user', 'more-vertical', 'chevron-right', 'chevron-left',
  'mail', 'lock', 'eye', 'eye-off',
  'plus', 'minus', 'trash', 'settings',
];

export const Showcase: Story = {
  name: 'Showcase — 16 icons grid',
  parameters: {
    docs: {
      description: {
        story:
          'Visual confirmation 16 common icons render correctly. Used as smoke test for ' +
          'icon-map registry integrity.',
      },
    },
  },
  render: () => (
    <div className="grid grid-cols-4 gap-6 p-6">
      {SHOWCASE_NAMES.map((iconName) => (
        <div
          key={iconName}
          className="flex flex-col items-center gap-2 text-icp-text-secondary"
        >
          <Icon name={iconName} size={24} />
          <code className="text-[10px] font-mono">{iconName}</code>
        </div>
      ))}
    </div>
  ),
};
