# PHASE 00 — Intent 08 (Login/Logout by Text) Mockup Handoff

> **Status:** ✅ Complete · 7 mockup files (1 splash + 6 login/logout flow)
> **Date:** 2026-05-17
> **Owner:** AI Agent · Phase 00 Mockup Lead
> **Next:** Phase 02 backend skeleton — không cần migration mới

---

## 0. TL;DR

Intent 08 (Login/Logout) đã được mockup đầy đủ với **brand identity mới "AI Brain"** — Aida được positioning là bộ não AI cho thương mại, tagline "Hiểu — Học — Hành động" và "Mỗi quyết định đều được kết nối thông minh".

**Migration:** 0 mới. Auth schema đã đầy đủ trong V001 (`users`, `sessions` tables).
**Schema extension:** Không cần.
**Brand assets mới:** SVG `mini_brain` icon — tái sử dụng được trong header avatar, loading state, success badge ở tất cả intents sau.

---

## 1. File Inventory

| # | State | File | Purpose |
|---|-------|------|---------|
| 1 | 0 — Splash | `intent-08-state-0-splash.html` | Brand splash với AI Brain centered, tagline + button "Bắt đầu →" |
| 2 | A — Login Form | `intent-08-state-A-login.html` | Form email/password rỗng + demo account hint card |
| 3 | B — Loading | `intent-08-state-B-loading.html` | Form filled + spinner trên button + "Đang xác thực..." |
| 4 | C — Wrong Password | `intent-08-state-C-wrong-password.html` | Form shake + red border password input + error message |
| 5 | D — Network Error | `intent-08-state-D-network-error.html` | Wi-Fi off icon + retry button + `E_NETWORK_TIMEOUT` |
| 6 | E — Success | `intent-08-state-E-success.html` | Brain với check badge + greeting "Xin chào, Anh Nam" + progress bar |
| 7 | F — Logout | `intent-08-state-F-logout.html` | Profile screen + confirm card "Đăng xuất khỏi tài khoản?" |

---

## 2. Field Audit

| UI element | Source | Status |
|---|---|---|
| Email input | FE state | ⚠️ DERIVED |
| Password input + show/hide | FE state | ⚠️ DERIVED |
| "Ghi nhớ tôi" checkbox | FE state | ⚠️ DERIVED |
| "Quên mật khẩu" link | Skip cho hackathon | ⏭️ |
| Demo account card | Hardcoded marketing | ⏭️ STATIC |
| Submit button | `POST /api/v1/auth/login` | ✅ V001 |
| Loading state | FE state during fetch | ⚠️ DERIVED FE |
| JWT cookie set | Response `Set-Cookie` header | ✅ V001 |
| Session record | Postgres `sessions` table | ✅ V001 |
| Display name greeting | Postgres `users.display_name` | ✅ V001 |
| Avatar initials | FE-derived từ `display_name` | ⚠️ DERIVED FE |
| Session expiry display | `sessions.expires_at` - now | ⚠️ DERIVED FE |
| Error 401 (wrong password) | Server response | ✅ V001 |
| Error network/timeout | Fetch promise reject | ⚠️ DERIVED FE |
| Logout submit | `POST /api/v1/auth/logout` → `sessions.revoked_at` | ✅ V001 |

**Verdict:** ✅ 0 migration, 0 schema extension.

---

## 3. ADRs

### ADR-08-01 — Brand "AI Brain" identity

**Decision:** Aida được positioning là "AI Brain for Commerce" với visual identity là não bộ anatomical (concept C đã chọn).

**Components:**
- **Brain shape:** Single SVG path organic (không phải 2 hemisphere medical), gradient pink core `#FFE4E6 → #F9A8D4 → #BE185D`.
- **Synapse lines:** White curves bên trong não (6 curves: 3 horizontal + 3 vertical) + 5 white nodes ở các giao điểm.
- **Aura:** Radial glow xung quanh `rgba(233,30,99,0.4) → rgba(251,146,60,0.2) → transparent`, animate scale 1↔1.1.
- **Satellite nodes:** 4 dots (2 hồng `#E91E63` + 2 cam `#FB923C`) pulse với stagger delay 0.5s mỗi cái.

**Rationale:** Brain metaphor mạnh, memorable, khớp với positioning "AI assistant cho merchant". Anatomical (không phải orbital) → warm, không tech-cold. Pink-orange palette khớp v3 design system.

**Reusability:** `mini_brain(size)` function trong build.py → tái sử dụng được làm:
- Header avatar (40-60px) trong các chat intent
- Loading state placeholder
- Success badge với check overlay
- Empty state illustration

---

### ADR-08-02 — Tagline "Hiểu — Học — Hành động"

**Decision:** Subtitle 3 verbs Vietnamese uppercase letter-spacing 2.5px, kèm 2 thin lines hai đầu như "scroll ornament".

