# Phase 00 — Design System & Visual Identity (v3 — MoMo-inspired Premium)

> **Status:** ✅ **DONE** (design system + component library đã build, verified vs `apps/web` 2026-06-09). Phần còn lại = production hardening (§11).
> **v3 LOCKED:** Mobile-first, light theme, hồng-cam MoMo dominant với gradient mềm và chiều sâu radial glow. Đa sắc tinh tế có chiều sâu — không clone MoMo mà nâng cấp thẩm mỹ.
>
> **Evidence (verified vs code):** tokens §1 có thật trong `apps/web/app/globals.css` (grad-hero/pink-600/shadow-pink-xl/radius-card/bg-page…); font Be Vietnam Pro loaded (globals.css); component library = `apps/web/components/ui` (8 primitive shadcn) + `apps/web/components/icp/{atoms,molecules,organisms,layout}` + `PhoneFrame.tsx`. **Code giàu hơn §6 plan** — inventory as-built đầy đủ = chính code (`apps/web/components/`) + Storybook (`apps/web/stories/`).
>
> **Cross-ref:** code `apps/web/components/` + Storybook (= source-of-truth component), `08_FE_BE_CONTRACT.md`, `05_CODING_CONVENTIONS.md`.

<!-- PRODUCTION RECONCILE (2026-06-09, verified vs apps/web):
- Bỏ "Duration 3-5 ngày" (hackathon timebox). Phase = DONE, không còn day-by-day.
- §6 component list = PLAN ban đầu; code thật giàu hơn → đối chiếu trực tiếp với code. (Không maintain registry doc riêng — nguồn = code + Storybook.)
- §7 "/mock/*" + "/style-guide" KHÔNG tồn tại làm route; route thật = app/{home,auth,me,intent-01..07,dev}.
- §8 "Day 1-5 tasks" + §10 "Cho Demo Talk" = hackathon → reframe/loại.
- §9 folder structure SAI: code = apps/web/{app/,components/{icp,ui}/}, KHÔNG có src/ hay styles/; tokens ở app/globals.css + tailwind.config.ts (không tokens.css/design-tokens.ts riêng — verify nếu cần dùng).
- THÊM §11 production-grade (a11y, bundle budget, i18n, token contract test).
- COMPONENT_REGISTRY.md BỎ (stale, dừng S-07, mâu thuẫn code) → nguồn inventory = code + Storybook. -->

**Trạng thái:** Mobile-first, light theme. Phase đã hoàn tất; doc này = spec design system + trạng thái build thật.

## Tham Khảo Hình Ảnh

Design này được lock dựa trên **mockup v3 final** trong conversation. Reference visual snapshot:
- Hero gradient hồng-cam đậm 4 màu với AI orb radial trắng-hồng-cam
- Stat bar 3 chỉ số sống (đơn hàng / doanh thu / tồn kho) ngay sau hero
- 2 tile lớn (Nhập hàng hồng / Phân tích cam) có mini visual + tag speed/chart
- 4 list rows (Tìm / Mua / Gợi ý / Giỏ hàng) với pill data + chevron container gradient
- Input bar gradient với mic 3-màu hồng-cam to nổi bật
- Bottom nav với active indicator pill gradient ngang

## Brand Statement v3

ICP UI = **AI Commerce Premium dành cho người Việt**

| Yếu tố | Biểu hiện |
|---|---|
| **Mobile-first** | Viewport target 390-414px, desktop = phone-frame |
| **MoMo-inspired** | Hồng đậm `#E91E63` dominant + cam rực `#F97316` accent |
| **Đa sắc có cấu trúc** | Hồng chủ đạo 70%, cam 20%, vàng/khác 10% — không rainbow |
| **Chiều sâu mềm mại** | Radial glow trong card, shadow màu (không phải đen), gradient mượt |
| **Dữ liệu sống** | Stat bar realtime, mini chart trong tile, badge số đếm động |
| **Vietnamese friendly** | Be Vietnam Pro font, copy tự nhiên không robot |

## Definition of Done — trạng thái thật (verified 2026-06-09)

