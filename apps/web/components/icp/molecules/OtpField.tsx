'use client';

/**
 * apps/web/components/icp/molecules/OtpField.tsx
 *
 * Molecule: <OtpField> — Family B I06 state-G 3DS OTP boxed input
 *
 * Slice:    S-01 UI Foundation
 * Task:     T05 AC-4, AC-9 (dev preview)
 *
 * Source:   Family B mockup HTML (per C-03 structural inference + Tailwind translation):
 *           - intent-06/intent-06-state-G-otp.html line 178-210 (6-box OTP grid +
 *             filled box pink-500 border + cursor animate-pulse + empty box pink-50 bg)
 *
 * Reach:    I06 payment 3DS verification (single-intent, NOT C-24 multi-intent qualifier).
 *
 * Decisions applied:
 * - C-03 structural inference + C-23 atom bypass (42×50 digit cell raw <input>
 *   styled Tailwind; shadcn <Input> wrap considered ST-3 but raw <input> via
 *   ref array is simpler for OTP-specific autofocus chain semantics) — see
 *   decisions-log Section 3
 * - C-07 navigation-agnostic — onChange callback fires with full concatenated value
 * - C-13 N/A (no CVA variant collision)
 * - C-15 'use client' for useState + useRef + onChange + onKeyDown + onPaste handlers
 * - C-18 Tier 4 Tailwind utility inline (no @layer components classes added)
 * - C-22 atom interface verified DISCOVER — only <Icon> from atoms barrel (none
 *   needed for OtpField); shadcn <Input> bypassed per ST-3 (raw <input> simpler)
 *
 * Keyboard navigation (per ST-5 default 4-of-5 behaviors):
 * - Type digit → auto-advance focus to next cell
 * - Backspace empty cell → focus previous cell + clear
 * - Paste → autofill all cells (browser SMS Retriever pattern + clipboard paste)
 * - Tab key → native browser tab order (preserves a11y)
 * - Arrow keys → DEFERRED (nice-to-have, post-S-01)
 *
 * Browser autofill (ST-1 KI declared if not testable):
 * - autoComplete="one-time-code" + inputMode="numeric" + pattern="[0-9]*"
 * - First cell receives autocomplete; component splits autofilled value across cells
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export type OtpFieldLength = 4 | 6;

export interface OtpFieldProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'onChange'> {
  /** Number of digit cells (4 or 6; default 6 per mockup state-G) */
  length?: OtpFieldLength;
  /** Controlled value — string of digits (length must match `length` prop or be shorter) */
  value?: string;
  /** Fires on every value change with concatenated digit string */
  onChange?: (value: string) => void;
  /** Disabled state (e.g., during submission) */
  disabled?: boolean;
  /** Auto-focus first cell on mount (default true) */
  autoFocus?: boolean;
}

export const OtpField = React.forwardRef<HTMLDivElement, OtpFieldProps>(
  ({ length = 6, value, onChange, disabled = false, autoFocus = true, className, ...props }, ref) => {
    // Internal state when uncontrolled; controlled when `value` prop provided
    const [internalValue, setInternalValue] = React.useState<string>('');
    const currentValue = value ?? internalValue;
    const digits = React.useMemo(() => {
      const arr: string[] = [];
      for (let i = 0; i < length; i++) arr.push(currentValue[i] ?? '');
      return arr;
    }, [currentValue, length]);

    // Refs to each cell input for focus management
    const inputRefs = React.useRef<Array<HTMLInputElement | null>>([]);

    // First-cell autofocus
    React.useEffect(() => {
      if (autoFocus && !disabled) {
        inputRefs.current[0]?.focus();
      }
    }, [autoFocus, disabled]);

    const updateValue = React.useCallback(
      (newValue: string) => {
        const truncated = newValue.slice(0, length);
        if (value === undefined) setInternalValue(truncated);
        onChange?.(truncated);
      },
      [length, onChange, value]
    );

    const handleCellChange = (index: number, raw: string): void => {
      // Accept only the LAST typed digit (in case input fires with full string)
      const digit = raw.replace(/\D/g, '').slice(-1);
      const next = digits.slice();
      next[index] = digit;
      updateValue(next.join(''));
      // Auto-advance focus on digit entry
      if (digit && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === 'Backspace' && !digits[index] && index > 0) {
        // Empty cell + backspace → focus previous + clear it
        e.preventDefault();
        const next = digits.slice();
        next[index - 1] = '';
        updateValue(next.join(''));
        inputRefs.current[index - 1]?.focus();
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>): void => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
      if (!pasted) return;
      updateValue(pasted);
      // Focus next-empty cell or last cell
      const focusIndex = Math.min(pasted.length, length - 1);
      inputRefs.current[focusIndex]?.focus();
    };

    return (
      <div
        ref={ref}
        className={cn('flex gap-2 justify-center', className)}
        role="group"
        aria-label="Mã OTP"
        data-length={length}
        {...props}
      >
        {digits.map((digit, index) => {
          const isFilled = digit !== '';
          const isActive = !isFilled && index === currentValue.length;
          const cellClass = cn(
            'w-[42px] h-[50px] rounded-[11px] text-center text-[22px] font-bold font-mono',
            'transition-all outline-none',
            isFilled && 'bg-white border-[0.5px] border-icp-pink-500 text-icp-pink-900',
            isActive &&
              'bg-white border-[0.5px] border-icp-pink-500 text-icp-pink-500 shadow-[0_0_0_3px_rgba(233,30,99,0.1)]',
            !isFilled && !isActive && 'bg-icp-pink-50 border-[0.5px] border-icp-pink-200',
            disabled && 'opacity-50 cursor-not-allowed',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1'
          );
          return (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              // First cell receives autofill; browser distributes via paste handler
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              value={digit}
              disabled={disabled}
              onChange={(e) => handleCellChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              className={cellClass}
              aria-label={`Số thứ ${index + 1} trên ${length}`}
            />
          );
        })}
      </div>
    );
  }
);
OtpField.displayName = 'OtpField';
