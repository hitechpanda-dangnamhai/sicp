/**
 * apps/web/stories/icp/organisms/SearchHeader.stories.tsx
 *
 * Slice:    S-04 First Product Discovery
 * Task:     T05 FE Page Wire (Phiên Sx04-10) — NEW V-SLICE feature organism Storybook
 * Organism: <SearchHeader> (T05 NEW per MAR-1 #2 LOCKED + C-S04-I scope extension)
 *
 * Stories (3):
 *   1. Default        — clickable back + clickable avatar, initials "AN"
 *   2. NoBackButton   — onBack omitted (e.g., for /home route)
 *   3. NoAvatarClick  — onProfileClick omitted (read-only avatar)
 *
 * Pattern inheritance: SuggestedQueryChips.stories.tsx (T04 Phiên Sx04-9a precedent).
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { SearchHeader } from '@/components/icp/organisms';

const meta = {
  title: 'Organisms/SearchHeader',
  component: SearchHeader,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Intent 03 page header (back button + title block "Tìm sản phẩm" + bell + avatar). ' +
          'Mockup verbatim translation of intent-03B-state-0-happy.html lines 115-136 (5/5 mockup ' +
          'states consistent). NEW organism per Phiên Sx04-10 MAR-1 #2 LOCKED + C-S04-I scope ' +
          'extension. Pattern reference: S-03 DashboardHeader (T03b).',
      },
    },
  },
  args: {
    onBack: fn(),
    onProfileClick: fn(),
  },
  decorators: [
    (Story) => (
      <div
        style={{
          maxWidth: 414,
          margin: '0 auto',
          background:
            'linear-gradient(180deg, #FCE7F0 0%, #FEEEE0 40%, #FFF8F0 100%)',
          padding: '0 0 20px',
          minHeight: 80,
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SearchHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default — both handlers wired (clickable back + clickable avatar). */
export const Default: Story = {
  args: {
    initials: 'AN',
  },
};

/** No back button — for routes that are not back-navigable (e.g., entry-point /intent-03). */
export const NoBackButton: Story = {
  args: {
    initials: 'AN',
    onBack: undefined,
  },
};

/** No avatar click — read-only avatar for non-clickable profile context. */
export const NoAvatarClick: Story = {
  args: {
    initials: 'TK',
    onProfileClick: undefined,
  },
};