- [x] `apps/web` Next.js + Tailwind + shadcn/ui (`components/ui` 8 primitive) ✅
- [x] CSS tokens đầy đủ theo §1 — verified trong `app/globals.css` ✅
- [x] Be Vietnam Pro font loaded (globals.css) ✅
- [x] Component library `components/icp/{atoms,molecules,organisms,layout}` + PhoneFrame ✅ (nguồn = code + Storybook)
- [x] App routes thật: `app/{home,auth,me,intent-01..07,dev}` ✅
- [ ] Storybook stories tại `apps/web/stories/` — verify số lượng thật nếu cần (🟡 chưa fingerprint phiên này)
- [ ] PWA manifest theme `#E91E63` — 🟡 verify nếu cần
- [ ] A11y / bundle budget / i18n — production hardening §11 (CHƯA CODE)

> Các DoD hackathon cũ ("Mockup 10 pages", "/style-guide page") đã bỏ: route `/mock/*` + `/style-guide` **không tồn tại** trong code; UI thật đi thẳng vào route feature `intent-01..07` + `home`. Mockup chỉ là reference (1 phần nhỏ) — chuẩn = code.

## 1. Color Tokens v3 — MoMo Premium

### 1.1 Surface (nền gradient nhẹ)

```css
--bg-page-from:   #FCE7F0;   /* hồng nhạt top */
--bg-page-mid:    #FEEEE0;   /* kem cam giữa */
--bg-page-to:     #FFF8F0;   /* trắng kem dưới */
--bg-page:        linear-gradient(180deg, var(--bg-page-from) 0%, var(--bg-page-mid) 40%, var(--bg-page-to) 100%);

--bg-page-frame:  #FDF2F4;   /* nền ngoài phone frame */
--bg-surface:     #FFFFFF;   /* card surface */
--bg-tinted:      #FEF3F8;   /* card tinted nhạt */

--border-subtle:  #F9D8E4;   /* viền hồng siêu nhạt */
--border-pink:    #FBCFE8;   /* viền hồng card */
--border-orange:  #FED7AA;   /* viền cam card */
--border-divider: #FCE7F3;   /* line divider trong card */
```

### 1.2 Text (deep maroon, KHÔNG dùng đen)

```css
--text-primary:   #831447;   /* maroon đậm, dùng cho heading body */
--text-secondary: #9F1239;   /* maroon vừa, label */
--text-tertiary:  #BE185D;   /* hồng đậm, caption */
--text-muted:     #7C7591;   /* tím xám nhạt */
--text-on-color:  #FFFFFF;   /* text trên nền hồng/cam đậm */
--text-on-light:  #1F1147;   /* deep violet trên nền trắng */
```

### 1.3 Pink Ramp (PRIMARY — dominant 70%)

```css
--pink-50:  #FFF1F5;
--pink-100: #FCE7F3;
--pink-200: #FBCFE8;
--pink-300: #F9A8D4;
--pink-400: #F472B6;
--pink-500: #EC4899;   /* hồng tươi */
--pink-600: #E91E63;   /* MOMO SIGNATURE */
--pink-700: #BE185D;
--pink-800: #831447;
--pink-900: #500724;
```

### 1.4 Rose Ramp (Secondary primary)

```css
--rose-50:  #FFE4E6;
--rose-100: #FECDD3;
--rose-200: #FDA4AF;
--rose-500: #F43F5E;   /* icon nhập hàng */
--rose-600: #E11D48;
--rose-700: #BE123C;
--rose-800: #9F1239;
```

### 1.5 Orange Ramp (Accent 20% — HOT, AI, alerts)

```css
--orange-50:  #FFFBEB;
--orange-100: #FFEDD5;
--orange-200: #FED7AA;
--orange-300: #FDBA74;
--orange-400: #FB923C;
--orange-500: #F97316;   /* HOT BADGE */
--orange-600: #EA580C;
--orange-700: #C2410C;
--orange-800: #9A3412;
--orange-900: #7C2D12;
```

### 1.6 Amber Ramp (10% — tồn kho, vàng nắng)

```css
--amber-50:  #FFFBEB;
--amber-100: #FEF3C7;
--amber-200: #FDE68A;
--amber-300: #FCD34D;
--amber-400: #FBBF24;
--amber-500: #F59E0B;
--amber-700: #B45309;
--amber-800: #92400E;
--amber-900: #78350F;
```

### 1.7 Signature Gradients (LOCKED — KHÔNG đổi)

