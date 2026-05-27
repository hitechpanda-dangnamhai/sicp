'use client';


/**
 * apps/web/app/dev/acceptance/intent-01/page.tsx
 *
 * Slice:    S-07 First Image AI Import
 * Task:     T02.E Acceptance pages (Phiên Sx07-F)
 * Intent:   I01 — Image AI Import (Nhập hàng bằng ảnh)
 * State:    state-B-prefilled — primary acceptance demo per Q3 option (a)
 *
 * **REPLACES** S-01 era stale placeholder (132 LOC stale mockup path
 * `intent-01-sell-recovery-chat/state-B-prefilled.html` — file doesn't exist).
 *
 * Reference mockup: `docs/mockups/intent-01/intent-01-state-B-prefilled.html`
 * (per D-29 LAW Mockup filename is LAW — verbatim path cite).
 *
 * **Decisions applied:**
 * - **Q3 option (a) LOCK** (Phiên Sx07-F): Hardcoded fixtures + alert() stubs +
 *   no live BE wire. Mirror S-04 intent-03 precedent (`acceptance/intent-03/
 *   page.tsx`) — single state demo render with mock data for visual review.
 * - **D-29 LAW**: JSDoc cites mockup filename verbatim
 * - **C-07** navigation-agnostic — alert() stubs cho prototype (acceptance
 *   pages allowed router.push per TASKLIST line 376; em dùng alert để tránh
 *   router setup overhead — KI-3 T06 lesson cũng đã apply ở S-01 T07).
 * - **A9 LAW**: Intent 01 chat-mode → `<PhoneFrame mode="chat">` wrapper +
 *   internal scroll.
 *
 * **Components composed** (visual review checklist):
 * - Layout: PhoneFrame mode="chat", StatusBar, TopBar, MainScroll, BottomBar
 * - Atoms: Icon
 * - Molecules: ConversationBubble, PrefillForm, TrendCard (compact),
 *              ShopeeCompareCard (compact), LowConfidenceWarningBanner
 *              (toggle via fixture confidence values)
 *
 * Per S-07 TASKLIST: "I01 → state-B-prefilled (PrefillForm + chips editor +
 * compact trend + shopee + confidence badges)".
 */

import {
  PhoneFrame,
  TopBar,
  MainScroll,
  BottomBar,
} from '@/components/icp/layout';
import { StatusBar } from '@/components/icp/atoms';
import {
  ConversationBubble,
  PrefillForm,
  TrendCard,
  ShopeeCompareCard,
  LowConfidenceWarningBanner,
  type FormPrefillPayload,
  type SuggestedAttributeChip,
} from '@/components/icp/molecules';

/**
 * Hardcoded form_prefill payload — mirrors `SseFormPrefillEvent` shape
 * (verified `packages/shared-types/src/sse/intent-stream.ts:533-541`).
 *
 * Values match mockup `intent-01-state-B-prefilled.html` lines 850-947:
 * - Title "Maggi nước tương đậu nành 200ml" (98% confidence)
 * - Brand "Maggi" lifted to top-level per D-S04-11 LAW
 * - 4 chips (excluding brand which lifts out): size + origin + type + expiry
 * - Suggested price 25000 VND (state-B "Đề xuất" badge)
 */
const FIXTURE_PREFILL: FormPrefillPayload = {
  category: 'nuoc_tuong',
  attributes: {
    brand: 'Maggi',
    size: '200ml',
    origin: 'Việt Nam',
    type: 'Đậu nành',
    expiry: '24 tháng',
  },
  confidence_per_field: {
    title: 0.98,
    brand: 0.95,
    category: 0.92,
    size: 0.94,
  },
  alternatives: {
    title: ['Maggi nước tương đặc biệt 200ml', 'Maggi xì dầu 200ml'],
    size: ['250ml'],
  },
  suggested_price: 25000,
  title: 'Maggi nước tương đậu nành 200ml',
  description:
    'Nước tương Maggi 200ml đậu nành nguyên chất, vị đậm đà, thích hợp ướp + chấm.',
};

