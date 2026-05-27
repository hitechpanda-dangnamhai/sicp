/**
 * apps/web/components/icp/molecules/index.ts
 *
 * Slice:   S-01 UI Foundation
 * Tasks:   T04 (9 Family A molecules) + T05 (4 Family B molecules)
 *          + S-03 T03b (3 Dashboard hub molecules)
 *          + S-04 T04 (5 V-SLICE Search molecules per Phiên Sx04-9a)
 *          + S-05 T03 (9 V-SLICE Cart molecules per Phiên Sx05-3 — C-S05-I Path A)
 *          + S-07 T02 (9 V-SLICE Image AI Import molecules per Phiên Sx07-F)
 *
 * Total: 22 + 9 (S-05) + 9 (S-07) = 40 molecule components + type exports +
 *        2 ProductCard presets + 2 CVA exports.
 *
 * Compact-only for TrendCard + ShopeeCompareCard per C-21 (expanded modes
 * shipped as separate molecules `TrendCardExpanded` + `ShopeeCompareCardExpanded`
 * in S-07 T02 — fulfilling the C-21 expanded deferral).
 *
 * Family B molecules added in T05 (Phiên 17) per Concern 2 (ProductCard
 * single-component with width preset exports I03A_138 + I04_172) and
 * Concern 3 A1 (CartItemRow stockIssue='out' only, no 'low' skeleton).
 *
 * S-05 NEW V-SLICE feature molecules per C-S05-I Path A (Phiên Sx05-3):
 * EXTEND existing CartItemRow +3 props (NOT new <CartItem>) — preserves 6
 * production consumers from S-01 + Storybook + barrel + BottomSheet docstring.
 * 9 NEW supporting molecules: CartSummary + CartAIHintBubble + StockIssueAlert +
 * StockReplacementCard + ClearConfirmModal + PromoSuccessBanner + UndoRemoveToast +
 * PendingSyncToast + SwipeableCartItem.
 *
 * S-07 NEW V-SLICE Image AI Import molecules (Phiên Sx07-F) per T02.A scope:
 * 9 NEW molecules covering 10 mockup states (state-0/A/B/C-rising/C-falling/D/E/F/G/H):
 * - PrefillForm + LowConfidenceWarningBanner (state-B + state-F)
 * - SuccessTransition + BrainCheckBadge (state-G + sub-component)
 * - ImageDropZone (state-0) + AnalyzingPhasesCard (state-A)
 * - ShopeeCompareCardExpanded (state-D) + TrendCardExpanded (state-H)
 * - BlurErrorCard (state-E)
 *
 * Decisions for S-07 batch:
 * - **Q2 option 2 LOCK** (Sx07-F): BrainCheckBadge tách riêng làm sub-molecule
 *   (reusable: SuccessTransition consumer + future S-09 reco-confirm)
 * - **C-21 deferral fulfilled**: TrendCardExpanded + ShopeeCompareCardExpanded
 *   are the long-awaited expanded modes from S-01 T04 scope cut
 * - **C-S07-O option iii-a** (Sx07-G hotfix): PrefillForm consumes optional
 *   `onRequestSuggestAttrs` callback for on-demand AI chip suggestions
 *
 * @see slices/S-07_decisions-log.md C-S07-O + C-S07-Q (NEW Phiên Sx07-F)
 * @see docs/mockups/intent-01/intent-01-state-*.html (10 mockup states)
 */

// ─── T04 Family A (9 molecules) ─────────────────────────────────────────────

export {
  ConversationBubble,
  type ConversationBubbleProps,
  type ConversationBubbleVariant,
  type VoiceMeta,
} from './ConversationBubble';

export {
  PhasesCard,
  type PhasesCardProps,
  type PhaseItem,
} from './PhasesCard';

export {
  ActionCard,
  actionCardVariants,
  type ActionCardProps,
  type ActionCardVariant,
} from './ActionCard';

export {
  MicButton,
  type MicButtonProps,
  type MicButtonState,
  type MicButtonSize,
} from './MicButton';

export {
  LivePartialTranscript,
  type LivePartialTranscriptProps,
} from './LivePartialTranscript';

export {
  DrillChipRow,
  type DrillChipRowProps,
  type DrillChip,
} from './DrillChipRow';

export {
  AIInsightCard,
  type AIInsightCardProps,
  type AIInsightCardVariant,
} from './AIInsightCard';

export {
  TrendCard,
  type TrendCardProps,
  type TrendChipData,
} from './TrendCard';

export {
  ShopeeCompareCard,
  type ShopeeCompareCardProps,
} from './ShopeeCompareCard';

// ─── T05 Family B (4 molecules) ─────────────────────────────────────────────

export {
  ProductCard,
  productCardVariants,
  I03A_138,
  I04_172,
  type ProductCardProps,
  type ProductCardWidth,
  type ProductCardBadge,
  type ProductCardAddButton,
} from './ProductCard';

export {
  CartItemRow,
  type CartItemRowProps,
  type CartItemProduct,
  type CartItemCornerBadge,
} from './CartItemRow';