```css
--grad-hero:      linear-gradient(135deg, #E91E63 0%, #EC4899 40%, #F472B6 75%, #FB923C 100%);
--grad-orb:       radial-gradient(circle at 30% 30%, #FFF 0%, #FFE4E6 30%, #FB923C 100%);
--grad-mic:       linear-gradient(135deg, #E91E63 0%, #F43F5E 50%, #FB923C 100%);
--grad-icon-pink: linear-gradient(135deg, #F43F5E 0%, #E11D48 100%);
--grad-icon-orange: linear-gradient(135deg, #FB923C 0%, #EA580C 100%);
--grad-badge-hot: linear-gradient(135deg, #F97316 0%, #EA580C 100%);
--grad-badge-ai:  linear-gradient(135deg, #E91E63 0%, #FB923C 100%);
--grad-active:    linear-gradient(90deg, #E91E63 0%, #FB923C 100%);
--grad-input-bg:  linear-gradient(135deg, #FFFFFF 0%, #FEF3F8 100%);

/* Tile backgrounds (subtle) */
--grad-tile-pink:   linear-gradient(160deg, #FFFFFF 0%, #FFF1F5 100%);
--grad-tile-orange: linear-gradient(160deg, #FFFFFF 0%, #FFF7ED 100%);

/* Icon container backgrounds (light) */
--grad-icon-pink-light:   linear-gradient(135deg, #FCE7F3, #FBCFE8);
--grad-icon-orange-light: linear-gradient(135deg, #FFEDD5, #FED7AA);
--grad-icon-rose-light:   linear-gradient(135deg, #FFE4E6, #FECDD3);
--grad-icon-amber-light:  linear-gradient(135deg, #FEF3C7, #FCD34D);
```

### 1.8 Shadow Colors (CRITICAL — màu hồng, KHÔNG đen)

```css
--shadow-pink-sm: 0 4px 10px rgba(233,30,99,0.18);
--shadow-pink-md: 0 6px 14px rgba(233,30,99,0.25);
--shadow-pink-lg: 0 8px 18px rgba(244,63,94,0.4);
--shadow-pink-xl: 0 16px 36px rgba(233,30,99,0.28);

--shadow-orange-md: 0 6px 14px rgba(251,146,60,0.22);
--shadow-orange-lg: 0 8px 18px rgba(234,88,12,0.4);

--shadow-card:    0 8px 22px rgba(233,30,99,0.1);
--shadow-list:    0 8px 24px rgba(233,30,99,0.08);
--shadow-input:   0 10px 26px rgba(233,30,99,0.15);
--shadow-mic:     0 10px 22px rgba(233,30,99,0.5);
```

### 1.9 Color Assignment Rules (LOCKED)

| Domain | Element | Color |
|---|---|---|
| **Brand / AI** | Logo, header, hero | Pink-600 + Pink-500 gradient |
| **Hero card** | Background | grad-hero (4 màu) |
| **AI orb** | Center sphere | grad-orb (radial trắng-hồng-cam) |
| **Voice mic** | Main CTA | grad-mic (hồng-hồng-cam) |
| **HOT badge** | Tag urgency | grad-badge-hot (cam đậm) |
| **AI badge** | Tag AI feature | grad-badge-ai (hồng-cam) |
| **Active nav** | Indicator | grad-active (hồng-cam pill) |
| **Nhập hàng tile** | Background | grad-tile-pink + icon grad-icon-pink |
| **Phân tích tile** | Background | grad-tile-orange + icon grad-icon-orange |
| **Tìm sản phẩm row** | Icon container | grad-icon-pink-light |
| **Mua hàng row** | Icon container | grad-icon-orange-light |
| **Gợi ý sản phẩm row** | Icon container | grad-icon-rose-light + AI badge |
| **Giỏ hàng row** | Icon container | pink-200 → pink-300 gradient |
| **Stats bar — đơn hàng** | Icon container | grad-icon-pink-light |
| **Stats bar — doanh thu** | Icon container | grad-icon-orange-light |
| **Stats bar — tồn kho** | Icon container | grad-icon-amber-light |
| **Errors / Failed payment** | System red | `#DC2626` |
| **Success / Paid** | System green | `#16A34A` (chỉ dùng trong notification, không phá tone hồng-cam) |

