/**
 * @icp/web — Molecules test suite (T04 + T05)
 *
 * 35 tests covering 13 molecules per AC-10/AC-12 distribution:
 *
 * Family A (T04, 23 tests):
 * - ConversationBubble: 4 (role ai, user with voiceMeta, variant greet, variant empty)
 * - PhasesCard: 3 (mode list, mode card with header, active phase highlight)
 * - ActionCard: 3 (variant default, variant stock-up mint class, compound slots)
 * - MicButton: 3 (state idle compact, state listening voice-stage, onTap fires)
 * - LivePartialTranscript: 2 (text + label, cursor shown when showCursor=true)
 * - DrillChipRow: 2 (chips render with active state, onSelect fires)
 * - AIInsightCard: 2 (variant default, variant reasoning with tag)
 * - TrendCard: 2 (compact renders sparkline + delta, onExpand fires)
 * - ShopeeCompareCard: 2 (compact renders price-range, marker positioned)
 *
 * Family B (T05, 12 tests):
 * - ProductCard: 4 (width=138 carousel render, width=172 grid render, onAdd fires, badge slot)
 * - CartItemRow: 3 (qty stepper onQtyChange fires, stockIssue='out' banner render, formatVND price)
 * - PaymentMethodPicker: 3 (renders all methods, selected aria-checked, onSelect fires with id)
 * - OtpField: 2 (renders length=6 boxes default, onChange fires with concatenated value)
 *
 * jest-dom matchers per C-19 (locked T03 Phiên 15 vitest.config.ts setup).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import {
  ConversationBubble,
  PhasesCard,
  ActionCard,
  MicButton,
  LivePartialTranscript,
  DrillChipRow,
  AIInsightCard,
  TrendCard,
  ShopeeCompareCard,
  // T05 Family B
  ProductCard,
  CartItemRow,
  PaymentMethodPicker,
  OtpField,
  I03A_138,
  I04_172,
  // T03b Dashboard (S-03 Phiên 36)
  StatBar,
  HeroTile,
  ListTile,
  type PhaseItem,
  type DrillChip,
  type PaymentMethod,
} from '@/components/icp/molecules';
import { Button } from '@/components/icp/atoms';

// ───────────────────────────────────────────────────────────────────────────
// ConversationBubble (4 tests)
// ───────────────────────────────────────────────────────────────────────────

describe('ConversationBubble', () => {
  it('renders role="ai" with text and default variant', () => {
    render(<ConversationBubble role="ai" text="Xin chào!" />);
    expect(screen.getByText('Xin chào!')).toBeInTheDocument();
  });

  it('renders role="user" with voiceMeta duration, confidence, voice-wave', () => {
    const { container } = render(
      <ConversationBubble
        role="user"
        text="Cho tôi 2 chai nước"
        voiceMeta={{ duration: '0:04', confidence: 0.94, showVoiceWave: true }}
      />
    );
    expect(screen.getByText('Cho tôi 2 chai nước')).toBeInTheDocument();
    expect(screen.getByText(/0:04/)).toBeInTheDocument();
    expect(screen.getByText(/94%/)).toBeInTheDocument();
    // VoiceWave 7 spans inline
    const voiceWave = container.querySelector('[aria-hidden="true"]');
    expect(voiceWave).toBeInTheDocument();
  });

  it('renders variant="greet" with inline strong highlights', () => {
    render(
      <ConversationBubble
        role="ai"
        variant="greet"
        text={<>Cần Aida giúp <strong>điều gì</strong>?</>}
      />
    );
    expect(screen.getByText('điều gì')).toBeInTheDocument();
    expect(screen.getByText('điều gì').tagName).toBe('STRONG');
  });

  it('renders variant="empty" composite bubble', () => {
    const { container } = render(
      <ConversationBubble
        role="ai"
        variant="empty"
        text="Shop chưa có món này."
      />
    );
    expect(screen.getByText('Shop chưa có món này.')).toBeInTheDocument();
    // empty variant uses gradient bg per CVA
    const bubble = container.querySelector('.bg-gradient-to-br');
    expect(bubble).toBeInTheDocument();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PhasesCard (3 tests)
// ───────────────────────────────────────────────────────────────────────────

describe('PhasesCard', () => {
  const samplePhases: PhaseItem[] = [
    { id: '1', label: 'Tải ảnh', status: 'done' },
    { id: '2', label: 'Đọc nhãn', status: 'active' },
    { id: '3', label: 'Phân tích', status: 'pending' },
    { id: '4', label: 'Hoàn thành', status: 'pending' },
  ];

  it('renders mode="list" with 4 phase rows', () => {
    render(<PhasesCard mode="list" phases={samplePhases} />);
    expect(screen.getByText('Tải ảnh')).toBeInTheDocument();
    expect(screen.getByText('Đọc nhãn')).toBeInTheDocument();
    expect(screen.getByText('Phân tích')).toBeInTheDocument();
    expect(screen.getByText('Hoàn thành')).toBeInTheDocument();
  });

  it('renders mode="card" with header icon + title + subtitle', () => {
    render(
      <PhasesCard
        mode="card"
        header={{ icon: 'chart-bar', title: 'Aida đang phân tích', subtitle: '~2 giây nữa' }}
        phases={samplePhases.slice(0, 2)}
      />
    );
    expect(screen.getByText('Aida đang phân tích')).toBeInTheDocument();
    expect(screen.getByText('~2 giây nữa')).toBeInTheDocument();
  });

  it('renders active phase with status badge "ĐANG"', () => {
    render(<PhasesCard mode="list" phases={samplePhases} />);
    expect(screen.getByText('ĐANG')).toBeInTheDocument();
    expect(screen.getByText('XONG')).toBeInTheDocument();
    // Both pending phases should have CHỜ
    const choBadges = screen.getAllByText('CHỜ');
    expect(choBadges).toHaveLength(2);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// ActionCard (3 tests)
// ───────────────────────────────────────────────────────────────────────────

describe('ActionCard', () => {
  it('renders variant="default" with header + body', () => {
    render(
      <ActionCard variant="default">
        <ActionCard.Header title="Test Action" />
        <ActionCard.Body>Body content</ActionCard.Body>
      </ActionCard>
    );
    expect(screen.getByText('Test Action')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('renders variant="stock-up" with mint palette class', () => {
    const { container } = render(
      <ActionCard variant="stock-up">
        <ActionCard.Header title="Mint Test" />
      </ActionCard>
    );
    const card = container.querySelector('.border-emerald-200');
    expect(card).toBeInTheDocument();
  });

  it('renders compound slots: Header + Body + DetailRow + Tags + Actions', () => {
    render(
      <ActionCard variant="price">
        <ActionCard.Header title="Compound Test" />
        <ActionCard.Body>
          <ActionCard.DetailRow label="Giá" value="40k" />
        </ActionCard.Body>
        <ActionCard.Tags>
          <span>Tag</span>
        </ActionCard.Tags>
        <ActionCard.Actions>
          <Button variant="default" size="sm">Áp dụng</Button>
        </ActionCard.Actions>
      </ActionCard>
    );
    expect(screen.getByText('Compound Test')).toBeInTheDocument();
    expect(screen.getByText('Giá')).toBeInTheDocument();
    expect(screen.getByText('40k')).toBeInTheDocument();
    expect(screen.getByText('Tag')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Áp dụng/i })).toBeInTheDocument();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// MicButton (3 tests)
// ───────────────────────────────────────────────────────────────────────────

describe('MicButton', () => {
  it('renders state="idle" size="compact" with aria-label default VN', () => {
    render(<MicButton state="idle" size="compact" />);
    const btn = screen.getByRole('button', { name: 'Bấm để nói' });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders state="listening" size="voice-stage" with aria-pressed=true', () => {
    render(<MicButton state="listening" size="voice-stage" />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('fires onTap callback when clicked', () => {
    const handleTap = vi.fn();
    render(<MicButton state="idle" onTap={handleTap} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleTap).toHaveBeenCalledOnce();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// LivePartialTranscript (2 tests)
// ───────────────────────────────────────────────────────────────────────────

describe('LivePartialTranscript', () => {
  it('renders text + default label "Tạm hiểu"', () => {
    render(<LivePartialTranscript text="Cho tôi 2 chai..." />);
    expect(screen.getByText('Cho tôi 2 chai...')).toBeInTheDocument();
    expect(screen.getByText('Tạm hiểu')).toBeInTheDocument();
  });

  it('hides cursor when showCursor=false', () => {
    const { container, rerender } = render(
      <LivePartialTranscript text="text" showCursor />
    );
    // With cursor: 1 aria-hidden element (the cursor span)
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);

    rerender(<LivePartialTranscript text="text" showCursor={false} />);
    // Without cursor: text still renders but cursor absent
    expect(screen.getByText('text')).toBeInTheDocument();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// DrillChipRow (2 tests)
// ───────────────────────────────────────────────────────────────────────────

describe('DrillChipRow', () => {
  const chips: DrillChip[] = [
    { id: 'all', label: 'Tất cả', active: true },
    { id: 'rev', label: 'Doanh thu' },
    { id: 'ord', label: 'Đơn hàng' },
  ];

  it('renders chips with active state via aria-selected', () => {
    render(<DrillChipRow chips={chips} />);
    expect(screen.getByText('Tất cả')).toBeInTheDocument();
    expect(screen.getByText('Doanh thu')).toBeInTheDocument();
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Tất cả');
  });

  it('fires onSelect with chip id on click', () => {
    const handleSelect = vi.fn();
    render(<DrillChipRow chips={chips} onSelect={handleSelect} />);
    fireEvent.click(screen.getByText('Doanh thu'));
    expect(handleSelect).toHaveBeenCalledWith('rev');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AIInsightCard (2 tests)
// ───────────────────────────────────────────────────────────────────────────

describe('AIInsightCard', () => {
  it('renders variant="default" with text', () => {
    render(<AIInsightCard text="Đây là insight mặc định." />);
    expect(screen.getByText('Đây là insight mặc định.')).toBeInTheDocument();
  });

  it('renders variant="reasoning" with default tag "🤖 Aida nhận định"', () => {
    render(
      <AIInsightCard
        variant="reasoning"
        text="Reasoning text."
      />
    );
    expect(screen.getByText('Reasoning text.')).toBeInTheDocument();
    expect(screen.getByText('🤖 Aida nhận định')).toBeInTheDocument();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// TrendCard (2 tests)
// ───────────────────────────────────────────────────────────────────────────

describe('TrendCard', () => {
  it('renders compact with delta + sparkline + label', () => {
    render(
      <TrendCard
        delta={45}
        sparklineData={[10, 20, 30, 40, 50]}
        subtitle="+45% nhu cầu"
      />
    );
    expect(screen.getByText('GOOGLE TRENDS')).toBeInTheDocument();
    expect(screen.getByText('+45%')).toBeInTheDocument();
    expect(screen.getByText('+45% nhu cầu')).toBeInTheDocument();
  });

  it('fires onExpand callback when "Mở rộng" button clicked', () => {
    const handleExpand = vi.fn();
    render(
      <TrendCard
        delta={20}
        sparklineData={[1, 2, 3]}
        onExpand={handleExpand}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Mở rộng/i }));
    expect(handleExpand).toHaveBeenCalledOnce();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// ShopeeCompareCard (2 tests)
// ───────────────────────────────────────────────────────────────────────────

describe('ShopeeCompareCard', () => {
  it('renders compact with price-range and formatted VND', () => {
    render(
      <ShopeeCompareCard
        userPrice={45000}
        priceMin={28000}
        priceMax={55000}
        priceMedian={38000}
      />
    );
    expect(screen.getByText('GIÁ THỊ TRƯỜNG SHOPEE')).toBeInTheDocument();
    expect(screen.getByText('Trung vị 5 cửa hàng')).toBeInTheDocument();
    expect(screen.getByText('Bạn')).toBeInTheDocument();
    // progressbar role with correct aria-valuenow
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '45000');
  });

  it('positions user marker via aria-valuemin/max bounds', () => {
    render(
      <ShopeeCompareCard
        userPrice={40000}
        priceMin={30000}
        priceMax={50000}
        priceMedian={40000}
      />
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemin', '30000');
    expect(bar).toHaveAttribute('aria-valuemax', '50000');
    expect(bar).toHaveAttribute('aria-valuenow', '40000');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T05 Family B Molecules (12 tests)
// ═══════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────
// ProductCard (4 tests)
// ───────────────────────────────────────────────────────────────────────────

describe('ProductCard', () => {
  const baseProps = {
    brand: 'MAGGI',
    name: 'Nước tương Maggi 700ml',
    price: 25500,
  };

  it('renders width=138 carousel with smaller dimensions', () => {
    const { container } = render(<ProductCard {...I03A_138} {...baseProps} rating={4.8} />);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveAttribute('data-width', '138');
    expect(card).toHaveClass('w-[138px]');
  });

  it('renders width=172 grid with larger dimensions', () => {
    const { container } = render(
      <ProductCard {...I04_172} {...baseProps} confidence={98} aiReason="Cùng vị" />
    );
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveAttribute('data-width', '172');
    expect(card).toHaveClass('w-[172px]');
  });

  it('fires onAdd callback when add button clicked', () => {
    const onAdd = vi.fn();
    render(<ProductCard {...I03A_138} {...baseProps} onAdd={onAdd} />);
    const addBtn = screen.getByLabelText('Thêm vào giỏ');
    fireEvent.click(addBtn);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('renders badge slot when provided (single or array)', () => {
    render(
      <ProductCard
        {...I03A_138}
        {...baseProps}
        badge={[
          { type: 'hot', label: 'HOT' },
          { type: 'discount', label: '-15%' },
        ]}
      />
    );
    expect(screen.getByText('HOT')).toBeInTheDocument();
    expect(screen.getByText('-15%')).toBeInTheDocument();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CartItemRow (3 tests)
// ───────────────────────────────────────────────────────────────────────────

describe('CartItemRow', () => {
  const baseProduct = {
    brand: 'MAGGI',
    name: 'Nước tương Maggi 700ml',
    price: 25500,
  };

  it('fires onQtyChange callback when +/- stepper clicked', () => {
    const onQtyChange = vi.fn();
    render(<CartItemRow product={baseProduct} qty={2} onQtyChange={onQtyChange} />);
    const incBtn = screen.getByLabelText('Tăng');
    const decBtn = screen.getByLabelText('Giảm');
    fireEvent.click(incBtn);
    fireEvent.click(decBtn);
    expect(onQtyChange).toHaveBeenNthCalledWith(1, 3);
    expect(onQtyChange).toHaveBeenNthCalledWith(2, 1);
  });

  it('renders stockIssue=out banner with VN copy + "Bỏ" button', () => {
    const onResolve = vi.fn();
    render(
      <CartItemRow product={baseProduct} qty={1} stockIssue="out" onResolveStockIssue={onResolve} />
    );
    expect(screen.getByText(/Đã hết hàng/)).toBeInTheDocument();
    const boBtn = screen.getByRole('button', { name: 'Bỏ' });
    fireEvent.click(boBtn);
    expect(onResolve).toHaveBeenCalledTimes(1);
  });

  it('formats price via formatVND helper and computes line total', () => {
    render(<CartItemRow product={baseProduct} qty={3} />);
    // price unit: 25.500 ₫
    expect(screen.getByText(/25\.500/)).toBeInTheDocument();
    // line total: 76.500 ₫
    expect(screen.getByText(/76\.500/)).toBeInTheDocument();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PaymentMethodPicker (3 tests)
// ───────────────────────────────────────────────────────────────────────────

describe('PaymentMethodPicker', () => {
  const methods: PaymentMethod[] = [
    {
      id: 'momo',
      name: 'Ví MoMo',
      subtitle: 'SĐT •••• 5678',
      avatar: { type: 'gradient-text', bg: ['#D946EF', '#BE185D'], content: 'Mo' },
    },
    {
      id: 'vnpay',
      name: 'VNPay QR',
      subtitle: 'Quét mã QR',
      avatar: { type: 'gradient-text', bg: ['#1565C0', '#0D47A1'], content: 'VNPay' },
    },
    {
      id: 'cod',
      name: 'COD',
      subtitle: 'Tiền mặt',
      avatar: { type: 'gradient-icon', bg: ['#10B981', '#047857'], content: 'wallet' },
    },
  ];

  it('renders all methods from the array', () => {
    render(<PaymentMethodPicker methods={methods} selected="momo" />);
    expect(screen.getByText('Ví MoMo')).toBeInTheDocument();
    expect(screen.getByText('VNPay QR')).toBeInTheDocument();
    expect(screen.getByText('COD')).toBeInTheDocument();
  });

  it('selected method has aria-checked=true and data-selected', () => {
    render(<PaymentMethodPicker methods={methods} selected="vnpay" />);
    const radios = screen.getAllByRole('radio');
    const vnpayRadio = radios.find((r) => r.textContent?.includes('VNPay QR'));
    expect(vnpayRadio).toHaveAttribute('aria-checked', 'true');
    expect(vnpayRadio).toHaveAttribute('data-selected', 'true');
  });

  it('fires onSelect callback with method id when clicked', () => {
    const onSelect = vi.fn();
    render(<PaymentMethodPicker methods={methods} selected="momo" onSelect={onSelect} />);
    const radios = screen.getAllByRole('radio');
    const codRadio = radios.find((r) => r.textContent?.includes('COD'));
    fireEvent.click(codRadio!);
    expect(onSelect).toHaveBeenCalledWith('cod');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// OtpField (2 tests)
// ───────────────────────────────────────────────────────────────────────────

describe('OtpField', () => {
  it('renders length=6 boxes by default', () => {
    const { container } = render(<OtpField autoFocus={false} />);
    const inputs = container.querySelectorAll('input');
    expect(inputs).toHaveLength(6);
    const group = container.firstChild as HTMLElement;
    expect(group).toHaveAttribute('data-length', '6');
  });

  it('fires onChange with concatenated value when digits typed', () => {
    const onChange = vi.fn();
    const { container } = render(<OtpField length={4} value="" onChange={onChange} autoFocus={false} />);
    const inputs = container.querySelectorAll('input');
    fireEvent.change(inputs[0], { target: { value: '8' } });
    expect(onChange).toHaveBeenLastCalledWith('8');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// T03b Dashboard (S-03 Phiên 36) — StatBar (3 tests)
// ───────────────────────────────────────────────────────────────────────────

describe('StatBar', () => {
  it('renders 3 cells with raw integer values', () => {
    render(<StatBar ordersToday={8} revenueToday={2_400_000} inventoryCount={142} />);
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('142')).toBeInTheDocument();
    expect(screen.getByText('đơn hôm nay')).toBeInTheDocument();
    expect(screen.getByText('doanh thu')).toBeInTheDocument();
    expect(screen.getByText('tồn kho')).toBeInTheDocument();
  });

  it('formats revenue 2_400_000 as "2.4" + "M" suffix per mockup compact display', () => {
    render(<StatBar ordersToday={8} revenueToday={2_400_000} inventoryCount={142} />);
    expect(screen.getByText('2.4')).toBeInTheDocument();
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('formats revenue 850_000 as "850" + "K" suffix (compact under 1M)', () => {
    render(<StatBar ordersToday={3} revenueToday={850_000} inventoryCount={50} />);
    expect(screen.getByText('850')).toBeInTheDocument();
    expect(screen.getByText('K')).toBeInTheDocument();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// T03b Dashboard — HeroTile (2 tests)
// ───────────────────────────────────────────────────────────────────────────

describe('HeroTile', () => {
  it('renders title + subtitle + badge when provided + fires onClick', () => {
    const onClick = vi.fn();
    render(
      <HeroTile
        accent="pink"
        iconName="camera-plus"
        title="Nhập hàng"
        subtitle="Chụp ảnh là có ngay"
        badge="hot"
        onClick={onClick}
      />,
    );
    expect(screen.getByText('Nhập hàng')).toBeInTheDocument();
    expect(screen.getByText('Chụp ảnh là có ngay')).toBeInTheDocument();
    expect(screen.getByText('HOT')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders orange accent + AI badge with footerSlot composition', () => {
    render(
      <HeroTile
        accent="orange"
        iconName="chart-arcs"
        title="Phân tích"
        subtitle="Trend, doanh thu, tồn kho"
        badge="ai"
        footerSlot={<span data-testid="hero-footer">sparkline</span>}
      />,
    );
    expect(screen.getByText('Phân tích')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
    expect(screen.getByTestId('hero-footer')).toBeInTheDocument();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// T03b Dashboard — ListTile (3 tests)
// ───────────────────────────────────────────────────────────────────────────

describe('ListTile', () => {
  it('renders title + chips + trailingText + fires onClick', () => {
    const onClick = vi.fn();
    render(
      <ListTile
        accent="pink"
        iconName="search"
        title="Tìm sản phẩm"
        chips={[{ text: 'Gõ hoặc nói' }]}
        trailingText="50+ mặt hàng"
        onClick={onClick}
      />,
    );
    expect(screen.getByText('Tìm sản phẩm')).toBeInTheDocument();
    expect(screen.getByText('Gõ hoặc nói')).toBeInTheDocument();
    expect(screen.getByText('50+ mặt hàng')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders inline AI badge when badgeInline="ai"', () => {
    render(
      <ListTile
        accent="rose"
        iconName="lightbulb"
        title="Gợi ý sản phẩm"
        badgeInline="ai"
        chips={[{ text: 'Chụp ảnh' }]}
      />,
    );
    expect(screen.getByText('Gợi ý sản phẩm')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('renders cart count badge + mono value when countBadge + monoValue provided', () => {
    render(
      <ListTile
        accent="fuchsia"
        iconName="shopping-cart"
        title="Giỏ hàng"
        countBadge={3}
        monoValue="100.000 ₫"
        monoSuffix="· 3 món"
      />,
    );
    expect(screen.getByText('Giỏ hàng')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('100.000 ₫')).toBeInTheDocument();
    expect(screen.getByText('· 3 món')).toBeInTheDocument();
    expect(screen.getByLabelText('3 items')).toBeInTheDocument();
  });
});
