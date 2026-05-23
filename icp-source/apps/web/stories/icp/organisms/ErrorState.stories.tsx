/**
 * apps/web/stories/icp/organisms/ErrorState.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Organism: <ErrorState> (T06)
 *
 * Source verified: components/icp/organisms/ErrorState.tsx
 *   Props: title: string (REQUIRED),
 *          errorOrb?: ReactNode (typically <OrbPulse state="error" />),
 *          errorCode?: string (e.g., "NETWORK_TIMEOUT"),
 *          subtitle?, tips?: ErrorStateTip[] ({icon?, text}),
 *          actions?: ReactNode (retry/back/contact-support Buttons),
 *          shake?: boolean (animate-shake one-shot, default false),
 *          density?: 'compact'|'centered' (default 'centered')
 *   role="alert" + aria-live="assertive" baked.
 *
 * Decisions applied:
 * - C-22 verify: 8 props from source
 * - C-15 Server (no event handlers)
 * - C-08 VN: title VN per consumer
 * - OrbPulse atom composition: pass <OrbPulse state="error" /> via errorOrb prop
 * - Q4 Registry: MULTI-INTENT (multiple slots + 2 densities + shake variant)
 *
 * Story coverage: Default + with orb + with tips + with errorCode + shake variant + densities
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { ErrorState, type ErrorStateTip } from '@/components/icp/organisms';
import { Button, Icon, OrbPulse } from '@/components/icp/atoms';

const TIPS_NETWORK: ErrorStateTip[] = [
  { icon: <Icon name="wifi-off" size={14} />, text: 'Kiểm tra kết nối mạng' },
  { icon: <Icon name="alert-circle" size={14} />, text: 'Thử lại sau vài phút' },
  { text: 'Liên hệ hỗ trợ nếu vẫn lỗi' },
];

const meta = {
  title: 'Organisms/ErrorState',
  component: ErrorState,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          'Error state placeholder. errorOrb slot (typically <OrbPulse state="error" />) + ' +
          'title (REQUIRED) + subtitle + errorCode badge (mono font) + tips list (diagnostic ' +
          'hints) + actions slot (retry/back/support). shake=true triggers one-shot animate-shake. ' +
          'role="alert" + aria-live="assertive".',
      },
    },
  },
  argTypes: {
    title: { control: 'text' },
    subtitle: { control: 'text' },
    errorCode: { control: 'text' },
    shake: { control: 'boolean' },
    density: { control: 'inline-radio', options: ['compact', 'centered'] },
  },
  args: {
    title: 'Đã xảy ra lỗi',
    subtitle: 'Vui lòng thử lại',
    density: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Đã xảy ra lỗi',
    subtitle: 'Vui lòng thử lại sau',
  },
};

// === With composing atoms ===

export const WithErrorOrb: Story = {
  name: 'With errorOrb — <OrbPulse state="error" />',
  args: {
    errorOrb: <OrbPulse state="error" size="md" />,
    title: 'Em không nhận diện được',
    subtitle: 'Anh thử nói lại hoặc chụp ảnh khác',
  },
};

export const WithErrorCode: Story = {
  name: 'With errorCode badge',
  args: {
    errorOrb: <OrbPulse state="error" size="md" />,
    errorCode: 'NETWORK_TIMEOUT',
    title: 'Mất kết nối',
    subtitle: 'Không thể tải dữ liệu từ máy chủ',
  },
};

export const WithTips: Story = {
  name: 'With diagnostic tips list',
  args: {
    errorOrb: <OrbPulse state="error" size="md" />,
    title: 'Lỗi kết nối',
    subtitle: 'Không thể tải sản phẩm',
    tips: TIPS_NETWORK,
  },
};

export const WithActions: Story = {
  name: 'With retry/back actions',
  args: {
    errorOrb: <OrbPulse state="error" size="md" />,
    title: 'Đã xảy ra lỗi',
    subtitle: 'Bấm thử lại để tiếp tục',
    actions: (
      <div className="flex gap-2 mt-2">
        <Button variant="pink-grad" onClick={fn()}>
          Thử lại
        </Button>
        <Button variant="ghost" onClick={fn()}>
          Quay lại
        </Button>
      </div>
    ),
  },
};

export const FullComposition: Story = {
  name: 'Full — orb + code + tips + actions',
  args: {
    errorOrb: <OrbPulse state="error" size="md" />,
    errorCode: 'AUTH_401',
    title: 'Phiên đăng nhập đã hết hạn',
    subtitle: 'Vui lòng đăng nhập lại để tiếp tục',
    tips: [
      { icon: <Icon name="lock" size={14} />, text: 'Đăng nhập lại bằng email + mật khẩu' },
      { icon: <Icon name="mail" size={14} />, text: 'Kiểm tra email khôi phục' },
    ],
    actions: (
      <div className="flex gap-2 mt-2">
        <Button variant="pink-grad" leftIcon="lock" onClick={fn()}>
          Đăng nhập lại
        </Button>
      </div>
    ),
  },
};

// === Shake variant ===

export const WithShake: Story = {
  name: 'shake=true (one-shot animate-shake)',
  args: {
    errorOrb: <OrbPulse state="error" size="md" />,
    title: 'Lỗi nghiêm trọng',
    subtitle: 'Component shake animation triggered',
    shake: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'shake=true wraps orb in animate-shake class. Sub-perceptual 3-4px diff per ' +
               'Q-Final-A VERIFY BRIEF R-4. Use sparingly for severe errors.',
      },
    },
  },
};

// === Densities ===

export const DensityCompact: Story = {
  name: 'Density — compact (inline)',
  args: {
    density: 'compact',
    title: 'Lỗi nhỏ',
    subtitle: 'Inline error display',
  },
};