**Quy tắc vàng:**
- Tile và row **luôn dominant hồng-cam** ở 70% UI
- Mỗi tile/row có 1 tone riêng nhưng **không xa khỏi phổ hồng-cam-vàng**
- KHÔNG dùng xanh dương/xanh lá ngoại trừ system semantic (success/error notification)
- KHÔNG dùng tím trừ accent text muted

## 2. Typography

### 2.1 Font Stack

```css
--font-sans: 'Be Vietnam Pro Variable', 'Inter Variable', -apple-system, sans-serif;
--font-display: 'Be Vietnam Pro Variable', var(--font-sans);
--font-mono: 'JetBrains Mono Variable', 'SF Mono', monospace;
```

### 2.2 Type Scale (mobile-optimized)

```
Display — 26px / 1.2 / 700
H1 — 22px / 1.25 / 700
H2 — 18px / 1.3 / 700   ← Hero title
H3 — 16px / 1.4 / 600
Body L — 15px / 1.5 / 600   ← Tile title
Body — 14px / 1.5 / 600     ← Row title
Body S — 13px / 1.5 / 500   ← Tile subtitle
Caption — 12px / 1.4 / 500
Label — 11px / 1.4 / 600    ← Pill, badge
Tiny — 10px / 1.4 / 500     ← Stats label, secondary info
Micro — 9px / 1.4 / 700     ← HOT/AI badges (letter-spacing 0.3-0.4px)
```

### 2.3 Weights LOCKED

```
500 — regular body
600 — medium (most headings, button)
700 — bold (logo, hero numbers, big metric, active nav, badge)
```

KHÔNG dùng weight 400 (quá nhẹ) hoặc 800/900 (quá nặng).

### 2.4 Special Uses

- **Money (VND):** `font-family: var(--font-mono); font-weight: 700; font-variant-numeric: tabular-nums;`
- **Stats number (8, 2.4M, 142):** `font-family: var(--font-mono); font-weight: 700; letter-spacing: -0.3px;`
- **Percent in hero ("12%"):** gradient `from-amber-100 to-amber-300` `-webkit-background-clip:text` 
- **Vietnamese diacritics:** Be Vietnam Pro mọi nơi, không fallback Inter giữa chừng

## 3. Layout — Mobile-First

### 3.1 Viewport Targets

```
Primary:  390px (iPhone 13)
Range:    375 - 414px
Desktop:  wrap phone-frame 414px centered, padding 14px, radius 28px outer
```

### 3.2 Main Screen Structure (LOCKED)

```
┌─────────────────────────────┐
│  Header                     │ 60px
│  Logo + status + bell + avatar │
├─────────────────────────────┤
│  Hero card (gradient)       │ 200px
│  AI orb + insight + CTAs    │
├─────────────────────────────┤
│  Stat bar (1 card 3 stats)  │ 64px
│  Đơn / Doanh thu / Tồn kho  │
├─────────────────────────────┤
│  Section title              │ 32px
│  "Bắt đầu nhanh" + "Tất cả" │
├─────────────────────────────┤
│  2 Hero tiles (grid 2 col)  │ 158px
│  Nhập hàng / Phân tích      │
├─────────────────────────────┤
│  List card 4 rows           │ 280px
│  Tìm / Mua / Gợi ý / Giỏ    │
├─────────────────────────────┤
│  Input bar                  │ 60px
│  Sparkle + input + cam + mic │
├─────────────────────────────┤
│  Bottom nav 4 tabs          │ 60px
│  Home | Chat | Inbox | Me   │
└─────────────────────────────┘
```

Tổng chiều cao: ~914px. Vừa khít iPhone 14 Pro Max (932px). Scroll nhẹ trên iPhone 13 (844px).

### 3.3 Spacing

```
--space-1:  4px
--space-2:  8px
--space-3:  12px   (card internal gap)
--space-4:  14px   (page padding mobile)
--space-5:  18px   (hero internal padding)
--space-6:  20px   (hero outer padding)
```

### 3.4 Radius

```
--radius-sm:   6px    (pill nhỏ, label)
--radius-md:   10px   (badge nhỏ, chevron container)
--radius-lg:   13px   (icon container 44-46px)
--radius-xl:   14px   (button hero)
--radius-2xl:  18px   (card list, tile chevron container)
--radius-3xl:  20px   (tile lớn, list card outer)
--radius-card: 22px   (hero card)
--radius-page: 24px   (phone frame inner)
--radius-frame: 28px  (phone frame outer)
--radius-pill: 30px   (input bar)
--radius-full: 9999px (avatar, mic, FAB)
```

