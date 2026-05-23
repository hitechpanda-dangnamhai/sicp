/**
 * apps/web/lib/icon-map.ts — Centralized icon name registry
 *
 * Slice:    S-01 UI Foundation (T02) + S-03 T03b (Phiên 36 — Tabler upgrade)
 *
 * Purpose:  Provides typed icon name union + component mapping consumed by
 *           <Icon name=> atom (atoms/Icon.tsx). Single source of truth for
 *           icon catalogue across all S-01 atoms + downstream molecules/
 *           organisms (T04-T06) + S-03 Dashboard hub (T03b).
 *
 * Strategy: HYBRID — lucide-react for ~95% icons (Storybook T07 verified
 *           39 components match mockup), Tabler React for 20 icons that
 *           appear in `golden-reference-mockup.html` ground-truth where
 *           Tabler shape differs visibly from lucide equivalent.
 *
 * Tabler upgrade (S-03 Phiên 36 per user choice "B install @tabler/icons-react"):
 *   - lucide fallbacks `chart-arcs → Activity`, `camera-plus → Aperture`
 *     were SHAPE-WRONG (verified screenshot comparison vs mockup).
 *   - Tabler shapes match mockup byte-for-byte (mockup uses Tabler webfont
 *     via CDN; Tabler React uses same SVG source).
 *   - 20 icons total replaced: bell, bolt, bulb, camera, camera-plus,
 *     chart-arcs, chart-line, chevron-right, home, inbox, message-circle,
 *     microphone, package, receipt, search, shopping-bag, shopping-cart,
 *     sparkles, trending-up, user.
 *
 * Adding new icons: import from 'lucide-react' OR '@tabler/icons-react' →
 *                   add to ICON_MAP. Type IconName auto-updates via keyof.
 */

import type { LucideIcon } from 'lucide-react';
import type { TablerIcon } from '@tabler/icons-react';

