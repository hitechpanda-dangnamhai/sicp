/**
 * apps/web/__tests__/organisms.test.tsx
 *
 * Slice:    S-01 UI Foundation
 * Task:     T06 AC-18 — Organisms smoke + behavior tests
 *
 * Runner:   Vitest + @testing-library/react (per C-09 — vitest substituted for jest)
 *           jest-dom matchers per C-19 (toHaveClass, toBeInTheDocument, etc.)
 *
 * Pattern:  Matches T03 layout.test.tsx + T05 molecules.test.tsx structure
 *           (1 smoke render per organism + key behavior verification).
 *
 * Coverage: 10 organisms × at least 1 smoke + key prop behaviors:
 *   - ConversationThread: renders ordered bubble list
 *   - ChatThreadLayout: composes 5 layers (PhoneFrame + TopBar + MainScroll + Thread + BottomBar)
 *   - ChartCard: render + onExpandedChange callback + defaultExpanded + phases cross-render (C-04)
 *   - ChartLine/Bar/Donut: SVG renders with required gradientIdSuffix
 *   - BottomSheet: open=true renders content + onOpenChange callback
 *   - OrderSummary: mode='confirm' vs 'receipt' render variations + formatVND
 *   - EmptyState + ErrorState: slot-driven render + actions slot
 *   - LoginForm: onSubmit callback + eye-toggle password visibility
 *
 * Total tests: ~25 (covers 10 organisms with 2-3 tests each)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  ConversationThread,
  ChatThreadLayout,
  ChartCard,
  ChartLine,
  ChartBar,
  ChartDonut,
  BottomSheet,
  OrderSummary,
  EmptyState,
  ErrorState,
  LoginForm,
  // T03b Dashboard hub (S-03 Phiên 36)
  DashboardHeader,
  HeroInsightCard,
  HomeInputBar,
} from '@/components/icp/organisms';

// =============================================================================
// ConversationThread
// =============================================================================

describe('<ConversationThread>', () => {
  it('renders ordered list of bubbles in DOM order', () => {
    const bubbles = [
      { id: '1', role: 'ai' as const, text: 'Xin chào' },
      { id: '2', role: 'user' as const, text: 'Em cần mua sữa' },
      { id: '3', role: 'ai' as const, text: 'Em đề xuất 3 loại sữa' },
    ];
    render(<ConversationThread bubbles={bubbles} />);
    expect(screen.getByText('Xin chào')).toBeInTheDocument();
    expect(screen.getByText('Em cần mua sữa')).toBeInTheDocument();
    expect(screen.getByText('Em đề xuất 3 loại sữa')).toBeInTheDocument();
  });

  it('applies aria-live polite for screen reader announcements', () => {
    const { container } = render(<ConversationThread bubbles={[{ role: 'ai', text: 'Test' }]} />);
    const log = container.firstElementChild;
    expect(log).toHaveAttribute('role', 'log');
    expect(log).toHaveAttribute('aria-live', 'polite');
  });
});

// =============================================================================
// ChatThreadLayout
// =============================================================================

describe('<ChatThreadLayout>', () => {
  it('renders title in TopBar + bubbles in MainScroll + bottomCta in BottomBar', () => {
    const onBack = vi.fn();
    render(
      <ChatThreadLayout
        title="Chat với Aida"
        onBack={onBack}
        bubbles={[{ role: 'ai', text: 'Hello' }]}
        bottomCta={<button type="button">Gửi</button>}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Chat với Aida' })).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gửi' })).toBeInTheDocument();
  });

  it('omits TopBar when no title/onBack provided', () => {
    render(<ChatThreadLayout bubbles={[{ role: 'ai', text: 'X' }]} />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});

// =============================================================================
// ChartCard
// =============================================================================

describe('<ChartCard>', () => {
  it('renders title + meta + live dot when live=true', () => {
    const { container } = render(
      <ChartCard title="Doanh thu" meta="30 ngày" live>
        <div data-testid="chart-body">chart</div>
      </ChartCard>,
    );
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Doanh thu');
    expect(screen.getByText('30 ngày')).toBeInTheDocument();
    expect(screen.getByTestId('chart-body')).toBeInTheDocument();
    // Live dot uses animate-pulse (Q-Final-A VERIFY — livePulse identical Tailwind built-in)
    const livedot = container.querySelector('.animate-pulse');
    expect(livedot).toBeInTheDocument();
  });

  it('fires onExpandedChange when expand-btn clicked (uncontrolled mode C-28)', () => {
    const onExpandedChange = vi.fn();
    render(
      <ChartCard title="Test" onExpandedChange={onExpandedChange}>
        <div>body</div>
      </ChartCard>,
    );
    const expandBtn = screen.getByRole('button', { name: 'Mở rộng' });
    fireEvent.click(expandBtn);
    expect(onExpandedChange).toHaveBeenCalledWith(true);
    // After expand, button label becomes "Thu gọn"
    expect(screen.getByRole('button', { name: 'Thu gọn' })).toBeInTheDocument();
  });

  it('renders phases card cross-render when phases prop provided (C-04)', () => {
    render(
      <ChartCard
        title="Phân tích"
        phases={[
          { id: 'fetch', label: 'Tải dữ liệu', status: 'done' },
          { id: 'compute', label: 'Tính toán', status: 'active' },
        ]}
      >
        <div>body</div>
      </ChartCard>,
    );
    expect(screen.getByText('Tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Tính toán')).toBeInTheDocument();
  });
});

// =============================================================================
// Chart SVG components (Line, Bar, Donut)
// =============================================================================

describe('<ChartLine>', () => {
  it('renders SVG with unique gradient ID from gradientIdSuffix', () => {
    const { container } = render(
      <ChartLine
        data={[{ x: 0, y: 10 }, { x: 1, y: 20 }, { x: 2, y: 15 }]}
        gradientIdSuffix="test-revenue"
        accent="rose"
      />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-label', 'Biểu đồ đường');
    const gradient = svg?.querySelector('linearGradient');
    expect(gradient?.id).toBe('chart-line-grad-rose-test-revenue');
  });

  it('uses custom ariaLabel when provided (Issue 3 fix)', () => {
    const { container } = render(
      <ChartLine
        data={[{ x: 0, y: 10 }, { x: 1, y: 20 }]}
        gradientIdSuffix="x"
        ariaLabel="Doanh thu 30 ngày"
      />,
    );
    expect(container.querySelector('svg')).toHaveAttribute('aria-label', 'Doanh thu 30 ngày');
  });
});

describe('<ChartBar>', () => {
  it('renders bars + labels with unique gradient ID', () => {
    const { container } = render(
      <ChartBar
        data={[
          { label: 'T1', value: 10 },
          { label: 'T2', value: 20 },
          { label: 'T3', value: 15 },
        ]}
        gradientIdSuffix="orders"
        accent="pink"
      />,
    );
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(3);
    expect(screen.getByText('T1')).toBeInTheDocument();
    expect(screen.getByText('T2')).toBeInTheDocument();
  });

  it('renders nothing when data empty', () => {
    const { container } = render(<ChartBar data={[]} gradientIdSuffix="x" />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });
});

describe('<ChartDonut>', () => {
  it('renders correct number of segment paths', () => {
    const { container } = render(
      <ChartDonut
        segments={[
          { label: 'A', value: 30 },
          { label: 'B', value: 20 },
          { label: 'C', value: 50 },
        ]}
      />,
    );
    const paths = container.querySelectorAll('svg path');
    expect(paths.length).toBe(3);
  });

  it('renders centerLabel slot when provided', () => {
    render(
      <ChartDonut
        segments={[{ label: 'A', value: 100 }]}
        centerLabel={<span>Total</span>}
      />,
    );
    expect(screen.getByText('Total')).toBeInTheDocument();
  });
});

// =============================================================================
// BottomSheet
// =============================================================================

describe('<BottomSheet>', () => {
  it('renders content when open=true', () => {
    render(
      <BottomSheet open={true} onOpenChange={vi.fn()} title="Giỏ hàng">
        <div data-testid="sheet-body">Cart items</div>
      </BottomSheet>,
    );
    expect(screen.getByText('Giỏ hàng')).toBeInTheDocument();
    expect(screen.getByTestId('sheet-body')).toBeInTheDocument();
  });

  it('does not render content when open=false', () => {
    render(
      <BottomSheet open={false} onOpenChange={vi.fn()}>
        <div data-testid="sheet-body">Cart items</div>
      </BottomSheet>,
    );
    expect(screen.queryByTestId('sheet-body')).not.toBeInTheDocument();
  });
});

// =============================================================================
// OrderSummary
// =============================================================================

describe('<OrderSummary>', () => {
  const sampleItems = [
    { name: 'Sữa tươi 1L', qty: 2, price: 32000 },
    { name: 'Bánh mì', qty: 3, price: 15000 },
  ];

  it('renders confirm mode with items + totals (formatVND applied)', () => {
    render(
      <OrderSummary
        items={sampleItems}
        subtotal={109000}
        delivery={15000}
        total={124000}
        mode="confirm"
      />,
    );
    expect(screen.getByText('Đơn hàng của em')).toBeInTheDocument();
    expect(screen.getByText('Sữa tươi 1L')).toBeInTheDocument();
    expect(screen.getByText('Tạm tính')).toBeInTheDocument();
    expect(screen.getByText('Tổng cộng')).toBeInTheDocument();
    // formatVND outputs include "₫" character
    const totalText = screen.getAllByText(/124\.000/);
    expect(totalText.length).toBeGreaterThanOrEqual(1);
  });

  it('renders receipt mode with orderId + timestamp', () => {
    render(
      <OrderSummary
        items={sampleItems}
        subtotal={109000}
        delivery={15000}
        total={124000}
        mode="receipt"
        receiptMeta={{ orderId: 'ICP-20260519-0042', timestamp: '19/05/2026 14:32' }}
      />,
    );
    expect(screen.getByText('Mã đơn')).toBeInTheDocument();
    expect(screen.getByText('ICP-20260519-0042')).toBeInTheDocument();
    expect(screen.getByText('Thanh toán lúc')).toBeInTheDocument();
    expect(screen.getByText('19/05/2026 14:32')).toBeInTheDocument();
  });
});

// =============================================================================
// EmptyState
// =============================================================================

describe('<EmptyState>', () => {
  it('renders title + subtitle + quote + actions slots (slot-driven C-27)', () => {
    render(
      <EmptyState
        title="Chưa có sản phẩm"
        subtitle="Tìm kiếm khác đi anh"
        quote='"Thử từ khoá khác"'
        actions={<button type="button">Tìm lại</button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Chưa có sản phẩm' })).toBeInTheDocument();
    expect(screen.getByText('Tìm kiếm khác đi anh')).toBeInTheDocument();
    expect(screen.getByText('"Thử từ khoá khác"')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tìm lại' })).toBeInTheDocument();
  });

  it('renders compact density variant with smaller text classes', () => {
    const { container } = render(
      <EmptyState title="Empty" density="compact" />,
    );
    expect(container.querySelector('.text-\\[14px\\]')).toBeInTheDocument();
  });
});

// =============================================================================
// ErrorState
// =============================================================================

describe('<ErrorState>', () => {
  it('renders title + subtitle + tips + errorCode + actions', () => {
    render(
      <ErrorState
        errorCode="NETWORK_TIMEOUT"
        title="Mất kết nối"
        subtitle="Không thể tải dữ liệu"
        tips={[
          { text: 'Kiểm tra wifi' },
          { text: 'Thử lại sau' },
        ]}
        actions={<button type="button">Thử lại</button>}
      />,
    );
    expect(screen.getByText('NETWORK_TIMEOUT')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mất kết nối' })).toBeInTheDocument();
    expect(screen.getByText('Kiểm tra wifi')).toBeInTheDocument();
    expect(screen.getByText('Thử lại sau')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('applies animate-error-pulse to errorOrb wrapper when shake=false (T06 new keyframe)', () => {
    render(
      <ErrorState
        title="Error"
        errorOrb={<div data-testid="orb">orb</div>}
        shake={false}
      />,
    );
    const wrapper = screen.getByTestId('orb').parentElement;
    expect(wrapper).toHaveClass('animate-error-pulse');
    expect(wrapper).not.toHaveClass('animate-shake');
  });

  it('applies animate-shake (T01 baseline) when shake=true', () => {
    render(
      <ErrorState
        title="Error"
        errorOrb={<div data-testid="orb">orb</div>}
        shake={true}
      />,
    );
    const wrapper = screen.getByTestId('orb').parentElement;
    expect(wrapper).toHaveClass('animate-shake');
    expect(wrapper).not.toHaveClass('animate-error-pulse');
  });
});

// =============================================================================
// LoginForm
// =============================================================================

describe('<LoginForm>', () => {
  it('renders email + password fields + submit button', () => {
    render(<LoginForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Mật khẩu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument();
  });

  it('shows external error banner when error prop provided', () => {
    render(<LoginForm onSubmit={vi.fn()} error="Email hoặc mật khẩu sai" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Email hoặc mật khẩu sai');
  });

  it('toggles password visibility when eye button clicked', () => {
    render(<LoginForm onSubmit={vi.fn()} />);
    const passwordInput = screen.getByLabelText('Mật khẩu') as HTMLInputElement;
    expect(passwordInput.type).toBe('password');
    // Click "Hiện mật khẩu" eye toggle
    const toggleBtn = screen.getByRole('button', { name: 'Hiện mật khẩu' });
    fireEvent.click(toggleBtn);
    expect(passwordInput.type).toBe('text');
    // Toggle back
    const toggleBackBtn = screen.getByRole('button', { name: 'Ẩn mật khẩu' });
    fireEvent.click(toggleBackBtn);
    expect(passwordInput.type).toBe('password');
  });

  it('fires onSubmit with valid form data after typing email + password', async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.input(screen.getByLabelText('Mật khẩu'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit).toHaveBeenCalledWith(
      { email: 'test@example.com', password: 'secret123' },
      expect.anything(),
    );
  });
});

// =============================================================================
// T03b Dashboard hub (S-03 Phiên 36) — DashboardHeader (1 test)
// =============================================================================

describe('DashboardHeader', () => {
  it('renders brand block + bell + dynamic initials avatar from props per D-06', () => {
    render(<DashboardHeader initials="AN" />);
    expect(screen.getByText('ICP')).toBeInTheDocument();
    expect(screen.getByText('Trợ lý kinh doanh thông minh')).toBeInTheDocument();
    expect(screen.getByLabelText('Thông báo')).toBeInTheDocument();
    expect(screen.getByLabelText('Tài khoản')).toHaveTextContent('AN');
  });
});

// =============================================================================
// HeroInsightCard (1 test)
// =============================================================================

describe('HeroInsightCard', () => {
  it('renders tag + title + subtitle + 2 decorative CTAs per D-08 + D-09', () => {
    render(<HeroInsightCard />);
    expect(screen.getByText('AI VỪA PHÁT HIỆN')).toBeInTheDocument();
    expect(screen.getByText(/Doanh thu tuần này giảm/)).toBeInTheDocument();
    expect(screen.getByText(/2 nguyên nhân chính/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xem phân tích/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Để sau' })).toBeInTheDocument();
  });
});

// =============================================================================
// HomeInputBar (1 test)
// =============================================================================

describe('HomeInputBar', () => {
  it('renders disabled input + 2 decorative buttons per D-12', () => {
    render(<HomeInputBar />);
    const input = screen.getByLabelText('Hỏi tôi bất cứ điều gì');
    expect(input).toBeInTheDocument();
    expect(input).toBeDisabled();
    expect(screen.getByLabelText('Chụp ảnh')).toBeInTheDocument();
    expect(screen.getByLabelText('Nói')).toBeInTheDocument();
  });
});