### 3.5 Z-Index

```
--z-base:   0
--z-sticky: 10
--z-sheet:  50
--z-modal:  100
--z-toast:  1000
```

## 4. Component Anatomy (LOCKED Recipes)

### 4.1 Hero Card (AI Insight)

```
- Outer: margin 14px sides, padding 20px/18px, radius 24px
- Background: grad-hero
- Shadow: shadow-pink-xl
- 2 radial glows: top-right cam 200x200px (0.4 alpha), bottom-left trắng 160x160px (0.2 alpha)
- 3 sparkle stars trắng nhỏ (4-6px) rải rác (animation: optional)
- Content row:
  - AI orb 60x60: grad-orb + pulse-ring border-2 trắng (animation 2.4s)
  - Right column:
    - Label "AI VỪA PHÁT HIỆN" — 11px / weight 500 / color rgba(255,255,255,0.9) / letter-spacing 0.4px
    - With pulse dot 7x7 amber + glow shadow
    - Title 18px / weight 700 / color white
    - Percent gradient amber `from-amber-100 to-amber-300`
    - Subtitle 12px / weight 500 / color rgba(255,255,255,0.85)
- Action row (2 buttons):
  - Primary "Xem phân tích": bg white, color #BE185D, padding 12px, radius 14px, weight 700, icon prefix
  - Secondary "Để sau": bg rgba(255,255,255,0.2) backdrop-blur(10px), border 0.5 rgba(255,255,255,0.35), color white, padding 12px 18px
```

### 4.2 Stat Bar

```
- Outer: margin 14px sides, padding 12px 14px
- Background: white
- Border: 0.5px pink-200
- Radius: 18px
- Shadow: shadow-card
- 3 cells flex:1, divider 0.5px pink-100 vertical between
- Each cell:
  - Icon container 32x32, radius 10px, gradient theo cell:
    - Đơn hôm nay → grad-icon-pink-light
    - Doanh thu → grad-icon-orange-light
    - Tồn kho → grad-icon-amber-light
  - Icon Tabler 16px màu darkest từ tone
  - Right text:
    - Number 14px / weight 700 / mono / color text-on-light (deep)
    - Unit inline 10px / weight 500 / màu tone (M, đồng, sản phẩm)
    - Label 9px / weight 500 / màu tone secondary
```

### 4.3 Hero Tile (158px min-height)

```
- Outer: padding 14px, radius 20px, min-height 158px
- Background: grad-tile-pink hoặc grad-tile-orange
- Border: 0.5px pink-200 hoặc orange-200
- Shadow: shadow-card
- 2 radial glows: top-right tone đậm 120px, bottom-left tone phụ 80px
- Top row (icon + badge):
  - Icon container 46x46, radius 14px, gradient đậm tone tile:
    - Nhập hàng: grad-icon-pink (F43F5E → E11D48)
    - Phân tích: grad-icon-orange (FB923C → EA580C)
  - Icon Tabler 22px trắng
  - Shadow: shadow-pink-lg / shadow-orange-lg
  - Badge top-right: HOT (grad-badge-hot) hoặc AI (grad-badge-ai)
    - 9px / weight 700 / letter-spacing 0.3 / padding 3px 9px / radius 8px / shadow tone
- Bottom block:
  - Title 15px / weight 700 / color text-primary
  - Subtitle 11px / weight 500 / color text-secondary
  - Extra:
    - "Nhập hàng" tile: divider dashed pink-200/25, badge "⚡ 5 giây" pill + "/ sản phẩm"
    - "Phân tích" tile: mini SVG chart area cam, endpoint dot hồng có halo (3.5r + 6r halo opacity 0.25)
```

### 4.4 List Card