export {
  PaymentMethodPicker,
  type PaymentMethodPickerProps,
  type PaymentMethod,
  type PaymentMethodAvatar,
  type PaymentMethodBadge,
} from './PaymentMethodPicker';

export {
  OtpField,
  type OtpFieldProps,
  type OtpFieldLength,
} from './OtpField';

// ─── T03b Dashboard hub (3 molecules — S-03 Phiên 36) ───────────────────────

export { StatBar, type StatBarProps } from './StatBar';

export {
  HeroTile,
  type HeroTileProps,
  type HeroTileAccent,
  type HeroTileBadgeKind,
} from './HeroTile';

export {
  ListTile,
  type ListTileProps,
  type ListTileAccent,
  type ListTileChip,
} from './ListTile';

// ─── S-04 T04 NEW V-SLICE feature molecules (Phiên Sx04-9a) ─────────────────
// Per C-S04-I PHASE_02 §E EXCEPTION clause: V-SLICE feature-specific molecules ARE allowed
// when mockup directly evidences them. 5 molecules cover Variant B 172px product card with
// match badge + reason chip (ProductCardSearchB), pre-query welcome (SuggestedQueryChips),
// Variant A AI followup chips (FollowupFilterChips), cart-add stub toast (AddToCartConfirmCard),
// and Variant B co-purchase hint (CoPurchaseHintCard).

export {
  ProductCardSearchB,
  type ProductCardSearchBProps,
  type ProductCardSearchBBadge,
} from './ProductCardSearchB';

export {
  SuggestedQueryChips,
  type SuggestedQueryChipsProps,
} from './SuggestedQueryChips';

export {
  FollowupFilterChips,
  type FollowupFilterChipsProps,
  type FilterChipSpec,
  type FilterPayload,
} from './FollowupFilterChips';

export {
  AddToCartConfirmCard,
  type AddToCartConfirmCardProps,
} from './AddToCartConfirmCard';

export {
  CoPurchaseHintCard,
  type CoPurchaseHintCardProps,
  type CoPurchaseSuggestedProduct,
} from './CoPurchaseHintCard';

// ─── S-05 T03 NEW V-SLICE feature molecules (Phiên Sx05-3 per C-S05-I Path A) ───
// EXTEND existing CartItemRow +3 props (isUpdating + lineTotalOverride + currencyFormatter)
// preserves 6 S-01 consumers backward-compat. 9 NEW supporting molecules below cover all
// 8 mockup states (state-0/A/B/C/D/E/F/G) — state-B reused EmptyState organism inline.

export {
  CartSummary,
  type CartSummaryProps,
} from './CartSummary';

export {
  CartAIHintBubble,
  type CartAIHintBubbleProps,
} from './CartAIHintBubble';

export {
  StockIssueAlert,
  type StockIssueAlertProps,
} from './StockIssueAlert';

export {
  StockReplacementCard,
  type StockReplacementCardProps,
} from './StockReplacementCard';

export {
  ClearConfirmModal,
  type ClearConfirmModalProps,
} from './ClearConfirmModal';

export {
  PromoSuccessBanner,
  type PromoSuccessBannerProps,
} from './PromoSuccessBanner';

export {
  UndoRemoveToast,
  type UndoRemoveToastProps,
} from './UndoRemoveToast';

export {
  PendingSyncToast,
  type PendingSyncToastProps,
} from './PendingSyncToast';

export {
  SwipeableCartItem,
  type SwipeableCartItemProps,
} from './SwipeableCartItem';

// ─── S-07 T02 NEW V-SLICE Image AI Import molecules (Phiên Sx07-F) ──────────
// 9 molecules covering 10 mockup states for Intent 01 import-by-image flow.
// Sub-component BrainCheckBadge consumed by SuccessTransition (+ future S-09 reco).
// ShopeeCompareCardExpanded + TrendCardExpanded fulfill C-21 expanded deferral.

export {
  BrainCheckBadge,
  type BrainCheckBadgeProps,
} from './BrainCheckBadge';

export {
  SuccessTransition,
  type SuccessTransitionProps,
} from './SuccessTransition';

export {
  PrefillForm,
  type PrefillFormProps,
  type FormPrefillPayload,
  type SuggestedAttributeChip,
} from './PrefillForm';

export {
  ImageDropZone,
  type ImageDropZoneProps,
} from './ImageDropZone';

export {
  AnalyzingPhasesCard,
  type AnalyzingPhasesCardProps,
  type AnalyzingPhaseSlot,
} from './AnalyzingPhasesCard';

export {
  ShopeeCompareCardExpanded,
  type ShopeeCompareCardExpandedProps,
  type ShopeeCompareSample,
  type ShopeeCompareAggregates,
} from './ShopeeCompareCardExpanded';

export {
  TrendCardExpanded,
  type TrendCardExpandedProps,
  type TrendData,
} from './TrendCardExpanded';

export {
  BlurErrorCard,
  type BlurErrorCardProps,
} from './BlurErrorCard';

export {
  LowConfidenceWarningBanner,
  type LowConfidenceWarningBannerProps,
} from './LowConfidenceWarningBanner';
