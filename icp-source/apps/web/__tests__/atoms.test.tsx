/**
 * apps/web/__tests__/atoms.test.tsx
 *
 * Smoke tests for S-01-T02 atom components.
 *
 * Slice:    S-01 UI Foundation
 * Task:     T02 AC-18
 *
 * Framework: vitest (C-09 substitute for jest) + @testing-library/react
 * Scope: render + critical prop behavior. Full variant matrices defer T07.
 *
 * Goal: ensure each tested atom renders without throwing + basic prop wiring works.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/icp/atoms/Button';
import { BrainIcon } from '@/components/icp/atoms/BrainIcon';
import { MiniSparkline } from '@/components/icp/atoms/MiniSparkline';
import { ChipPill } from '@/components/icp/atoms/ChipPill';
import { Spinner } from '@/components/icp/atoms/Spinner';

describe('<Button>', () => {
  it('renders children + handles onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Bắt đầu</Button>);
    const btn = screen.getByRole('button', { name: /Bắt đầu/ });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders Spinner when loading + disables button', () => {
    render(<Button loading>Đang xử lý</Button>);
    const btn = screen.getByRole('button', { name: /Đang xử lý/ });
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    // aria-busy attribute set when loading
    expect(btn.getAttribute('aria-busy')).toBe('true');
    // Spinner role="status" present
    expect(screen.getByRole('status', { name: /loading/i })).toBeTruthy();
  });

  it('applies variant + size classes', () => {
    const { rerender } = render(<Button variant="success" size="lg">OK</Button>);
    const btn = screen.getByRole('button', { name: /OK/ });
    expect(btn.className).toContain('bg-icp-green-500');
    expect(btn.className).toContain('h-12');

    rerender(<Button variant="mic-grad" size="sm">Nói</Button>);
    const btn2 = screen.getByRole('button', { name: /Nói/ });
    expect(btn2.className).toContain('grad-mic');
    expect(btn2.className).toContain('h-9');
  });
});

describe('<BrainIcon>', () => {
  it('renders sm tier as simplified outline SVG', () => {
    const { container } = render(<BrainIcon size="sm" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    // sm tier uses stroke="currentColor" (single-color outline per C-06)
    expect(svg?.getAttribute('stroke')).toBe('currentColor');
  });

  it('renders md tier as two-tone SVG with gradient', () => {
    const { container } = render(<BrainIcon size="md" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    // md tier has <linearGradient> def
    const gradient = svg?.querySelector('linearGradient');
    expect(gradient).toBeTruthy();
  });

  it('renders lg tier with aura div + full gradient SVG', () => {
    const { container } = render(<BrainIcon size="lg" />);
    // lg tier wraps SVG in a div with aura halo
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.tagName).toBe('DIV');
    // Inner SVG with radial gradient
    const svg = wrapper.querySelector('svg');
    const radialGrad = svg?.querySelector('radialGradient');
    expect(radialGrad).toBeTruthy();
  });

  it('interpolates numeric size to correct tier', () => {
    // size={48} → lg tier (>40)
    const { container: c1 } = render(<BrainIcon size={48} />);
    expect((c1.firstChild as HTMLElement).tagName).toBe('DIV');

    // size={20} → sm tier (<32)
    const { container: c2 } = render(<BrainIcon size={20} />);
    expect((c2.firstChild as HTMLElement).tagName).toBe('svg');
    expect((c2.firstChild as SVGElement).getAttribute('stroke')).toBe('currentColor');
  });
});

describe('<MiniSparkline>', () => {
  it('renders SVG with unique gradient ID (CROSS_INTENT_PATTERNS §7)', () => {
    const data = [1, 2, 3, 4, 5];
    const { container } = render(
      <>
        <MiniSparkline data={data} accent="pink" />
        <MiniSparkline data={data} accent="green" />
      </>
    );
    const gradients = container.querySelectorAll('linearGradient');
    expect(gradients.length).toBe(2);
    const id1 = gradients[0].getAttribute('id');
    const id2 = gradients[1].getAttribute('id');
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);  // critical: unique IDs per instance
  });

  it('handles empty data gracefully (no throw)', () => {
    expect(() => render(<MiniSparkline data={[]} />)).not.toThrow();
  });

  it('applies green accent native (C-11 trend-green palette)', () => {
    const { container } = render(<MiniSparkline data={[1, 2, 3]} accent="green" />);
    const path = container.querySelector('path[stroke]');
    expect(path?.getAttribute('stroke')).toBe('#10B981');
  });
});

describe('<ChipPill>', () => {
  it('renders children + filter variant + native green', () => {
    const { container } = render(
      <ChipPill variant="filter" color="green">Đang tăng</ChipPill>
    );
    expect(screen.getByText('Đang tăng')).toBeTruthy();
    // green color uses bg-icp-green-50
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('bg-icp-green-50');
  });

  it('interactive mode handles click + has role=button', () => {
    const onClick = vi.fn();
    render(
      <ChipPill variant="filter" color="pink" interactive onClick={onClick}>
        Tap me
      </ChipPill>
    );
    const chip = screen.getByRole('button', { name: /Tap me/ });
    expect(chip).toBeTruthy();
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('selected prop sets data-state="active"', () => {
    const { container } = render(
      <ChipPill variant="filter" color="pink" interactive selected onClick={() => {}}>
        Active
      </ChipPill>
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('data-state')).toBe('active');
    expect(root.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('<Spinner>', () => {
  it('renders SVG with role=status + animate-spin class', () => {
    const { container } = render(<Spinner size="md" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('role')).toBe('status');
    expect(svg?.className.baseVal).toContain('animate-spin');
  });

  it('respects numeric size override', () => {
    const { container } = render(<Spinner size={48} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('48');
    expect(svg?.getAttribute('height')).toBe('48');
  });
});
