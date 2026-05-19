/**
 * apps/web/components/icp/atoms/index.ts
 *
 * Slice:   S-01 UI Foundation
 * Task:    T02 AC-13 — barrel export for all 10 atom components
 *
 * Consumer pattern:
 *   import { Button, ChipPill, BrainIcon } from '@/components/icp/atoms';
 *
 * Type exports follow same naming as components (Props suffix per Next.js convention).
 */

export { StatusBar, type StatusBarProps } from './StatusBar';
export { BrainIcon, type BrainIconProps } from './BrainIcon';
export { Icon, type IconProps } from './Icon';
export { Button, buttonVariants, type ButtonProps } from './Button';
export { ChipPill, chipPillVariants, type ChipPillProps } from './ChipPill';
export { StatPill, type StatPillProps } from './StatPill';
export { MiniSparkline, type MiniSparklineProps } from './MiniSparkline';
export { Avatar, type AvatarProps } from './Avatar';
export { OrbPulse, type OrbPulseProps } from './OrbPulse';
export { Spinner, type SpinnerProps } from './Spinner';
