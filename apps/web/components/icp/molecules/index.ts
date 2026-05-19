/**
 * @icp/web — Family A Molecules (T04 Phiên 16)
 *
 * 9 AI Chat Thread molecules composing T02 atoms + T03 layout primitives.
 * Per D-01 file structure + SEMANTIC §6 catalogue.
 *
 * Compact-only for TrendCard + ShopeeCompareCard per C-21 (expanded modes
 * defer S-07 V-SLICE as page composition).
 */

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
