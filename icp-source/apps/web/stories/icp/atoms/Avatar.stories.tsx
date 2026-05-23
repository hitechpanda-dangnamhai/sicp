/**
 * apps/web/stories/icp/atoms/Avatar.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Atom:    <Avatar> (T02, AC-9)
 *
 * Source verified: components/icp/atoms/Avatar.tsx
 *   Props: role: 'ai' | 'user' (REQUIRED),
 *          size?: 'sm' | 'md' | 'lg'  (default 'md', pixels 28/40/56),
 *          src?: string (user role only — image source),
 *          fallback?: string (user role only — 1-2 char initials when no src),
 *          alt?: string (user role + src — image alt)
 *   Extends React.HTMLAttributes<HTMLDivElement>.
 *
 * Decisions:
 * - C-22: role union 'ai'|'user'; size 3 tiers (sm 28 / md 40 / lg 56)
 * - C-22: role=ai composes <BrainIcon> (atom dependency verified via barrel)
 * - C-15: Server (no handlers, pure presentational)
 * - Q4 Registry: SINGLE-INTENT (used I01/I02/I07 chat avatars)
 *
 * Story coverage: Default + 2 roles × 3 sizes (6) + image src + initials fallback
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Avatar } from '@/components/icp/atoms';

const meta = {
  title: 'Atoms/Avatar',
  component: Avatar,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'AI avatar (composes <BrainIcon> inside rose halo) or user avatar (image or 2-char ' +
          'initials gradient bg). Used I01/I02/I07 conversation bubbles + headers. ' +
          'lg tier wraps BrainIcon md (not lg) — full lg too dense per BRAIN_SIZE_MAP.',
      },
    },
  },
  argTypes: {
    role: {
      control: 'inline-radio',
      options: ['ai', 'user'],
    },
    size: {
      control: 'inline-radio',
      options: ['sm', 'md', 'lg'],
    },
    src: { control: 'text' },
    fallback: { control: 'text' },
    alt: { control: 'text' },
  },
  args: {
    role: 'ai',
    size: 'md',
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// === AI role × 3 sizes ===

export const AiSmall: Story = {
  name: 'AI — sm (28px)',
  args: { role: 'ai', size: 'sm' },
};

export const AiMedium: Story = {
  name: 'AI — md (40px default)',
  args: { role: 'ai', size: 'md' },
};

export const AiLarge: Story = {
  name: 'AI — lg (56px)',
  args: { role: 'ai', size: 'lg' },
};

// === User role × 3 sizes (initials path) ===

export const UserInitialsSm: Story = {
  name: 'User initials — sm',
  args: { role: 'user', size: 'sm', fallback: 'HD' },
};

export const UserInitialsMd: Story = {
  name: 'User initials — md',
  args: { role: 'user', size: 'md', fallback: 'HD' },
};

export const UserInitialsLg: Story = {
  name: 'User initials — lg',
  args: { role: 'user', size: 'lg', fallback: 'HD' },
};

// === User role with image ===

export const UserWithImage: Story = {
  name: 'User — with image src',
  args: {
    role: 'user',
    size: 'md',
    src: 'https://i.pravatar.cc/80?img=12',
    alt: 'Người dùng',
  },
  parameters: {
    docs: {
      description: {
        story:
          'External avatar URL (pravatar placeholder). Production replace with user profile image.',
      },
    },
  },
};

export const UserSingleInitial: Story = {
  name: 'User — single initial',
  args: { role: 'user', size: 'md', fallback: 'A' },
};