```
- Outer: padding 5px (just enough for inner radius), radius 20px
- Background: white
- Border: 0.5px pink-200
- Shadow: shadow-list
- Inside: 4 buttons, each 12px padding, radius 14px (for hover state)
- Divider 0.5px pink-100 between rows, with margin 14px horizontal

Row anatomy:
- Icon container 46x46, radius 13px, gradient light tone:
  - Tìm: grad-icon-pink-light + icon search BE185D
  - Mua: grad-icon-orange-light + icon shopping-bag C2410C
  - Gợi ý: grad-icon-rose-light + icon bulb BE123C
  - Giỏ: pink-200 → pink-300 + icon shopping-cart 9F1239
  - Shadow: shadow-pink-sm (matched tone)
- Center column:
  - Title 14px / weight 600 / color text-primary
  - With optional AI badge inline (grad-badge-ai)
  - Data row gap 6px:
    - Pill 1: 10px weight 600, background tone-100, color tone-800, padding 2px 7px, radius 6px
    - Info 2: 10px weight 500, color text-tertiary
  - "Giỏ hàng" exception: pill1 = money mono, info2 = "· 3 món"
- Chevron container 32x32, radius 11px, gradient match tile color, icon 15px
- Badge count (giỏ hàng): -5px top/right, grad-badge-hot, weight 700, border 2px white
```

### 4.5 Input Bar

```
- Outer: padding 14px sides
- Background: grad-input-bg (trắng → hồng nhạt)
- Border: 0.5px pink-200
- Radius: 30px (pill)
- Shadow: shadow-input
- Children:
  - Sparkle icon 18px pink-600 (decorative)
  - Input flex:1, placeholder "Hỏi tôi bất cứ điều gì..."
  - Camera button 36x36 circle, bg pink-100, color pink-700, icon 18px
  - Mic button 42x42 circle, bg grad-mic, color white, icon 20px, shadow-mic
```

### 4.6 Bottom Nav

```
- 4 tabs flex:1, padding 8px 4px 12px
- Background: white
- Border-top: 0.5px pink-100
- Each tab vertical:
  - Active indicator on top: 22x3px, grad-active, radius 2px (height: 3px placeholder for inactive)
  - Icon Tabler 22px:
    - Active: color pink-600 (or use grad text-fill via SVG)
    - Inactive: color #D1D5DB
  - Label 10px:
    - Active: weight 700, color pink-700
    - Inactive: weight 500, color #9CA3AF
- Badge for "Đề xuất" tab: top:0, right:14px, grad-badge-hot, min 18x18, border 2px white
```

## 5. Motion

```css
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
--motion-fast:   150ms
--motion-normal: 250ms
--motion-slow:   400ms
```

### 5.1 Signature Animations

| Element | Animation | Duration |
|---|---|---|
| AI orb | drift (translateY 0→-3px) | 4s infinite |
| Pulse ring (around orb) | scale 1→1.6 + opacity 0.6→0 | 2.4s infinite |
| Live dot (label amber) | glow opacity 0.7→1 + scale 1→1.05 | 1.6s infinite |
| Tile/Row mount | pop scale 0.96→1 + opacity 0→1 | 500ms ease-out, stagger 50ms |
| Mini chart bars | barRise scaleY 0.3→1 | 800ms ease-out backwards |
| Number counter | tween count up | 400ms |
| Cart badge bump | scale 1→1.2→1 spring | 300ms |
| Bottom sheet | spring up | 400ms |

Reduced motion: wrap mọi animation trong `@media (prefers-reduced-motion: no-preference)`.

## 6. Component Library — trạng thái thật (verified vs `apps/web/components`)

> ✅ **DONE & vượt plan.** Bảng dưới = design intent ban đầu; code thật **giàu hơn**. Inventory as-built = chính code (`apps/web/components/`) + Storybook (`apps/web/stories/`). Tóm tắt cây thật:
> - **`components/ui/`** (8 primitive shadcn): badge, button, checkbox, dialog, form, input, label, sheet.
> - **`components/icp/atoms/`** (10): Avatar, BrainIcon, Button, ChipPill, Icon, MiniSparkline, OrbPulse, Spinner, StatPill, StatusBar.
> - **`components/icp/layout/`** (5): AppHeader, BottomBar, HomeBottomNav, MainScroll, TopBar. *(PhoneFrame ở `icp/PhoneFrame.tsx`.)*
> - **`components/icp/molecules/`** (~43): ProductCard(+SearchB), HeroTile, ListTile, StatBar, ActionCard, AIInsightCard, MicButton, LivePartialTranscript, PhasesCard, AnalyzingPhasesCard, ImageDropZone, PrefillForm, ShopeeCompareCard(+Expanded), TrendCard(+Expanded), CartItemRow, SwipeableCartItem, CartSummary, PaymentMethodPicker, OtpField, ClarifyOptionChip, CoPurchase*HintCard, … (xem registry).
> - **`components/icp/organisms/`** (~14 + `charts/`): HeroInsightCard, DashboardHeader, SearchHeader, ChatThreadLayout, ConversationThread, BottomSheet, ChartCard, EmptyState, ErrorState, LoginForm, OrderSummary, HomeInputBar, MeSettingsMenu, SplashContent.
>
> Mapping plan→thật: `Chip`→`ChipPill`, `Badge`/`Input`→`components/ui`, `IconButton`/`Skeleton` = gộp/thay; thêm BrainIcon/OrbPulse/MiniSparkline/StatPill/StatusBar (không có trong plan, có trong code).

