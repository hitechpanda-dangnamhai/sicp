/**
 * apps/web/components/icp/atoms/Icon.tsx
 *
 * Atom: <Icon> — typed lucide-react wrapper
 *
 * Slice:    S-01 UI Foundation
 * Task:     T02 AC-3
 *
 * Source:   30+ ti-* inline SVG references in golden-reference-mockup.html
 *           + inline SVGs across 77 intent mockups
 *           lib/icon-map.ts (AC-4) catalogue
 *
 * Reach:    All atoms/molecules/organisms consuming icons (Button leftIcon prop,
 *           ChipPill leftIcon, AppHeader nav icons, etc.)
 *
 * Decisions applied:
 * - C-07 navigation-agnostic — pure SVG render, no router
 * - C-08 i18n hardcode VN — N/A (no strings)
 *
 * Stop note: per Task Pack ST-2, some Tabler-style `ti-*` names may not exist
 *            in lucide. Brand SVGs (BrainIcon, OrbPulse) NOT routed through here
 *            — they have dedicated atom files.
 */

import * as React from 'react';
import { ICON_MAP, type IconName } from '@/lib/icon-map';
import { cn } from '@/lib/utils';

export interface IconProps extends Omit<React.SVGAttributes<SVGSVGElement>, 'name'> {
  /** Icon name — must be registered in lib/icon-map.ts */
  name: IconName;
  /** Pixel size; default 16 */
  size?: number;
  /** Stroke width; default 2 (lucide default 2; mockup uses 2.5 often) */
  strokeWidth?: number;
}

export const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ name, size = 16, strokeWidth = 2, className, ...props }, ref) => {
    const LucideComponent = ICON_MAP[name];

    if (!LucideComponent) {
      // Dev-mode guard — TS already catches typos, but runtime check helps debug
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn(`<Icon> name "${name}" not in icon-map. Add to lib/icon-map.ts.`);
      }
      return null;
    }

    return (
      <LucideComponent
        ref={ref}
        size={size}
        strokeWidth={strokeWidth}
        className={cn('inline-block flex-shrink-0', className)}
        {...props}
      />
    );
  }
);
Icon.displayName = 'Icon';
