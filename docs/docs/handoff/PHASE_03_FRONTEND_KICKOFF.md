# Phase 03 — Frontend Kickoff Checklist

> **Khi nào load doc này:** Trước khi bắt đầu Phase 03 (Frontend implementation Intent 01) hoặc Phase 04-06 (Intent 02-08 frontend). 
>
> **Mục đích:** Tránh reproduce bugs đã phát hiện trong mockup phase. Tránh waste time vì không follow patterns đã lock.
>
> **Status:** REQUIRED READ. Frontend dev (hoặc AI assistant code dùng cho frontend) phải đọc TOÀN BỘ doc này trước khi viết React component đầu tiên.

---

## 0. Quick Context

Phase Mockup (Phase 00) đã hoàn thành **8 intents mockup tĩnh HTML**. Phase Frontend chuyển sang code Next.js. **Mockup chỉ là visual reference**, không phải production code. Dev sẽ build lại bằng React component, dùng design tokens chung.

**Mockup Intent 01 đã trải qua 2 vòng cập nhật:**
- **v1**: original (8 states)
- **v2**: sau ADR-031 (Google Trends integration) + fix 2 visual bugs

**Mockup Intent 03, 04, 05, 06, 08 đang là v1** — chưa được audit fix 2 bugs. Quyết định: **không fix mockup cũ, fix trực tiếp trong code React Phase 03.**

---

## 1. ⚠️ Đọc 3 file này TRƯỚC khi code

Theo thứ tự:

### File 1: `PHASE_00_CROSS_INTENT_PATTERNS.md` ⭐ CRITICAL

Đây là **bible** của Frontend. Chứa:
- CSS templates chuẩn cho bottom-bar, phone-frame responsive
- Color palette mở rộng (mint/amber)
- Action card variants
- Sparkline SVG pattern
- SSE event naming
- Anti-patterns đừng làm

**Focus đặc biệt:** Section 1 (Bottom-bar) + Section 2 (Phone-frame responsive). Đây là 2 bugs đã trả giá để học.

### File 2: `PHASE_00_INTENT_01_HANDOFF_DELTA.md`

Context về Intent 01 v2 — tại sao docs có ADR-031, Market Trend card, 2 bugs phát hiện. Đọc để hiểu **why**, không phải để copy code.

### File 3: `CROSS_INTENT_BUG_IMPACT_ANALYSIS.md`

Map mỗi intent → risk level về 2 bugs. Khi code intent NN, đọc section "Intent NN" để biết:
- Intent này có pattern dễ bug không?
- Cần test case gì đặc biệt?

---

## 2. Component Library — Build TRƯỚC khi build features

Để tránh duplicate bugs, build các **shared components** TRƯỚC khi build feature-specific.

### Priority 1 — Layout primitives

Component | Path | Why
---|---|---
`<PhoneFrame>` | `apps/web/components/layout/PhoneFrame.tsx` | Wrap mọi page intent. Có sẵn responsive viewport fix (Bug 2).
`<BottomBar>` | `apps/web/components/layout/BottomBar.tsx` | Solid bg + z-index 10 + shadow soft (Bug 1 fix). **CẤM** dùng `<div>` raw với position absolute trong feature code.
`<MainScroll>` | `apps/web/components/layout/MainScroll.tsx` | Scroll container với padding-bottom đúng tính theo bottom-bar visible/hidden.

**Reference code skeleton:**

```tsx
// PhoneFrame.tsx
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="phone-frame">
      {children}
    </div>
  );
}

// CSS module (PhoneFrame.module.css)
.phoneFrame {
  width: 100%;
  max-width: 414px;
  height: 844px;
  max-height: calc(100vh - 48px);  /* CRITICAL fix Bug 2 */
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* ... other styles ... */
}
```