### 6.0 Plan ban đầu (design intent — giữ tham chiếu)

### 6.1 Atoms

| Component | Variants |
|---|---|
| `Button` | primary (pink-600), success, premium (orange-500), white-on-pink, ghost, danger, hero-cta-white, hero-cta-glass |
| `IconButton` | round 36/40/42px, square 32/36px |
| `Input` | text, search, password, with-prefix-icon |
| `Chip` | active filled, inactive outline |
| `Badge` | pink/orange/rose/amber + gradient variants (HOT, AI, COUNT) |
| `Avatar` | 28/32/36/40px, gradient cam cho user, gradient hồng cho AI |
| `Icon` | wrap `@tabler/icons-react`, sizes 14/16/18/20/22/24 |
| `Spinner` | dots, ring, pulse |
| `Skeleton` | line, block, circle với shimmer hồng |

### 6.2 Molecules

| Component | Description |
|---|---|
| `Pulse` | Wrap children với pulse-ring animation, props color |
| `LiveDot` | Pulsing colored dot + label |
| `Money` | Mono VND formatter |
| `StatCell` | Icon + number + label compact (for stat bar) |
| `DataPill` | Filled pill với tone variants |
| `ChevronCircle` | Round container có gradient + chevron icon |
| `RadialGlow` | Decorative background blob (props: position, size, color, opacity) |
| `SparkleDots` | 3 decorative white dots cho hero card |
| `MiniChart` | SVG area chart, 7 datapoints, endpoint halo |

### 6.3 Organisms (ICP-specific)

| Component | Description |
|---|---|
| `AppHeader` | Logo + greeting + bell + avatar |
| `HeroInsightCard` | grad-hero + AI orb + insight + 2 CTAs |
| `StatBar` | 3-cell card với divider |
| `SectionHeader` | Title + "Tất cả →" link |
| `HeroTile` | Big tile với glow + icon container + tagline/chart |
| `ListRow` | Row trong list card với icon + pill data + chevron |
| `ListCard` | Container wrap multiple ListRow |
| `UniversalInput` | Input bar với sparkle + cam + mic |
| `BottomNav` | 4 tabs với active indicator |
| `ChatBubble` | User (filled pink right) vs AI (white border left với sparkle avatar) |
| `BottomSheet` | Vaul-based pull-up sheet |
| `ProductCard` | Compact mobile, mono price, add icon mint |
| `ActionCard` | 5 variants với border-left tone |
| `OrderStatusPill` | Pending (sky) → Processing (orange) → Paid (mint) hoặc Failed (rose) |
| `ChartCard` | Recharts mobile, max-h 200px |

## 7. Pages — route thật (verified vs `apps/web/app`)

> Route hackathon `/mock/*` + `/style-guide` **không tồn tại** trong code. Route thật (`apps/web/app/`):

| Route | Nội dung | Trạng thái |
|---|---|---|
| `/` (`page.tsx`) + `layout.tsx` | Home shell + providers + PhoneFrame | ✅ |
| `/home` | Dashboard hub (Hero insight + StatBar + tiles + list rows + input bar + bottom nav) | ✅ |
| `/auth` | Login/splash/logout | ✅ |
| `/me` | Settings | ✅ |
| `/intent-01..07` | 7 route feature (import/buy/search/recommend/cart/pay/analytics) | ✅ (UI; backend tuỳ phase) |
| `/dev` | Dev/acceptance pages | ✅ |
| `/api` | Next API routes (rewrites→gateway) | ✅ |

> Mockup HTML (`docs/mockups/`) = **reference only** (1 phần nhỏ); chuẩn = code + DB. KHÔNG còn deliverable "10 mock pages".

