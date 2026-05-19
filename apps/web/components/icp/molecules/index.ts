/**
 * apps/web/components/icp/molecules/index.ts
 *
 * Slice:   S-01 UI Foundation
 * Tasks:   T04 (9 Family A molecules) + T05 (4 Family B molecules)
 *
 * Total: 13 molecule components + type exports + 2 ProductCard presets + 2 CVA exports.
 *
 * Compact-only for TrendCard + ShopeeCompareCard per C-21 (expanded modes
 * defer S-07 V-SLICE as page composition).
 *
 * Family B molecules added in T05 (Phiên 17) per Concern 2 (ProductCard
 * single-component with width preset exports I03A_138 + I04_172) and
 * Concern 3 A1 (CartItemRow stockIssue='out' only, no 'low' skeleton).
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