```tsx
// BottomBar.tsx
export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="bottom-bar">
      {children}
    </div>
  );
}

// CSS
.bottomBar {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  z-index: 10;                                  /* CRITICAL fix Bug 1 */
  background: #FFF8F0;                          /* CRITICAL: solid, không gradient transparent */
  box-shadow: 0 -8px 16px rgba(255,248,240,0.95),
              0 -16px 24px rgba(255,248,240,0.6);
  padding: 16px 18px 20px;
  display: flex;
  gap: 10px;
}
```

### Priority 2 — Reusable UI components

Component | Path | Reused by intents
---|---|---
`<ActionCard variant>` | `components/cards/ActionCard.tsx` | 01, 04, 05, 07
`<CompactCard expandable>` | `components/cards/CompactCard.tsx` | 01 (Shopee, Trend), 04 (Co-purchase), 07 (Chart preview)
`<Sparkline>` | `components/charts/Sparkline.tsx` | 01, 04, 07
`<ProductCard>` | `components/products/ProductCard.tsx` | 03, 04, 05
`<AIBubble>` | `components/chat/AIBubble.tsx` | 01 (state C), 02, 07

### Priority 3 — Design tokens

Cấu trúc tokens trong `apps/web/styles/tokens.css`:

```css
:root {
  /* Base palette */
  --color-primary-rose: #E91E63;
  --color-primary-orange: #FB923C;
  
  /* Trend palette (Intent 01 v2 extension) */
  --trend-green-50: #ECFDF5;
  --trend-green-500: #10B981;
  --trend-green-700: #047857;
  --trend-amber-500: #F59E0B;
  --trend-amber-700: #92400E;
  
  /* Bottom-bar bg (KEEP solid, không transparent) */
  --bottom-bar-bg: #FFF8F0;
  
  /* ... rest from PHASE_00_DESIGN_SYSTEM.md ... */
}
```

---

## 3. Per-Intent Implementation Checklist

Cho mỗi intent khi code, follow checklist:

### Bước 1: Đọc handoff intent đó

- Intent 01 → `PHASE_00_INTENT_01_MOCKUP_HANDOFF.md` + `_HANDOFF_DELTA.md`
- Intent 03 → handoff intent 03 (v1, chưa có delta)
- Intent NN → handoff intent NN

### Bước 2: Check CROSS_INTENT_BUG_IMPACT_ANALYSIS

Tìm Section intent đó. Đọc "risk level" và "action".

### Bước 3: Implement với patterns

- KHÔNG copy CSS từ mockup HTML
- DÙNG component library đã có (PhoneFrame, BottomBar, MainScroll)
- Extract chỉ design tokens (colors, spacing) từ mockup

### Bước 4: Test 2 bugs đã biết

Mỗi intent có scrollable content + bottom-bar → test:

**Test 1: Scroll lưng chừng**

```typescript
// E2E test với Playwright/Cypress
it('content does not leak through bottom-bar when scrolling mid-position', async () => {
  await page.goto('/intent-01/state-B');
  await page.locator('.main-scroll').evaluate(el => el.scrollTop = 300);
  // Take screenshot, verify visually
  // Or assert: content elements with bottom > bottomBar.top should be HIDDEN
});
```

**Test 2: Viewport responsive**

```typescript
it('phone-frame fits viewport on small screens', async () => {
  await page.setViewportSize({ width: 1456, height: 819 });
  await page.goto('/intent-01/state-B');
  const frameRect = await page.locator('.phone-frame').boundingBox();
  expect(frameRect.height).toBeLessThanOrEqual(819 - 48);
});
```

---

## 4. Per-Intent Risk & Audit Priority

Khi code Phase Frontend, follow thứ tự này để tận dụng momentum:

### Tuần 1-2: Component library + Intent 01

- Build PhoneFrame, BottomBar, MainScroll, ActionCard
- Implement Intent 01 đầu tiên — đã có mockup v2 chuẩn nhất → ít bug
- Validate component library hoạt động đúng

### Tuần 3-4: Intent 03 (Search) + Intent 08 (Login)

