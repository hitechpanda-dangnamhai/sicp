// @ts-nocheck — @storybook/react not installed until T07. AC-17 stub mode.
/**
 * apps/web/components/icp/atoms/Avatar.stories.tsx
 *
 * Story stub for <Avatar> atom — per T02 AC-17 (D-02 Storybook 8).
 * Full variant matrices + interaction tests will be added in T07.
 *
 * @ts-nocheck rationale: @storybook/react devDep not installed in T02 scope
 * (per D-02 — Storybook init deferred to T07). Stub file exists on disk for
 * future T07 auto-discovery; suppress typecheck error until then.
 *
 * Removal: T07 will install @storybook/react@^8.x and remove @ts-nocheck banner.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { Avatar } from './Avatar';

const meta: Meta<typeof Avatar> = {
  title: 'Atoms/Avatar',
  component: Avatar,
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Default: Story = {
  args: {},
};
