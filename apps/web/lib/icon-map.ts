/**
 * apps/web/lib/icon-map.ts — Centralized icon name registry
 *
 * Slice:    S-01 UI Foundation
 * Task:     T02 Atoms (AC-3, AC-4)
 *
 * Purpose:  Provides typed icon name union + lucide-react component mapping
 *           consumed by <Icon name=> atom (atoms/Icon.tsx). Single source of
 *           truth for icon catalogue across all S-01 atoms + downstream
 *           molecules/organisms (T04-T06).
 *
 * Strategy: lucide-react covers ~95% of mockup icons. Brand SVGs (BrainIcon,
 *           OrbPulse internals) are NOT in this map — they have dedicated atom
 *           components with inline SVG.
 *
 * Adding new icons: import from 'lucide-react' → add to ICON_MAP record.
 *                   Type IconName auto-updates via keyof.
 *
 * Source:   golden-reference-mockup.html (30+ ti-* inline SVG references)
 *           intent-{01..08} mockups (inline SVG observed during EBT v2 SCAN).
 */

import {
  // Navigation
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  X,
  // Actions
  Plus,
  Minus,
  Check,
  Search,
  Settings,
  Filter,
  RefreshCw,
  // Commerce
  ShoppingCart,
  ShoppingBag,
  CreditCard,
  Wallet,
  Receipt,
  Tag,
  Package,
  Truck,
  // Voice / Media
  Mic,
  MicOff,
  Camera,
  Image as ImageIcon,
  Volume2,
  VolumeX,
  Play,
  Pause,
  // AI / Brand
  Sparkles,
  Lightbulb,
  Zap,
  TrendingUp,
  TrendingDown,
  BarChart3,
  LineChart,
  PieChart,
  // Status
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  Loader2,
  // User
  User,
  Users,
  LogIn,
  LogOut,
  Bell,
  Heart,
  Star,
  // Files
  FileText,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  // Misc
  MapPin,
  Calendar,
  Clock,
  Send,
  Share2,
  MoreHorizontal,
  MoreVertical,
  type LucideIcon,
} from 'lucide-react';

/**
 * ICON_MAP — kebab-case name → lucide component.
 *
 * Convention: kebab-case names match Tabler/lucide naming where possible.
 * Use `<Icon name="chevron-left" />` in atom/molecule code.
 */
export const ICON_MAP = {
  // Navigation
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  'chevron-down': ChevronDown,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  x: X,

  // Actions
  plus: Plus,
  minus: Minus,
  check: Check,
  search: Search,
  settings: Settings,
  filter: Filter,
  refresh: RefreshCw,

  // Commerce
  'shopping-cart': ShoppingCart,
  'shopping-bag': ShoppingBag,
  'credit-card': CreditCard,
  wallet: Wallet,
  receipt: Receipt,
  tag: Tag,
  package: Package,
  truck: Truck,

  // Voice / Media
  mic: Mic,
  'mic-off': MicOff,
  camera: Camera,
  image: ImageIcon,
  'volume-up': Volume2,
  'volume-mute': VolumeX,
  play: Play,
  pause: Pause,

  // AI / Brand
  sparkles: Sparkles,
  lightbulb: Lightbulb,
  zap: Zap,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'chart-bar': BarChart3,
  'chart-line': LineChart,
  'chart-pie': PieChart,

  // Status
  'check-circle': CheckCircle2,
  'x-circle': XCircle,
  'alert-circle': AlertCircle,
  'alert-triangle': AlertTriangle,
  info: Info,
  loader: Loader2,

  // User
  user: User,
  users: Users,
  'log-in': LogIn,
  'log-out': LogOut,
  bell: Bell,
  heart: Heart,
  star: Star,

  // Files
  'file-text': FileText,
  edit: Edit3,
  trash: Trash2,
  eye: Eye,
  'eye-off': EyeOff,

  // Misc
  'map-pin': MapPin,
  calendar: Calendar,
  clock: Clock,
  send: Send,
  share: Share2,
  'more-horizontal': MoreHorizontal,
  'more-vertical': MoreVertical,
} as const satisfies Record<string, LucideIcon>;

/**
 * IconName — TypeScript union of all registered icon names.
 *
 * Example usage in atom files:
 *   import type { IconName } from '@/lib/icon-map';
 *   interface ButtonProps { leftIcon?: IconName; }
 *   <Button leftIcon="chevron-left">Back</Button>
 */
export type IconName = keyof typeof ICON_MAP;

/**
 * Get a lucide component by registered name. Type-safe — TS catches typos.
 *
 * @example
 *   const Icon = getIconComponent('chevron-left');
 *   <Icon size={16} strokeWidth={2.5} />
 */
export function getIconComponent(name: IconName): LucideIcon {
  return ICON_MAP[name];
}

/**
 * All registered icon names — useful for dev preview pages or Storybook
 * arg-types autocomplete (T07 will use).
 */
export const ALL_ICON_NAMES = Object.keys(ICON_MAP) as IconName[];