**Rationale:** 3 verbs phản ánh chính architecture của LangGraph agent loop: **understand** (parse intent) → **learn** (RAG retrieval) → **act** (call tools). Người dùng Việt cảm thấy gần gũi, không khô khan như "Understand · Learn · Act".

**Main tagline:** "Mỗi quyết định đều được kết nối thông minh" — mơ hồ vừa đủ để fit nhiều scenarios (search/recommend/analytics/payment đều "ra quyết định kết nối").

---

### ADR-08-03 — Login form layout

**Decision:**
- Form trong card 0.5px border `#FBCFE8`, radius 20px, padding 22×20px, shadow pink 10%.
- Input field: `#FEF7F9` bg, 0.5px border, radius 13px, icon prefix (mail/lock) màu `#BE185D`, padding 11×14px.
- Submit button: gradient `#E91E63 → #F43F5E`, radius 14px, weight 700, shadow pink 32%.
- Demo account card: dashed border, `#FFFFFF → #FEF3F8` gradient, monospace font cho credentials.

**Rationale:** Form là focal point — card raised với shadow nổi bật trên bg pink-orange. Demo account dashed border → visually signal "đây là helper text, không phải UI chính".

---

### ADR-08-04 — Error state encoding

**Decision:** Khác biệt giữa **client error** (wrong password) và **system error** (network) cần thiết kế khác nhau.

**Wrong password (state C):**
- Inline error message trong card (red left-border 3px)
- Red border 0.5px trên password input field
- `shake` animation cho cả form khi submit fail (0.5s)
- Giữ lại email (không clear) — user không phải gõ lại

**Network error (state D):**
- Replace form bằng error card với big icon (60px Wi-Fi off, pulse ring xung quanh)
- Error code monospace `E_NETWORK_TIMEOUT` + trace ID
- 2 button: "Thử lại" (primary pink) + "Báo lỗi" (secondary)
- Vẫn show demo account card → user có thể test với credentials khác

**Rationale:** Client error → user có thể tự sửa, ít disruptive. System error → user bất lực, cần guidance rõ + retry path.

---

### ADR-08-05 — Success state với brain animation

**Decision:** Success không chỉ là toast/redirect — là **brand moment** với brain SVG 180px + green check badge bottom-right (`scale 0 → 1.2 → 1` cubic-bezier elastic).

**Components:**
- Brain (giữ nguyên animation từ splash)
- Check badge 48px, gradient `#10B981 → #059669`, border 3px white, shadow green 50%.
- Pulse ring xung quanh brain (green, opacity 0.18, animate scale 1→1.6).
- "ĐĂNG NHẬP THÀNH CÔNG" small uppercase label (success green letter-spacing 2px).
- "Xin chào, Anh Nam" 30px gradient pink-orange.
- Progress bar 240×4px animate scaleX 0→1 trong 2s → simulate redirect countdown.
- Bottom: green pulse dot + session info monospace `ses_8b4f...a12 • exp: 24h`.

**Rationale:** Login success là "first impression" — đầu tư animation đáng. Brain reappear với green check → "AI đã chào bạn rồi". Progress bar 2s = redirect timing thực tế.

---

### ADR-08-06 — Logout flow là confirm card, không phải button đơn

**Decision:** Logout không phải single button — là confirm card với 2 options ("Ở lại" / "Đăng xuất") trên profile screen.

**Rationale:** Tránh accidental logout (user tap nhầm). Confirm card có icon đỏ + explanation + 2 button equal-width.

**Profile screen layout:**
1. **User card:** Avatar 60px (AN initials gradient orange), display name, email, "Đang hoạt động" status dot.
2. **Stats grid:** Phiên (còn 23h) + Đăng nhập (9:41 hôm nay) — 2 column.
3. **Menu list:** Thông báo / Bảo mật / Trợ giúp với icon + chevron right.
4. **Logout confirm card** (red border-left 3px) — không phải menu item bình thường, mà là card riêng với 2 button hành động.
5. **App version** ở dưới cùng monospace `Aida v0.1.0 • build a3f2c89`.

---

### ADR-08-07 — Status bar mock

**Decision:** Tất cả 7 mockup có status bar 14×22px ở top hiển thị `9:41` + signal/wifi/battery icons.

**Rationale:** Mobile-first frame phải có status bar mới feel "real device" cho hackathon demo. 9:41 = standard Apple demo time.

---

## 4. SSE / API Contract

### `POST /api/v1/auth/login`

**Request:**
```typescript
{
  email: z.string().email(),
  password: z.string().min(8),
  remember_me: z.boolean().default(false),
}
```

**Response 200:**
```typescript
{
  user: {
    id: string;          // UUID
    email: string;
    display_name: string;
  };
  session: {
    id: string;          // UUID, used for revoke later
    expires_at: string;  // ISO 8601
  };
}
// Set-Cookie: aida_session=<jwt>; HttpOnly; Secure; SameSite=Strict; Max-Age=86400
```

