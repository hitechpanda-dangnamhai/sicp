/**
 * apps/web/components/icp/molecules/index.ts
 *
 * Slice:   S-01 UI Foundation
 * Tasks:   T04 (9 Family A molecules) + T05 (4 Family B molecules)
 *          + S-03 T03b (3 Dashboard hub molecules)
 *          + S-04 T04 (5 V-SLICE Search molecules per Phiên Sx04-9a)
 *          + S-05 T03 (9 V-SLICE Cart molecules per Phiên Sx05-3 — C-S05-I Path A)
 *
 * Total: 22 + 9 (S-05) = 31 molecule components + type exports + 2 ProductCard
 * presets + 2 CVA exports.
 *
 * Compact-only for TrendCard + ShopeeCompareCard per C-21 (expanded modes
 * defer S-07 V-SLICE as page composition).
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