/**
 * Mockup-perfect sparkline data for state-B compact TrendCard
 * (rising trajectory +34% per state-H expanded mockup line 378).
 * 20 weekly data points (~90 days) trending upward with realistic noise.
 */
const FIXTURE_SPARKLINE: number[] = [
  42, 44, 43, 46, 48, 47, 52, 55, 53, 58,
  62, 60, 65, 68, 72, 70, 75, 78, 76, 78,
];

/**
 * Hardcoded suggested chips (Sx07-G hotfix demo) — what the AI returns when
 * merchant taps "Thêm" button. Mirror real Gemini output from live test
 * 2026-05-26 (Phiên Sx07-F smoke).
 */
const FIXTURE_SUGGEST_CHIPS: SuggestedAttributeChip[] = [
  {
    key: 'taste_profile',
    label_vn: 'Hương vị',
    example_values: ['Đậm đà', 'Thanh dịu', 'Thanh ngọt'],
  },
  {
    key: 'salt_level',
    label_vn: 'Độ mặn',
    example_values: ['Ít muối', 'Vừa', 'Đậm vị'],
  },
  {
    key: 'packaging',
    label_vn: 'Đóng gói',
    example_values: ['Chai thủy tinh', 'Chai nhựa', 'Bịch'],
  },
];

export default function IntentOneAcceptancePage() {
  return (
    <PhoneFrame mode="chat">
      <StatusBar />
      <TopBar
        title="Nhập hàng bằng ảnh"
        onBack={() => alert('Back to home')}
      />
      <MainScroll>
        <div className="px-3.5 pt-4 pb-4 flex flex-col gap-3.5">
          {/* Conversation context — mimic real flow */}
          <>
            <ConversationBubble
              id="b1"
              role="user"
              text="Đã chụp ảnh — em phân tích nhé."
            />
            <ConversationBubble
              id="b2"
              role="ai"
              text="Aida nhận diện Maggi nước tương 200ml · độ tin cậy 98%."
            />
          </>

          {/* Optional low-confidence banner — empty array → renders null.
              Switch to non-empty to preview state-F overlay:
                <LowConfidenceWarningBanner lowConfidenceFields={['brand','size']} /> */}
          <LowConfidenceWarningBanner lowConfidenceFields={[]} />

          {/* PrefillForm — primary acceptance subject */}
          <PrefillForm
            requestId="fixture-rid-acceptance"
            formPrefill={FIXTURE_PREFILL}
            onSubmit={(draft) => {
              // Q3 option (a) — alert stub instead of real POST
              alert(
                `submit_draft fixture:\n${JSON.stringify(draft, null, 2).slice(0, 400)}`,
              );
            }}
            onRequestSuggestAttrs={async (_category, _existing) => {
              // Simulate ~1s Gemini latency for visual review of spinner state
              await new Promise((r) => setTimeout(r, 1000));
              return FIXTURE_SUGGEST_CHIPS;
            }}
            loading={false}
          />

          {/* Compact TrendCard — state-B sidebar widget */}
          <TrendCard
            delta={34}
            sparklineData={FIXTURE_SPARKLINE}
            label="GOOGLE TRENDS"
            subtitle="rising · 90 ngày"
            chips={[
              { label: 'không đường', delta: 120 },
              { label: 'ít muối', delta: 85 },
              { label: 'hữu cơ', delta: 62 },
              { label: 'thuần chay', delta: 48 },
            ]}
            onExpand={() => alert('Open state-H trend expanded')}
          />

          {/* Compact ShopeeCompareCard — state-B sidebar widget */}
          <ShopeeCompareCard
            userPrice={25000}
            priceMin={18000}
            priceMax={35000}
            priceMedian={24000}
            subtitle="Trung vị 5 cửa hàng"
            onExpand={() => alert('Open state-D shopee expanded')}
          />
        </div>
      </MainScroll>
      <BottomBar><div className="text-center text-[11px] text-icp-pink-700/60 w-full">Acceptance preview — alert() stubs only</div></BottomBar>
    </PhoneFrame>
  );
}