**Response 401:**
```typescript
{
  error: 'INVALID_CREDENTIALS';
  message: 'Email hoặc mật khẩu không đúng';
}
```

**Response 5xx / Network error → FE catch:**
```typescript
{ error: 'E_NETWORK_TIMEOUT' | 'E_SERVER_DOWN'; trace_id?: string; }
```

### `POST /api/v1/auth/logout`

**Request:** (cookie auto-sent)

**Response 200:**
```typescript
{ revoked_at: string; }
// Set-Cookie: aida_session=; Max-Age=0
```

---

## 5. Phase 02 Implementation Tasks

### Backend (NestJS)
- [ ] `AuthController` với 2 endpoints: `/auth/login` + `/auth/logout`.
- [ ] Bcrypt password compare (cost factor 10 đủ cho hackathon).
- [ ] JWT sign với `jose` library, payload `{ user_id, session_id }`, exp 24h.
- [ ] Insert row vào `sessions` khi login, set `revoked_at` khi logout.
- [ ] Middleware `JwtGuard` check cookie + verify + load user → request context.
- [ ] Error mapping: bcrypt mismatch → 401 INVALID_CREDENTIALS.
- [ ] Seed merchant data: `merchant@demo.vn / demo1234` trong V001 seeder.

### Frontend (Next.js)
- [ ] `app/(auth)/login/page.tsx` — page với splash + login form (state 0 → A).
- [ ] `components/auth/LoginForm.tsx` — controlled form với react-hook-form + zod validation client-side.
- [ ] `components/auth/BrainIcon.tsx` — reusable SVG brain với prop `size`.
- [ ] `components/auth/StatusBar.tsx` — mock status bar (chỉ visible khi dev mode hoặc forcestyle prop).
- [ ] `lib/auth/useAuth.ts` — hook quản lý session state, logout action.
- [ ] State machine: idle → submitting → success | error_credentials | error_network.
- [ ] Shake animation khi 401: `framer-motion` animate `x: [-4, 4, -4, 0]` 0.5s.
- [ ] Success page: 2s countdown trước khi `router.push('/home')`.
- [ ] Logout confirm: dialog với `<AlertDialog>` từ shadcn, không phải custom card (giữ logic consistency).

### Shared types
- [ ] `packages/shared-types/src/auth.ts` với `LoginRequestSchema`, `LoginResponseSchema`, `AuthErrorCode`.

### Design system reuse
- [ ] `BrainIcon` component được Intent 03/04 dùng làm header avatar và loading state.
- [ ] Status bar component reuse cho mọi screen mobile.

---

## 6. Known Issues / Tradeoffs

1. **Brain SVG path không scale tốt < 40px** — chi tiết synapse + nodes biến mất. Mitigation: dùng simplified brain (chỉ shape + aura, bỏ synapse) cho size nhỏ.
2. **"Ghi nhớ tôi" checkbox** chưa wire vào BE → BE luôn issue token 24h. Phase 02 nếu time, extend `Max-Age` lên 30 days nếu remember_me=true.
3. **Demo account hint** lộ credentials trên UI → chỉ cho dev/staging. Production: feature flag `SHOW_DEMO_ACCOUNT=false`.
4. **Network error có thể nhầm với 5xx server error** từ phía user. Có thể cần 2 message khác nhau ("Mất kết nối" vs "Máy chủ tạm gián đoạn") — Phase 02 detect bằng `navigator.onLine`.
5. **Success greeting "Xin chào, Anh Nam"** — `display_name` có thể có ký tự đặc biệt hoặc dài → cần truncate/sanitize. Test với edge case như emoji name, ALL CAPS, 50+ chars.

---

## 7. Visual QA Checklist

- [ ] Splash: brain ở chính giữa khung 414×844, không lệch trái/phải/trên/dưới.
- [ ] Splash: tagline + button + pagination dots không overlap brain.
- [ ] Login form: 3 trường (email + password + button) đều radius nhất quán.
- [ ] Loading: spinner xoay đều, button không clickable (opacity 0.85).
- [ ] Wrong password: shake animation chạy 1 lần (không loop), border đỏ chỉ ở password field.
- [ ] Network error: pulse ring đỏ visible, retry button nổi bật.
- [ ] Success: check badge bottom-right brain, progress bar fill từ trái sang phải.
- [ ] Logout: confirm card đỏ visually distinct với menu items phía trên.

---

## 8. References

- `00_CONTEXT.md` — project anchor (V001 auth schema, 8 intents)
- `INTENT_AUDIT_REPORT.md` — Intent 08 pre-audit (0 migration verdict)
- `PHASE_00_DESIGN_SYSTEM.md` — v3 MoMo tokens
- `PHASE_00_INTENT_03_MOCKUP_HANDOFF.md` — sibling handoff (search by text)

---

**Handoff complete. Ready for Phase 02 backend skeleton.**