// ─────────────────────────────────────────────────────────────────────
// Lucide imports — icons NOT replaced by Tabler (47 icons)
// ─────────────────────────────────────────────────────────────────────
import {
  // Navigation
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  X,
  // Actions
  Plus,
  Minus,
  Check,
  Settings,
  Filter,
  RefreshCw,
  // Commerce
  CreditCard,
  Wallet,
  Tag,
  Truck,
  // Voice / Media
  MicOff,
  Image as ImageIcon,
  Volume2,
  VolumeX,
  Play,
  Pause,
  // AI / Brand
  Lightbulb,
  Zap,
  TrendingDown,
  BarChart3,
  PieChart,
  // Status
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  Loader2,
  // User
  Users,
  LogIn,
  LogOut,
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
  // T06 additions (C-30 Phiên 18) — LoginForm + ErrorState + EmptyState
  Mail,
  Lock,
  WifiOff,
  Key,
  ShieldCheck,
  // T05 addition (S-03 Phiên N+2) — MeSettingsMenu help row (state-F)
  HelpCircle,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────
// Tabler imports — 20 icons used in golden-reference-mockup.html
// ─────────────────────────────────────────────────────────────────────
import {
  IconBell,
  IconBolt,
  IconBulb,
  IconCamera,
  IconCameraPlus,
  IconChartArcs,
  IconChartLine,
  IconChevronRight,
  IconHome,
  IconInbox,
  IconMessageCircle,
  IconMicrophone,
  IconPackage,
  IconReceipt,
  IconSearch,
  IconShoppingBag,
  IconShoppingCart,
  IconSparkles,
  IconTrendingUp,
  IconUser,
} from '@tabler/icons-react';

/**
 * IconComponent — union of lucide-react LucideIcon + Tabler TablerIcon types.
 *
 * **Why union instead of intersection** (Final Fix v3 — C-32 RESOLVED):
 *   - Lucide `LucideIcon` types `stroke: string` (strict)
 *   - Tabler `TablerIcon` types `stroke: string | number` (loose, Omit + re-add)
 *   - Intersection `Lucide & Tabler` impossible — `stroke` field conflict
 *   - Custom `Omit<SVGProps, 'stroke'>` superset approach (v1 fix sai) breaks
 *     lucide which expects `stroke: string` strict
 *   - **Union approach: each component preserves its own library's exact type**
 *   - Consumer (atoms/Icon.tsx) calls `<LucideOrTablerComponent size={n} />` — both
 *     libraries accept `size: number | string` so no caller-side type narrowing needed
 *
 * Pattern locked V-SLICE consumers forward.
 */
export type IconComponent = LucideIcon | TablerIcon;

/**
 * ICON_MAP — kebab-case name → React component (lucide OR Tabler).
 *
 * Convention: kebab-case names match Tabler naming (mockup canonical source).
 * Use `<Icon name="chevron-left" />` in atom/molecule code.
 */
export const ICON_MAP = {
  // ─── Navigation ───
  'chevron-left': ChevronLeft,
  'chevron-right': IconChevronRight, // Tabler — used in mockup tiles
  'chevron-up': ChevronUp,
  'chevron-down': ChevronDown,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  x: X,

  // ─── Actions ───
  plus: Plus,
  minus: Minus,
  check: Check,
  search: IconSearch, // Tabler — mockup List Tile "Tìm sản phẩm"
  settings: Settings,
  filter: Filter,
  refresh: RefreshCw,

  // ─── Commerce ───
  'shopping-cart': IconShoppingCart, // Tabler — mockup List Tile "Giỏ hàng"
  'shopping-bag': IconShoppingBag,   // Tabler — mockup List Tile "Mua hàng"
  'credit-card': CreditCard,
  wallet: Wallet,
  receipt: IconReceipt,              // Tabler — mockup StatBar "đơn hôm nay"
  tag: Tag,
  package: IconPackage,              // Tabler — mockup StatBar "tồn kho"
  truck: Truck,

  // ─── Voice / Media ───
  mic: IconMicrophone,               // Tabler — mockup HomeInputBar voice button
  microphone: IconMicrophone,
  'mic-off': MicOff,
  camera: IconCamera,                // Tabler — mockup HomeInputBar image button
  image: ImageIcon,
  'volume-up': Volume2,
  'volume-mute': VolumeX,
  play: Play,
  pause: Pause,

  // ─── AI / Brand ───
  sparkles: IconSparkles,            // Tabler — mockup Header logo + Hero orb
  lightbulb: Lightbulb,
  bulb: IconBulb,                    // Tabler — mockup List Tile "Gợi ý sản phẩm"
  zap: Zap,
  bolt: IconBolt,                    // Tabler — mockup Tile "5 giây" chip
  'trending-up': IconTrendingUp,     // Tabler — mockup StatBar "doanh thu"
  'trending-down': TrendingDown,
  'chart-bar': BarChart3,
  'chart-line': IconChartLine,       // Tabler — mockup Hero CTA "Xem phân tích"
  'chart-arcs': IconChartArcs,       // Tabler — mockup Hero Tile "Phân tích"
  'chart-pie': PieChart,

  // ─── Status ───
  'check-circle': CheckCircle2,
  'x-circle': XCircle,
  'alert-circle': AlertCircle,
  'alert-triangle': AlertTriangle,
  info: Info,
  loader: Loader2,

  // ─── User ───
  user: IconUser,                    // Tabler — mockup HomeBottomNav "Cửa hàng"
  users: Users,
  'log-in': LogIn,
  'log-out': LogOut,
  bell: IconBell,                    // Tabler — mockup Header bell
  heart: Heart,
  star: Star,

  // ─── Files ───
  'file-text': FileText,
  edit: Edit3,
  trash: Trash2,
  eye: Eye,
  'eye-off': EyeOff,

  // ─── Misc ───
  'map-pin': MapPin,
  calendar: Calendar,
  clock: Clock,
  send: Send,
  share: Share2,
  'more-horizontal': MoreHorizontal,
  'more-vertical': MoreVertical,

  // ─── T06 additions (C-30 Phiên 18) ───
  mail: Mail,
  lock: Lock,
  'wifi-off': WifiOff,
  inbox: IconInbox,                  // Tabler — mockup HomeBottomNav "Đề xuất"
  key: Key,
  'shield-check': ShieldCheck,

  // ─── T03b additions (S-03 Phiên 36 — Tabler React component upgrade) ───
  // Per user choice "B install @tabler/icons-react" Phiên 36 Batch 6b.
  // Previous lucide fallbacks (Activity, Aperture, Home, MessageCircle) were
  // SHAPE-WRONG vs mockup. Replaced with pixel-perfect Tabler React.
  home: IconHome,                              // Tabler — mockup HomeBottomNav "Trang chính"
  'message-circle': IconMessageCircle,         // Tabler — mockup HomeBottomNav "Trò chuyện"
  'camera-plus': IconCameraPlus,               // Tabler — mockup Hero Tile "Nhập hàng"

  // ─── T05 additions (S-03 Phiên N+2 — MeSettingsMenu state-F profile) ───
  // Source: intent-08-state-F-logout.html line 175 + symbol `i-help` lines 83 —
  // settings menu row 3 "Trợ giúp Hướng dẫn, liên hệ". Lucide `HelpCircle`
  // shape (circle + question mark) matches mockup byte-for-byte.
  help: HelpCircle,
} as const satisfies Record<string, IconComponent>;

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
 * Get an icon component by registered name. Type-safe — TS catches typos.
 *
 * @example
 *   const Icon = getIconComponent('chevron-left');
 *   <Icon size={16} strokeWidth={2.5} />
 */
export function getIconComponent(name: IconName): IconComponent {
  return ICON_MAP[name];
}

/**
 * All registered icon names — useful for dev preview pages or Storybook
 * arg-types autocomplete (T07 will use).
 */
export const ALL_ICON_NAMES = Object.keys(ICON_MAP) as IconName[];
