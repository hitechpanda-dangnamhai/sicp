/**
 * apps/web/stories/icp/molecules/UserImageBubble.stories.tsx
 *
 * Storybook stories cho <UserImageBubble> — chat-style sent-image bubble.
 *
 * Slice: S-09 First Image-Based Product Recommendation (Intent 04)
 * Task:  T02 FE + wire (Phiên Sx09-F) — AC25 build-storybook EXIT 0
 *
 * Coverage:
 * - Default: turn 1, no badge (mockup state-A line 207-214)
 * - WithBadge: turn ≥2, "Ảnh thứ 2" badge per C-S09-AP NEW (mockup state-F line 224-237)
 * - WithCaption: re-upload with text caption + timestamp
 *
 * Test image: 1×1 PNG transparent (8 bytes base64) — tiny enough to embed inline.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { UserImageBubble } from '@/components/icp/molecules/UserImageBubble';

// 1×1 transparent PNG (87 bytes base64 — Storybook-safe inline).
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=';

const meta: Meta<typeof UserImageBubble> = {
  title: 'ICP/Molecules/UserImageBubble',
  component: UserImageBubble,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Chat-style sent-image bubble for /intent-04 page. Renders user-uploaded image with optional "Ảnh thứ N" badge (turn ≥2 per C-S09-AP NEW LAW), caption text bubble, and timestamp.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof UserImageBubble>;

/** State-A first upload — no badge, no caption. */
export const Default: Story = {
  args: {
    imageB64: TINY_PNG_B64,
    timestamp: '2 giây trước',
  },
};

/** State-F re-upload — turn 2, badge "Ảnh thứ 2". */
export const WithBadge: Story = {
  args: {
    imageB64: TINY_PNG_B64,
    badgeText: 'Ảnh thứ 2',
    caption: 'Còn cái này thì sao?',
    timestamp: 'vừa xong',
  },
};

/** State-F turn 3+. */
export const Turn3: Story = {
  args: {
    imageB64: TINY_PNG_B64,
    badgeText: 'Ảnh thứ 3',
    caption: 'Thử cái này nữa',
    timestamp: 'vừa xong',
  },
};

/** Caption only without badge — edge case for turn 1 with optional caption. */
export const CaptionOnly: Story = {
  args: {
    imageB64: TINY_PNG_B64,
    caption: 'Gợi ý giúp em ạ',
    timestamp: '5 giây trước',
  },
};
