'use client';

/**
 * apps/web/components/icp/molecules/PaymentMethodPicker.tsx
 *
 * Molecule: <PaymentMethodPicker> — Family B I06 payment method list w/ radio selection
 *
 * Slice:    S-01 UI Foundation
 * Task:     T05 AC-3, AC-8 (dev preview)
 *
 * Source:   Family B mockup HTML (per C-03 structural inference + Tailwind translation):
 *           - intent-06/intent-06-state-B-method.html line 165-235 (5 methods: MoMo
 *             selected + VNPay + Bank Transfer + COD + Mock)
 *
 * Reach:    I06 payment flow (single-intent, NOT C-24 multi-intent qualifier).
 *
 * Decisions applied:
 * - C-03 structural inference + C-23 atom bypass for micro-elements (22×22
 *   radio circle, 8px discount badge "−2%", +15.000₫ surcharge badge) —
 *   see decisions-log Section 3
 * - C-07 navigation-agnostic — onSelect callback with method id
 * - C-13 Omit 'onSelect' from HTMLAttributes (HTMLDivElement has native
 *   onSelect for text selection events — collision with our callback)
 * - C-15 'use client' for onSelect event handler + radio click handling
 * - C-18 Tier 4 Tailwind utility inline (no @layer components classes added)
 * - C-22 atom interface verified DISCOVER — bypasses Button/ChipPill atoms;
 *   only <Icon> from atoms barrel consumed
 *
 * Component design: data-driven `methods: Array<PaymentMethod>` open-ended per
 * ST-4 default path. Caller hardcodes brand-color avatars (no brand asset
 * imports). Dev preview page AC-8 supplies 5 methods matching mockup state-B.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';
import type { IconName } from '@/lib/icon-map';

// Public types
export interface PaymentMethodAvatar {
  /** `gradient-text` shows text label inside grad-bg (e.g., "Mo", "VNPay"); `gradient-icon` shows lucide icon inside grad-bg */
  type: 'gradient-text' | 'gradient-icon';
  /** Two-stop linear-gradient colors [from, to] hex */
  bg: [string, string];
  /** Text content (when type='gradient-text') or IconName (when type='gradient-icon') */
  content: string | IconName;
  /** Optional dashed border modifier (mockup "Mock" test method line 230 uses dashed) */
  dashed?: boolean;
}

export interface PaymentMethodBadge {
  /** `success` green-grad ("−2%" cashback), `warning` amber ("+15.000₫" surcharge) */
  type: 'success' | 'warning';
  label: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  subtitle: string;
  avatar: PaymentMethodAvatar;
  badge?: PaymentMethodBadge;
}

export interface PaymentMethodPickerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'onSelect'> {
  methods: PaymentMethod[];
  selected?: string;
  onSelect?: (id: string) => void;
}

// PRIVATE: method avatar render (42×42)
function MethodAvatar(props: { avatar: PaymentMethodAvatar }): React.ReactElement {
  const { avatar } = props;
  const dashed = avatar.dashed ? 'border-[0.5px] border-dashed border-icp-pink-200' : '';
  return (
    <div
      className={cn(
        'w-[42px] h-[42px] rounded-[11px] flex items-center justify-center flex-shrink-0 shadow-[0_3px_8px_rgba(0,0,0,0.2)]',
        dashed
      )}
      style={{
        background: `linear-gradient(135deg, ${avatar.bg[0]}, ${avatar.bg[1]})`,
      }}
    >
      {avatar.type === 'gradient-text' ? (
        <span className="text-[12px] text-white font-bold font-mono">{avatar.content}</span>
      ) : (
        <Icon name={avatar.content as IconName} size={22} className="text-white" />
      )}
    </div>
  );
}

// PRIVATE: method badge (success green-grad / warning amber)
function MethodBadge(props: { badge: PaymentMethodBadge }): React.ReactElement {
  const bg =
    props.badge.type === 'success'
      ? 'bg-gradient-to-br from-icp-green-500 to-icp-green-600 text-white'
      : 'bg-icp-amber-100 text-icp-amber-800';
  return (
    <span className={cn('inline-flex items-center text-[8px] font-bold px-1.5 py-[1px] rounded-[4px]', bg)}>
      {props.badge.label}
    </span>
  );
}

// PRIVATE: radio circle (22×22)
function RadioCircle(props: { selected: boolean }): React.ReactElement {
  if (props.selected) {
    return (
      <div className="w-[22px] h-[22px] bg-gradient-to-br from-icp-pink-500 to-icp-rose-500 rounded-full flex items-center justify-center shadow-[0_3px_8px_rgba(233,30,99,0.35)] flex-shrink-0">
        <Icon name="check" size={13} className="text-white" strokeWidth={3} />
      </div>
    );
  }
  return (
    <div className="w-[22px] h-[22px] bg-white border border-icp-pink-200 rounded-full flex-shrink-0" />
  );
}

// MAIN: <PaymentMethodPicker>
export const PaymentMethodPicker = React.forwardRef<HTMLDivElement, PaymentMethodPickerProps>(
  ({ methods, selected, onSelect, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="radiogroup"
        aria-label="Phương thức thanh toán"
        className={cn('flex flex-col gap-2.5', className)}
        {...props}
      >
        {methods.map((method) => {
          const isSelected = method.id === selected;
          const cardClass = isSelected
            ? 'bg-gradient-to-br from-icp-pink-100 to-icp-pink-200 border-[0.5px] border-icp-pink-500 shadow-[0_4px_14px_rgba(233,30,99,0.15)]'
            : 'bg-white border-[0.5px] border-icp-pink-200';
          return (
            <button
              key={method.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              data-selected={isSelected ? 'true' : 'false'}
              onClick={() => onSelect?.(method.id)}
              className={cn(
                'w-full text-left rounded-[14px] p-3 transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                cardClass
              )}
            >
              <div className="flex gap-2.5 items-center">
                <MethodAvatar avatar={method.avatar} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-[2px]">
                    <span className="text-[13px] text-icp-pink-900 font-bold">{method.name}</span>
                    {method.badge ? <MethodBadge badge={method.badge} /> : null}
                  </div>
                  <div className="text-[10px] text-icp-pink-700">{method.subtitle}</div>
                </div>
                <RadioCircle selected={isSelected} />
              </div>
            </button>
          );
        })}
      </div>
    );
  }
);
PaymentMethodPicker.displayName = 'PaymentMethodPicker';
