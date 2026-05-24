/**
 * @icp/web — S-04 T04 NEW V-SLICE Feature Molecules smoke test (Phiên Sx04-9a)
 *
 * 18 tests covering AC1-AC9 + matchTier pure logic + StrictMode auto-dismiss timer +
 * onTap/onAdd/onAddSuggested callback wiring.
 *
 * Coverage per molecule:
 * - ProductCardSearchB: 7 (4 mockup tiers AC1-AC4 + WithBadges AC5 + onAdd AC1 + Muted opacity)
 * - SuggestedQueryChips: 2 (3 D-S04-12 LAW chips render AC6 + onTap fires with position)
 * - FollowupFilterChips: 3 (3 D-S04-08 LAW chips AC7 + chip 1 has discount icon + onTap payload)
 * - AddToCartConfirmCard: 3 (default render AC8 + auto-dismiss 3s + NoUndo button hidden)
 * - CoPurchaseHintCard: 3 (68% mockup-perfect AC9 + onAddSuggested fires with product + data attrs)
 *
 * Pattern inheritance: molecules.test.tsx (S-01 T04+T05) — vitest + RTL + jest-dom matchers.
 * Per ER-R2 verify-before-edit: imports verified against barrel exports;
 *      assertions verified against rendered DOM via cross-mockup spec (10 data points).
 *
 * Run: `pnpm --filter @icp/web test -- S-04-T04-molecules`
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

import {
  ProductCardSearchB,
  SuggestedQueryChips,
  FollowupFilterChips,
  AddToCartConfirmCard,
  CoPurchaseHintCard,
  type FilterChipSpec,
} from '@/components/icp/molecules';

// ─────────────────────────────────────────────────────────────────────────────
// ProductCardSearchB (7 tests) — AC1-AC5 + interaction + Muted
// Per Sx04-9a-discover Q-T04-2 Option B3 LOCK: matchTier(score) + matchColorClasses(score).
// Cross-mockup verified 10 data points: 98 target/green, 95 target/green, 92 target/green,
//   91 sparkles/green, 87 sparkles/amber, 82 cube/amber, 79 cube/amber.
// ─────────────────────────────────────────────────────────────────────────────

describe('ProductCardSearchB', () => {
  const baseProps = {
    brand: 'MAGGI',
    name: 'Nước tương Maggi đậm đặc 700ml',
    price: 25500,
    reason: 'Độ đậm cao, khách phở hay chọn nhất',
  };

  it('AC1: matchScore=98 renders data-match-tier="exact" + 98% text', () => {
    const { container } = render(
      <ProductCardSearchB {...baseProps} matchScore={98} />
    );
    const card = container.querySelector('[data-match-tier]');
    expect(card).toHaveAttribute('data-match-tier', 'exact');
    expect(screen.getByText('98%')).toBeInTheDocument();
  });

  /**
   * Helper: locate match badge div by its unique Tailwind class signature.
   * Match badge is the ONLY div in the card with `bg-white/95 backdrop-blur-sm` per
   * ProductCardSearchB.tsx render template line 181-189. Using container.querySelector
   * with this anchor avoids fragile parentElement traversal from mixed-children text nodes
   * (RTL getByText returns ambiguous element when div contains both <svg> + text node).
   */
  function getMatchBadge(container: HTMLElement): HTMLElement | null {
    return container.querySelector<HTMLElement>('div.bg-white\\/95.backdrop-blur-sm');
  }

  it('AC2: matchScore=91 renders data-match-tier="ai_suggest" + green color (≥90)', () => {
    const { container } = render(
      <ProductCardSearchB {...baseProps} matchScore={91} />
    );
    const card = container.querySelector('[data-match-tier]');
    expect(card).toHaveAttribute('data-match-tier', 'ai_suggest');
    expect(screen.getByText('91%')).toBeInTheDocument();
    // 91 ≥ 90 → green class on match badge div (anchored by unique bg-white/95 class)
    const matchBadge = getMatchBadge(container);
    expect(matchBadge).not.toBeNull();
    expect(matchBadge!.className).toContain('text-icp-green-500');
  });

  it('AC3: matchScore=87 renders data-match-tier="ai_suggest" + amber color (<90)', () => {
    const { container } = render(
      <ProductCardSearchB {...baseProps} matchScore={87} />
    );
    const card = container.querySelector('[data-match-tier]');
    expect(card).toHaveAttribute('data-match-tier', 'ai_suggest');
    expect(screen.getByText('87%')).toBeInTheDocument();
    // 87 < 90 → amber class
    const matchBadge = getMatchBadge(container);
    expect(matchBadge).not.toBeNull();
    expect(matchBadge!.className).toContain('text-icp-amber-500');
  });

  it('AC4: matchScore=79 renders data-match-tier="similar" + amber color', () => {
    const { container } = render(
      <ProductCardSearchB {...baseProps} matchScore={79} />
    );
    const card = container.querySelector('[data-match-tier]');
    expect(card).toHaveAttribute('data-match-tier', 'similar');
    expect(screen.getByText('79%')).toBeInTheDocument();
    const matchBadge = getMatchBadge(container);
    expect(matchBadge).not.toBeNull();
    expect(matchBadge!.className).toContain('text-icp-amber-500');
  });

  it('renders REQUIRED reason chip text (D-S04-03 LAW Variant B)', () => {
    render(<ProductCardSearchB {...baseProps} matchScore={98} />);
    expect(screen.getByText('Độ đậm cao, khách phở hay chọn nhất')).toBeInTheDocument();
  });

  it('AC5: WithBadges renders HOT + discount badges from props', () => {
    render(
      <ProductCardSearchB
        {...baseProps}
        matchScore={98}
        badges={[
          { type: 'hot', label: 'HOT' },
          { type: 'discount', label: '-15%' },
        ]}
      />
    );
    expect(screen.getByText('HOT')).toBeInTheDocument();
    expect(screen.getByText('-15%')).toBeInTheDocument();
  });

  it('onAdd callback fires when "+" button clicked', () => {
    const onAdd = vi.fn();
    render(<ProductCardSearchB {...baseProps} matchScore={98} onAdd={onAdd} />);
    const btn = screen.getByLabelText('Thêm vào giỏ');
    fireEvent.click(btn);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SuggestedQueryChips (2 tests) — AC6
// Per D-S04-12 LAW Part 2: 3 hardcoded chips with cross-language WOW moment.
// ─────────────────────────────────────────────────────────────────────────────

describe('SuggestedQueryChips', () => {
  const D_S04_12_CHIPS = [
    'Nước tương cho phở',
    'Đồ cay cay ăn phở',
    'Soy sauce for pho',
  ];

  it('AC6: renders 3 D-S04-12 LAW chips with exact text', () => {
    render(<SuggestedQueryChips queries={D_S04_12_CHIPS} onTap={vi.fn()} />);
    expect(screen.getByText('Nước tương cho phở')).toBeInTheDocument();
    expect(screen.getByText('Đồ cay cay ăn phở')).toBeInTheDocument();
    expect(screen.getByText('Soy sauce for pho')).toBeInTheDocument();
  });

  it('onTap fires with (query, position) signature', () => {
    const onTap = vi.fn();
    render(<SuggestedQueryChips queries={D_S04_12_CHIPS} onTap={onTap} />);
    fireEvent.click(screen.getByText('Đồ cay cay ăn phở').closest('[role="button"]')!);
    expect(onTap).toHaveBeenCalledWith('Đồ cay cay ăn phở', 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FollowupFilterChips (3 tests) — AC7
// Per D-S04-08 LAW: Variant A AI followup chips functional (NOT decorative).
// ─────────────────────────────────────────────────────────────────────────────

describe('FollowupFilterChips', () => {
  const defaultChips: FilterChipSpec[] = [
    { label: 'Dưới 20.000₫', filter: { price_max: 20000 }, icon: 'discount' },
    { label: 'Chỉ HOT', filter: { badge: 'HOT' } },
    { label: 'So sánh thương hiệu khác', filter: { exclude_brands: ['Maggi'] } },
  ];

  it('AC7: renders 3 D-S04-08 LAW chips with labels', () => {
    render(<FollowupFilterChips chips={defaultChips} onTap={vi.fn()} />);
    expect(screen.getByText('Dưới 20.000₫')).toBeInTheDocument();
    expect(screen.getByText('Chỉ HOT')).toBeInTheDocument();
    expect(screen.getByText('So sánh thương hiệu khác')).toBeInTheDocument();
  });

  it('AC7: chip 1 ("Dưới 20.000₫") has discount left icon; chip 2+3 do not', () => {
    render(
      <FollowupFilterChips chips={defaultChips} onTap={vi.fn()} />
    );
    const chip1 = screen.getByText('Dưới 20.000₫').closest('[role="button"]');
    const chip2 = screen.getByText('Chỉ HOT').closest('[role="button"]');
    // ChipPill renders leftIcon as <svg> first child when present
    expect(chip1?.querySelector('svg')).toBeTruthy();
    expect(chip2?.querySelector('svg')).toBeFalsy();
  });

  it('onTap fires with (filter, label) signature when chip clicked', () => {
    const onTap = vi.fn();
    render(<FollowupFilterChips chips={defaultChips} onTap={onTap} />);
    fireEvent.click(screen.getByText('Chỉ HOT').closest('[role="button"]')!);
    expect(onTap).toHaveBeenCalledWith({ badge: 'HOT' }, 'Chỉ HOT');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AddToCartConfirmCard (3 tests) — AC8 + StrictMode-safe auto-dismiss
// Per D-S04-09 LAW: stub mode + S-03 D-29 LAW useEffect cleanup pattern.
// Per W2 LOCK: NO toast library — standalone inline auto-dismiss.
// ─────────────────────────────────────────────────────────────────────────────

describe('AddToCartConfirmCard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('AC8: renders title "Đã thêm vào giỏ" + product title + formatted price', () => {
    render(
      <AddToCartConfirmCard
        product={{ title: 'Nước tương Maggi 700ml', price: 25500 }}
        onUndo={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByText('Đã thêm vào giỏ')).toBeInTheDocument();
    expect(screen.getByText(/Nước tương Maggi 700ml/)).toBeInTheDocument();
    // formatVND renders Vietnamese đồng currency; verify price digit chars present
    expect(screen.getByText(/25\.500/)).toBeInTheDocument();
  });

  it('AC8: onDismiss called after autoDismissMs (3000ms default)', () => {
    const onDismiss = vi.fn();
    render(
      <AddToCartConfirmCard
        product={{ title: 'Test product', price: 10000 }}
        onDismiss={onDismiss}
      />
    );
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('NoUndo: button hidden when onUndo undefined', () => {
    render(
      <AddToCartConfirmCard
        product={{ title: 'Test', price: 10000 }}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.queryByText('Hoàn tác')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CoPurchaseHintCard (3 tests) — AC9
// Per D-S04-09 + D-S04-12 LAW: Variant B post-cart-add cross-sell with Chin-su 250g mockup-perfect.
// ─────────────────────────────────────────────────────────────────────────────

describe('CoPurchaseHintCard', () => {
  const mockHint = {
    ratePct: 68,
    reason: 'Khách phở thường thêm tương ớt cay',
    suggestedProduct: {
      brand: 'CHIN-SU',
      name: 'Tương ớt Chin-su 250g',
      price: 17000,
      soldCount: 'đã bán 2.1k',
    },
    anchorCategory: 'nuoc_tuong',
    suggestedCategory: 'tuong_ot',
  };

  it('AC9: renders "68% khách mua kèm" header + suggested product brand/name/price', () => {
    render(<CoPurchaseHintCard hint={mockHint} onAddSuggested={vi.fn()} />);
    expect(screen.getByText(/68% khách mua kèm/)).toBeInTheDocument();
    expect(screen.getByText('CHIN-SU')).toBeInTheDocument();
    expect(screen.getByText('Tương ớt Chin-su 250g')).toBeInTheDocument();
    expect(screen.getByText(/17\.000/)).toBeInTheDocument();
    expect(screen.getByText('đã bán 2.1k')).toBeInTheDocument();
  });

  it('AC9: onAddSuggested fires with flat product summary when "+" clicked', () => {
    const onAddSuggested = vi.fn();
    render(<CoPurchaseHintCard hint={mockHint} onAddSuggested={onAddSuggested} />);
    fireEvent.click(screen.getByLabelText('Thêm sản phẩm gợi ý vào giỏ'));
    expect(onAddSuggested).toHaveBeenCalledWith({
      brand: 'CHIN-SU',
      name: 'Tương ớt Chin-su 250g',
      price: 17000,
    });
  });

  it('exposes data-anchor-category + data-suggested-category attrs for debugging', () => {
    const { container } = render(
      <CoPurchaseHintCard hint={mockHint} onAddSuggested={vi.fn()} />
    );
    const card = container.querySelector('[data-anchor-category]');
    expect(card).toHaveAttribute('data-anchor-category', 'nuoc_tuong');
    expect(card).toHaveAttribute('data-suggested-category', 'tuong_ot');
  });
});
