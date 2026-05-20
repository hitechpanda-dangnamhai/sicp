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