- 2 intents này risk thấp về bottom-bar (Intent 03 chỉ có search list, Intent 08 chỉ có modal)
- Dev quen patterns trước khi tackle intent risky

### Tuần 5-6: Intent 05 (Cart) + Intent 06 (Pay) ⚠️

- **2 intents CAO RISK** về bottom-bar (chắc chắn có "Thanh toán" / "Xác nhận thanh toán" CTA)
- Khi code, **dùng component library `<BottomBar>` đã built**, KHÔNG raw HTML
- E2E test scroll lưng chừng BẮT BUỘC

### Tuần 7-8: Intent 04 (Recommend), Intent 02 (Buy by voice), Intent 07 (Analytics)

- Intent 02 và 07 nếu chưa có mockup → build theo patterns ngay từ đầu
- Intent 04 risk trung bình

---

## 5. Code Review Checklist

Mọi PR feature liên quan UI scroll + fixed button:

- [ ] Dùng `<PhoneFrame>` wrap page, không hardcode `height: 844px`
- [ ] Dùng `<BottomBar>` cho fixed CTA, không tự viết `position: absolute`
- [ ] Background của `<BottomBar>` luôn solid color, KHÔNG gradient với alpha < 1
- [ ] `<BottomBar>` có `z-index: 10` rõ ràng
- [ ] `<MainScroll>` có `padding-bottom ≥ 120px` nếu render kèm `<BottomBar>`
- [ ] Có E2E test verify scroll lưng chừng + viewport responsive

---

## 6. Frequently Asked Questions

### Q: Mockup HTML có gradient bottom-bar đẹp hơn, sao không dùng?

**A:** Vì gradient transparent ở top gây bug content lộ qua. Đã trade-off: visual fade smoothness vs functional correctness. Box-shadow soft là compromise reasonable, vẫn giữ cảm giác layered nhưng không bug.

### Q: Có cần test mọi state mọi intent không?

**A:** Không. Test E2E chỉ:
- Intent 01 state B + H (đã có sẵn bug 1 fix proven)
- Intent 05 state cart-sheet (high risk)
- Intent 06 state payment-confirm (high risk)
- Random sample 1 state mỗi intent khác (smoke test)

### Q: Có thể skip component library và viết inline CSS Tailwind không?

**A:** Cho prototype thì OK. Cho production hackathon demo: NO. Vì:
- Bugs sẽ xuất hiện lặp lại ở mỗi intent
- Khó maintain khi cần fix
- Code review không catch được vì style scattered

Build 3 components Priority 1 chỉ tốn 1-2 giờ. Tiết kiệm nhiều giờ debug sau.

### Q: Khi nào audit lại mockup HTML cũ (Intent 03-08)?

**A:** **KHÔNG audit**. Mockup là throwaway artifact sau khi code xong. Khi Phase Frontend hoàn thành Intent NN, mockup NN có thể delete (hoặc archive).

---

## 7. Backup Plan: Nếu Dev Skip Doc Này

Nếu vì lý do nào đó frontend dev bypass docs này và bugs xuất hiện trong production:

1. **Stop work** ngay khi phát hiện bug
2. **Đọc** `PHASE_00_CROSS_INTENT_PATTERNS.md` Section 1 + 2
3. **Refactor** ra component library (PhoneFrame, BottomBar)
4. **Replace** mọi raw `position: absolute bottom` bằng `<BottomBar>` component
5. **Add** linting rule cấm pattern raw bottom-bar

---

## 8. Liên Kết Tới Phases Sau

- Phase 03 Implementation → đọc handoff intent đó + doc này
- Phase 04 Integration → đảm bảo BottomBar + PhoneFrame stable trước khi compose feature
- Phase 05 Polish → có thể tinh chỉnh visual (vd: shadow softer) nhưng KHÔNG đụng z-index, KHÔNG đụng solid bg rule

---

**END OF FRONTEND KICKOFF DOC.** Mọi câu hỏi về CSS patterns → cross-reference 3 docs Section 1.