## 8. Implementation — DONE (đã build)

> Các "Day 1–5 tasks" hackathon đã hoàn tất. Tóm tắt đã làm (evidence = code):
- ✅ `apps/web` Next.js + Tailwind + shadcn/ui; deps (Radix, `@tabler/icons-react`, recharts, react-hook-form, …)
- ✅ Fonts Be Vietnam Pro (globals.css)
- ✅ `app/globals.css` chứa toàn bộ CSS tokens §1; `tailwind.config.ts` extend theme
- ✅ PhoneFrame + layout (AppHeader/BottomBar/TopBar/MainScroll/HomeBottomNav)
- ✅ Atoms + Molecules + Organisms (xem §6 + code `apps/web/components/icp/`)

## 9. Folder Structure — thật (verified)

```
apps/web/
├── app/
│   ├── layout.tsx            ← PhoneFrame + providers
│   ├── page.tsx              ← Home shell
│   ├── globals.css           ← imports + tokens §1  (KHÔNG có styles/tokens.css riêng)
│   ├── home/  auth/  me/  dev/  api/
│   └── intent-01..07/        ← 7 route feature
├── components/
│   ├── ui/                   ← 8 primitive shadcn (badge/button/checkbox/dialog/form/input/label/sheet)
│   └── icp/
│       ├── atoms/  (10)
│       ├── layout/ (5)
│       ├── molecules/ (~43)
│       ├── organisms/ (~14 + charts/)
│       └── PhoneFrame.tsx
├── tailwind.config.ts        ← theme tokens
└── stories/ , e2e/           ← Storybook + Playwright (verify nếu cần)
```

> Folder plan cũ (`src/components/{chat,sheets,cards,chart,nav,decor,shared}`, `styles/tokens.css`, `lib/design-tokens.ts`) = **SAI vs code** → đã thay bằng cây thật ở trên.

## 10. Đặc sắc design v3 (talking points)

1. Hồng MoMo nâng cấp thẩm mỹ (gradient mượt, depth qua radial glow).
2. Đa sắc có cấu trúc (hồng 70% / cam 20% / vàng 10%).
3. Chiều sâu mềm — shadow màu hồng (không đen), radial glow trong card.
4. AI là trung tâm — Hero card + AI orb radial.
5. Dữ liệu sống — stat bar realtime, mini chart, badge động.
6. Mobile-first Vietnamese — Be Vietnam Pro diacritics.

---

## 11. Production hardening (CHƯA CODE / TÙY CHỌN — §5b)

| Hạng mục | Hiện trạng | Đề xuất | Nhãn | Ưu tiên |
|---|---|---|---|---|
| **A11y** | §5 đã ghi `prefers-reduced-motion`; chưa verify áp dụng toàn bộ | Audit a11y (contrast deep-maroon/hồng đạt WCAG AA; focus ring; aria cho mic/orb/sheet); wrap mọi animation trong `@media (prefers-reduced-motion: no-preference)` | 🟡 CHƯA CODE | P1 |
| **Bundle budget** | Budget < 500KB gz/route (`05 §11`) | Gate trong CI (`size-limit`/`next build` analyze); lazy-load recharts/vaul | 🟡 CHƯA CODE | P1 |
| **i18n** | Nhiều component hardcode tiếng Việt (registry "Known limitations") | Tách string sang i18n (next-intl) — cần khi mở thị trường/đa ngôn ngữ | 🔵 TÙY CHỌN | P2 |
| **Token contract test** | Tokens ở globals.css + tailwind.config | Test drift token FE↔doc (snapshot CSS vars) | 🔵 TÙY CHỌN | P2 |
| **Dark mode** | Chỉ light theme | Thêm dark token set nếu cần | 🔵 TÙY CHỌN | P2 |
| **PWA** | Manifest theme — chưa verify | Verify manifest + icon 192/512 + offline shell | 🟡 CHƯA CODE | P2 |

---

## Khi Phase 00 hoàn tất (đã DONE)

Trạng thái bàn giao: tokens + font + component library + route feature đã build trong `apps/web`. Inventory as-built = code (`apps/web/components/`) + Storybook. Phần còn lại = production hardening §11.

---

**END — PHASE_00 (Production reconcile 2026-06-09).**
