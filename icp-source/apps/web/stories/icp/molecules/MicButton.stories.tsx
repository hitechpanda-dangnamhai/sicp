/**
 * apps/web/stories/icp/molecules/MicButton.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Molecule: <MicButton> (T04, Family A)
 *
 * Source verified: components/icp/molecules/MicButton.tsx
 *   Props: state: 'idle'|'listening'|'processing'|'error' (REQUIRED),
 *          size?: 'compact'|'voice-stage' (default 'compact'),
 *          onTap?: () => void,
 *          ariaLabel?: string (default 'Bấm để nói')
 *   Wraps <OrbPulse> atom (state map: processing → 'analyzing' OrbPulse state).
 *   Disabled when state='processing' (per source).
 *   icon swap: 'mic' for idle/listening/processing, 'mic-off' for error.
 *
 * Decisions applied:
 * - C-22 verify: 4 states + 2 sizes confirmed
 * - C-15 Client (onClick handler — button element)
 * - C-08 VN: ariaLabel="Bấm để nói" default
 * - C-07 navigation-agnostic — onTap callback only
 * - Q4 Registry: MULTI-INTENT (4 states × 2 sizes + aria-pressed state mapping)
 *
 * Story coverage: 4 states × compact + 4 states × voice-stage + custom ariaLabel
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { MicButton } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/MicButton',
  component: MicButton,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          'Voice CTA wrap atomic <OrbPulse>. 4 states (idle/listening/processing/error) × 2 sizes ' +
          '(compact 60px / voice-stage 180px). Auto-disabled state="processing" + aria-pressed ' +
          'state="listening". Icon swap mic↔mic-off based on state. Used I02-state-0 (compact) ' +
          'and I02-state-A voice modal (voice-stage).',
      },
    },
  },
  argTypes: {
    state: {
      control: 'inline-radio',
      options: ['idle', 'listening', 'processing', 'error'],
    },
    size: {
      control: 'inline-radio',
      options: ['compact', 'voice-stage'],
    },
    ariaLabel: { control: 'text' },
  },
  args: {
    state: 'idle',
    size: 'compact',
    onTap: fn(),
  },
} satisfies Meta<typeof MicButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// === Compact size × 4 states ===

export const CompactIdle: Story = {
  name: 'Compact — idle',
  args: { state: 'idle', size: 'compact' },
};

export const CompactListening: Story = {
  name: 'Compact — listening (pulsing)',
  args: { state: 'listening', size: 'compact' },
};

export const CompactProcessing: Story = {
  name: 'Compact — processing (disabled)',
  args: { state: 'processing', size: 'compact' },
  parameters: {
    docs: {
      description: {
        story: 'state="processing" auto-disables button + maps to OrbPulse "analyzing" drift animation.',
      },
    },
  },
};

export const CompactError: Story = {
  name: 'Compact — error (mic-off icon)',
  args: { state: 'error', size: 'compact' },
  parameters: {
    docs: {
      description: {
        story: 'state="error" swaps icon to mic-off + OrbPulse animate-shake animation.',
      },
    },
  },
};

// === Voice-stage size × 4 states ===

export const VoiceStageIdle: Story = {
  name: 'Voice-stage — idle (large CTA)',
  args: { state: 'idle', size: 'voice-stage' },
};

export const VoiceStageListening: Story = {
  name: 'Voice-stage — listening',
  args: { state: 'listening', size: 'voice-stage' },
  parameters: {
    docs: {
      description: {
        story: 'I02-state-A voice modal pattern — 180px orb with 3 expanding rings + glow.',
      },
    },
  },
};

export const VoiceStageProcessing: Story = {
  name: 'Voice-stage — processing',
  args: { state: 'processing', size: 'voice-stage' },
};

export const VoiceStageError: Story = {
  name: 'Voice-stage — error',
  args: { state: 'error', size: 'voice-stage' },
};

// === Custom ===

export const CustomAriaLabel: Story = {
  name: 'Custom ariaLabel',
  args: {
    state: 'idle',
    ariaLabel: 'Bắt đầu ghi âm sản phẩm',
  },
};
