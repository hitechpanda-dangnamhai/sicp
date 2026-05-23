'use client';

/**
 * apps/web/components/icp/atoms/Button.tsx
 *
 * Atom: <Button> — MoMo-themed button extending shadcn primitive
 *
 * Slice:    S-01 UI Foundation
 * Task:     T02 AC-5
 *
 * Source:   shadcn components/ui/button.tsx (forwardRef + asChild Radix Slot)
 *           Intent mockups: intent-01 state-0 CTA (gradient), intent-08 splash CTA,
 *           intent-02 state-A bottom-bar buttons (cancel + stop)
 *
 * Reach:    All intents — primary CTAs, secondary actions, ghost cancel buttons
 *
 * Decisions applied:
 * - D-03 Tailwind v3 + shadcn — wraps shadcn Button, NOT re-implements
 * - C-07 navigation-agnostic — accepts onClick only, no href; consumer wraps with
 *        <Link> or router.push at V-SLICE level
 * - C-08 i18n hardcode VN — consumer passes label as children
 * - C-11 trend-green — variant="success" uses bg-icp-green-500 native (no fallback)
 * - C-12 shadcn HSL — default/secondary/destructive variants resolve to MoMo
 *        palette via HSL token mapping in globals.css
 *
 * Pattern: shadcn's default variants (default/destructive/outline/secondary/
 *          ghost/link) now resolve to MoMo palette via --primary/--secondary/etc
 *          HSL mapping. T02 adds 3 MoMo-specific variants on top:
 *          - 'mic-grad': pink→orange gradient for voice CTAs (intent-02 mic)
 *          - 'success':  mint/green for positive actions (intent-01 stock-up)
 *          - 'pink-grad': hero gradient for primary onboarding CTAs (intent-08)
 */

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';
import { Spinner } from './Spinner';
import type { IconName } from '@/lib/icon-map';

/**
 * Variant + size catalogue.
 *
 * Default shadcn variants (default/secondary/destructive/outline/ghost/link)
 * now MoMo-themed via HSL mapping (C-12). Added 3 MoMo-specific gradient/green
 * variants on top.
 */
const buttonVariants = cva(
  // Base classes — applied to ALL variants
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'font-semibold transition-all ring-offset-background',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:scale-[0.98]',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        // Shadcn defaults (now MoMo via HSL mapping)
        default:
          'bg-primary text-primary-foreground hover:bg-primary/90 shadow-icp-pink-md',
        secondary:
          'bg-icp-bg-surface text-icp-pink-700 border border-icp-border-pink hover:bg-icp-bg-tinted shadow-icp-pink-sm',
        ghost:
          'bg-transparent text-icp-pink-700 hover:bg-icp-pink-50',
        outline:
          'border border-icp-border-pink bg-transparent text-icp-pink-700 hover:bg-icp-pink-50',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md',
        link:
          'text-icp-pink-700 underline-offset-4 hover:underline',
        // MoMo-specific variants
        'pink-grad': [
          'text-white shadow-icp-pink-lg',
          'bg-[image:var(--grad-active)]',
          'hover:opacity-90',
        ],
        'mic-grad': [
          'text-white shadow-icp-mic',
          'bg-[image:var(--grad-mic)]',
          'hover:opacity-90',
        ],
        success:
          'bg-icp-green-500 text-white hover:bg-icp-green-600 shadow-md',
      },
      size: {
        sm: 'h-9 px-3 text-sm rounded-pill [&_svg]:size-3.5',
        md: 'h-11 px-5 text-sm rounded-pill [&_svg]:size-4',
        lg: 'h-12 px-6 text-base rounded-pill [&_svg]:size-5',
        icon: 'h-10 w-10 rounded-full [&_svg]:size-4',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>,
    VariantProps<typeof buttonVariants> {
  /** Render as Radix Slot — passes className+props to child element instead */
  asChild?: boolean;
  /** Show spinner instead of leftIcon; disables button while loading */
  loading?: boolean;
  /** Icon name (from lib/icon-map) shown before children */
  leftIcon?: IconName;
  /** Icon name shown after children */
  rightIcon?: IconName;
  /** Button label (VN hardcode per C-08) */
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant,
      size,
      asChild = false,
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';
    const isDisabled = disabled || loading;

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <Spinner size="sm" color={variant === 'secondary' || variant === 'ghost' || variant === 'outline' ? 'pink' : 'white'} />
        ) : leftIcon ? (
          <Icon name={leftIcon} />
        ) : null}
        {children}
        {!loading && rightIcon ? <Icon name={rightIcon} /> : null}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { buttonVariants };
