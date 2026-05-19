/**
 * apps/web/__tests__/layout.test.tsx
 *
 * Slice:    S-01 UI Foundation
 * Task:     T03 Layout Primitives — Smoke tests (AC-21)
 *
 * Runner:   Vitest + @testing-library/react (per C-09 — vitest substituted for jest)
 *
 * Coverage: 5 layout components × at least 1 smoke each + key behavior verification:
 *   - PhoneFrame: 2 modes render + data-mode attr + className merge
 *   - MainScroll: default class + noBottomPadding override + forwardRef
 *   - BottomBar: class wrap + children render
 *   - TopBar: title render + onBack callback + action slot
 *   - AppHeader: title + subtitle + live dot + onBack + onAction
 *
 * Pattern: structural verification (className contains, presence of attrs/elements)
 *   per T02 atoms.test.tsx convention. Visual styles verified via dev preview page.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';

import { PhoneFrame } from '@/components/icp/PhoneFrame';
import { MainScroll, BottomBar, TopBar, AppHeader } from '@/components/icp/layout';

// =============================================================================
// PhoneFrame
// =============================================================================

describe('PhoneFrame', () => {
  it('renders with mode="chat" applying .phone-frame class (T01 LAW wrap)', () => {
    const { container } = render(
      <PhoneFrame mode="chat">
        <span>content</span>
      </PhoneFrame>,
    );
    const frame = container.firstElementChild;
    expect(frame).toHaveClass('phone-frame');
    expect(frame).toHaveAttribute('data-mode', 'chat');
    expect(frame).not.toHaveClass('overflow-y-auto'); // chat keeps T01 overflow: hidden
  });

  it('renders with mode="app" adding overflow-y-auto modifier (Tier 4 override)', () => {
    const { container } = render(
      <PhoneFrame mode="app">
        <span>content</span>
      </PhoneFrame>,
    );
    const frame = container.firstElementChild;
    expect(frame).toHaveClass('phone-frame');
    expect(frame).toHaveClass('overflow-y-auto');
    expect(frame).toHaveAttribute('data-mode', 'app');
  });

  it('merges consumer className via cn()', () => {
    const { container } = render(
      <PhoneFrame mode="chat" className="custom-test-class">
        <span>content</span>
      </PhoneFrame>,
    );
    expect(container.firstElementChild).toHaveClass('phone-frame', 'custom-test-class');
  });
});

// =============================================================================
// MainScroll
// =============================================================================

describe('MainScroll', () => {
  it('renders with .main-scroll class wrap (T01 LAW)', () => {
    const { container } = render(
      <MainScroll>
        <p>scroll content</p>
      </MainScroll>,
    );
    const scroll = container.firstElementChild;
    expect(scroll).toHaveClass('main-scroll');
    // No inline padding override by default (T01 LAW 130px wins)
    expect(scroll).not.toHaveAttribute('style', expect.stringContaining('padding-bottom: 0'));
  });

  it('applies inline padding-bottom: 0 when noBottomPadding=true (C-16 override)', () => {
    const { container } = render(
      <MainScroll noBottomPadding>
        <p>scroll content</p>
      </MainScroll>,
    );
    const scroll = container.firstElementChild as HTMLElement;
    expect(scroll).toHaveClass('main-scroll');
    expect(scroll.style.paddingBottom).toBe('0px');
  });

  it('forwards ref to underlying div (C-15 forwardRef for scroll detection)', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <MainScroll ref={ref}>
        <p>content</p>
      </MainScroll>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveClass('main-scroll');
  });
});

// =============================================================================
// BottomBar
// =============================================================================

describe('BottomBar', () => {
  it('renders with .bottom-bar class wrap (T01 LAW Bug 1 fix)', () => {
    const { container } = render(
      <BottomBar>
        <button type="button">CTA</button>
      </BottomBar>,
    );
    expect(container.firstElementChild).toHaveClass('bottom-bar');
    expect(screen.getByRole('button', { name: 'CTA' })).toBeInTheDocument();
  });
});

// =============================================================================
// TopBar
// =============================================================================

describe('TopBar', () => {
  it('renders title text when provided', () => {
    render(<TopBar title="Phân tích sản phẩm" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Phân tích sản phẩm');
  });

  it('renders back button + fires onBack callback when tapped', () => {
    const onBack = vi.fn();
    render(<TopBar title="Test" onBack={onBack} />);
    const backBtn = screen.getByRole('button', { name: 'Quay lại' });
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('does NOT render back button when onBack not provided', () => {
    render(<TopBar title="Test" />);
    expect(screen.queryByRole('button', { name: 'Quay lại' })).not.toBeInTheDocument();
  });

  it('renders action slot via prop', () => {
    render(
      <TopBar
        title="Test"
        action={<button type="button">Lưu</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeInTheDocument();
  });
});

// =============================================================================
// AppHeader
// =============================================================================

describe('AppHeader', () => {
  it('renders title text', () => {
    render(<AppHeader title="Phân tích kinh doanh" />);
    expect(screen.getByText('Phân tích kinh doanh')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(
      <AppHeader
        title="Test"
        subtitle="Aida đang trợ giúp"
      />,
    );
    expect(screen.getByText('Aida đang trợ giúp')).toBeInTheDocument();
  });

  it('renders live-pulse dot when live=true', () => {
    const { container } = render(
      <AppHeader
        title="Test"
        subtitle="Cập nhật real-time"
        live
      />,
    );
    // live-dot has bg-icp-green-500 + animate-pulse classes
    const dot = container.querySelector('.animate-pulse');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass('bg-icp-green-500');
  });

  it('does NOT render live-dot when live=false (default)', () => {
    const { container } = render(
      <AppHeader title="Test" subtitle="No live" />,
    );
    expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
  });

  it('fires onBack + onAction callbacks', () => {
    const onBack = vi.fn();
    const onAction = vi.fn();
    render(
      <AppHeader
        title="Test"
        onBack={onBack}
        onAction={onAction}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tùy chọn' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
