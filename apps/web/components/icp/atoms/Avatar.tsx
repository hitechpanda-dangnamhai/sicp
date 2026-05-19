/**
 * apps/web/components/icp/atoms/Avatar.tsx
 *
 * Atom: <Avatar> — circular avatar for AI bubble or user
 *
 * Slice:    S-01 UI Foundation
 * Task:     T02 AC-9
 *
 * Source:   .ai-avatar Family A pattern (intent-01/02/07 ConversationBubble)
 *           + user avatar variant (image or fallback initials)
 *
 * Reach:    I01/I02/I07 conversation thread avatars
 *
 * Decisions applied:
 * - C-06 BrainIcon size — Avatar md uses BrainIcon md (32-40px tier)
 * - C-07 navigation-agnostic
 * - C-08 i18n hardcode VN — fallback prop accepts string (consumer hardcodes)
 *
 * Implementation:
 *   role="ai" → renders <BrainIcon> inside circular pink halo wrapper
 *   role="user" → renders <img src> if provided, else fallback initials with gradient bg
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { BrainIcon } from './BrainIcon';

type SizeTier = 'sm' | 'md' | 'lg';

const SIZE_PIXEL_MAP: Record<SizeTier, number> = {
  sm: 28,
  md: 40,
  lg: 56,
};

const BRAIN_SIZE_MAP: Record<SizeTier, SizeTier> = {
  // Map Avatar tier to BrainIcon tier (Avatar md → BrainIcon md inside)
  sm: 'sm',
  md: 'md',
  lg: 'md',  // even lg avatar uses md brain (with surrounding halo) — full lg too dense
};

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Avatar role: 'ai' renders BrainIcon, 'user' renders image or initials */
  role: 'ai' | 'user';
  /** Size tier */
  size?: SizeTier;
  /** User avatar image src (role="user" only) */
  src?: string;
  /** Fallback text initials when role="user" + no src (1-2 chars recommended) */
  fallback?: string;
  /** Alt text for img (role="user" + src only) */
  alt?: string;
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ role, size = 'md', src, fallback, alt, className, ...props }, ref) => {
    const pixelSize = SIZE_PIXEL_MAP[size];

    if (role === 'ai') {
      return (
        <div
          ref={ref}
          className={cn(
            'inline-flex items-center justify-center rounded-full',
            'bg-[image:var(--grad-icon-rose-light)]',
            'shadow-icp-pink-sm border border-icp-border-pink',
            'flex-shrink-0',
            className
          )}
          style={{ width: pixelSize, height: pixelSize }}
          role="img"
          aria-label="AI assistant"
          {...props}
        >
          <BrainIcon size={BRAIN_SIZE_MAP[size]} pixelSize={Math.round(pixelSize * 0.65)} />
        </div>
      );
    }

    // role="user"
    const initials = (fallback ?? 'U').slice(0, 2).toUpperCase();

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-full overflow-hidden',
          'flex-shrink-0 select-none',
          !src && 'bg-[image:var(--grad-icon-pink)] text-white font-bold',
          className
        )}
        style={{
          width: pixelSize,
          height: pixelSize,
          fontSize: pixelSize * 0.4,
        }}
        role="img"
        aria-label={alt ?? `User ${initials}`}
        {...props}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt ?? 'User avatar'}
            className="h-full w-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>
    );
  }
);
Avatar.displayName = 'Avatar';
