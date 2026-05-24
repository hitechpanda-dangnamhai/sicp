/**
 * apps/web/components/icp/organisms/index.ts
 *
 * Slice:    S-01 UI Foundation
 * Task:     T06 AC-12 — organisms barrel export
 *
 * Total: 10 organism components + type exports.
 *
 * Consumer pattern (unified import):
 *   import {
 *     ConversationThread, ChatThreadLayout, ChartCard, BottomSheet,
 *     OrderSummary, EmptyState, ErrorState, LoginForm,
 *     ChartLine, ChartBar, ChartDonut,
 *   } from '@/components/icp/organisms';
 *
 * Distribution summary (per AC-29):
 * - SERVER (5): ConversationThread, ChatThreadLayout, OrderSummary, EmptyState, ErrorState
 * - CLIENT (3): ChartCard, BottomSheet, LoginForm
 * - SERVER per C-26 (3 charts): ChartLine, ChartBar, ChartDonut (Tailwind declarative)
 *
 * Pattern: matches T03 layout/index.ts + T04+T05 molecules/index.ts barrel structure.
 */

// ─── Chat / Thread organisms (3) ────────────────────────────────────────────

export {
  ConversationThread,
  type ConversationThreadProps,
} from './ConversationThread';

export {
  ChatThreadLayout,
  type ChatThreadLayoutProps,
} from './ChatThreadLayout';

// ─── Chart / Analytics organisms (4) ────────────────────────────────────────

export {
  ChartCard,
  type ChartCardProps,
  type ChartCardTag,
} from './ChartCard';

export {
  ChartLine,
  type ChartLineProps,
  type ChartLinePoint,
} from './charts/ChartLine';

export {
  ChartBar,
  type ChartBarProps,
  type ChartBarDatum,
} from './charts/ChartBar';

export {
  ChartDonut,
  type ChartDonutProps,
  type ChartDonutSegment,
} from './charts/ChartDonut';

// ─── Family B form / payment organisms (3) ──────────────────────────────────

export {
  BottomSheet,
  type BottomSheetProps,
} from './BottomSheet';

export {
  OrderSummary,
  type OrderSummaryProps,
  type OrderSummaryItem,
  type OrderSummaryReceiptMeta,
} from './OrderSummary';

export {
  LoginForm,
  type LoginFormProps,
  type LoginFormData,
} from './LoginForm';

// ─── Slot-driven state organisms (2) ────────────────────────────────────────

export {
  EmptyState,
  type EmptyStateProps,
} from './EmptyState';

export {
  ErrorState,
  type ErrorStateProps,
  type ErrorStateTip,
} from './ErrorState';

// ─── T03b Dashboard hub (3 organisms — S-03 Phiên 36) ────────────────────────

export { DashboardHeader, type DashboardHeaderProps } from './DashboardHeader';
export { HeroInsightCard, type HeroInsightCardProps } from './HeroInsightCard';
export { HomeInputBar, type HomeInputBarProps } from './HomeInputBar';

// ─── T04 Splash hub (1 organism — S-03 Phiên N+1, missed barrel fix) ─────────
//
// Per S-03 C-CONFLICT-05 RESOLVED-INLINE Phiên N+2 (T04 emit Phiên N+1 forgot
// to append barrel row for SplashContent — only direct path import worked).
// T05 batch 3 bundles the barrel patch alongside its own 3 NEW organism exports.

export { SplashContent } from './SplashContent';

// ─── T05 Auth state machine + Profile (3 organisms — S-03 Phiên N+2) ─────────
//
// State machine consumers: app/auth/login/page.tsx (LoginSuccessTransition for
// state-E per D-25) + app/me/page.tsx (MeSettingsMenu + LogoutConfirmCard for
// state-F per D-27 mockup composition).

export {
  LoginSuccessTransition,
  type LoginSuccessTransitionProps,
} from './LoginSuccessTransition';

export {
  MeSettingsMenu,
  type MeSettingsMenuProps,
} from './MeSettingsMenu';

export {
  LogoutConfirmCard,
  type LogoutConfirmCardProps,
} from './LogoutConfirmCard';

// ─── S-04 T05 NEW V-SLICE feature organism (Phiên Sx04-10) ───────────────────
//
// Per MAR-1 #2 LOCKED Phiên Sx04-9b + C-S04-I scope extension (PHASE_02 §E EXCEPTION
// clause amended: "feature-specific molecules + organisms ARE allowed when mockup
// directly evidences them"). SearchHeader composition (back btn + title block +
// bell + avatar) is mockup-verbatim across 5/5 intent-03B states.

export { SearchHeader, type SearchHeaderProps } from './SearchHeader';
