# Master Backlog — ICP (Production)

> Single Home của STATUS dự án. **Nguồn sự thật:** `docs/FACTS.md` (live DB/code,
> regen bằng `bash scripts/gen-facts.sh`). Khi mục §1–§4 và FACTS lệch → FACTS thắng.
> Direction (§1) là chỉ nam ngắn; queue (§3) là việc còn lại; archive đầy thì dồn sang
> `BACKLOG_ARCHIVE.md` (chưa cần).

## §1 Direction

**Mục tiêu production (3 dòng):**
- ICP là SaaS multi-tenant phục vụ nhiều shop VN; 8 intent AI commerce trên 1 màn hình.
- Go-live yêu cầu tenant isolation + thanh toán thật (VNPay/Momo/ZaloPay) + tuân thủ
  GDPR & Luật BVDLCN 2025 (Luật 91/2025/QH15) + audit không-chối-được + alerting.
- Code hiện tại = lõi 8 intent + Auth + Search + Cart + Import + Voice Buy + Reco +
  Analytics đã chạy; **gap go-live = tenant, payment, compliance, hardening, workers**.

**Phase labels (nhãn nhóm, KHÔNG còn là đơn vị công việc — đv = slice/episode):**
00 Design System · 01 Infra · 02 Auth+Search · 03 Import+Cards · 04 Cart+Buy+Pay
· 05 Reco+Analytics · 06 Polish/Obs/Ops.

**Dependency graph (đơn giản hoá):**

```
00 (UI) ─┐
01 (Infra) ─┴─► 02 (Auth+Search) ─► 03 (Import) ─► 05 (Reco+Analytics)
                                  └► 04 (Cart+Buy+Pay) ──────────────┴─► 06 (Obs/Ops)
                                                              ↓
                                                        Hardening ──► GO-LIVE
```

**Critical path go-live (P0, ADR-045):**
**TENANT (V011) → PAYMENT (V011 ALTER) → COMPLIANCE (V011) → AUTH HARDENING → DR →
ALERTING**. Lý do đảo so với roadmap cũ: tenant phải nhúng schema sớm — payment + GDPR
+ analytics đều scope theo tenant; retrofit sau tốn gấp 3.

**Re-architecture program (ADR-052, supersede một phần ADR-045§b):** 8 cluster C1–C8
thứ tự ép bởi ràng buộc cứng — W-66 deadline → perimeter P0 → safety-net → outbox/DLQ
→ media/cache → tenant depth → AI v6 → scale infra. Sổ phủ 105 finding = §3 map dưới.

**NFR phê chuẩn bởi Human 2026-06-13 (ADR-052):**
- **1.000 tenant** năm 1 · **500 RPS** sustained / **2.000** peak.
- p95 **REST <300ms** · p95 **intent-stream-start <2s** · availability **99,9%**.
- **RPO 15min / RTO 1h**.
- **LLM cost** = proxy **đ/intent-call** (chốt số sau 2 tuần data W-93).

## §2 Slices (registry vĩnh viễn — danh tính, không brief)

| ID | Tên | Phase | Status | Episodes |
|---|---|---|---|---|
| S-00 | Repo Reality Check | — | ✅ | — |
| S-00b | Foundation Scaffold | 01 | ✅ | — |
| S-01 | UI Foundation | 00 | ✅ | — |
| S-02 | Runtime Foundation | 01 | ✅ | — |
| S-03 | Auth + Home Dashboard | 02 | ✅ | — |
| S-04 | Product Discovery (search) | 02 | ✅ | — |
| S-05 | Cart/Order | 04 | ✅ | — |
| S-06 | Payment | 04 | 🟡 | — |
| S-07 | Image AI Import | 03 | ✅ | — |
| S-08 | Voice Buy | 04 | ✅ *(TTS FE deferred)* | — |
| S-09 | Recommendation | 05 | ✅ | — |
| S-10 | Analytics Voice | 05 | ✅ | — |
| S-11 | Hardening | 06 | 🟡 | — |
| S-META-01 | Workflow v2 bootstrap (FACTS+CLAUDE.md+guards) | META | ✅ | — |
| S-META-02 | Hoà tan docs cũ | META | ✅ | T01 ✅ · T02 ✅ · T03 ✅ · T04 ✅ · T05 ✅ · T06 ✅ · T07 ✅ · T08 ✅ |
| S-P0-01 | Multi-tenant SaaS (RLS + tenant_id) | 01 | 🟡 | T01 ✅ · T02 ✅ · T02b-1/2/3 ✅ *(nợ e2e 2-tenant FE → T05)* · T02c ✅ · T03a ✅ · T03c ✅ *(nợ SSE e2e → T03b/T05)* · T03d ✅ *(nợ e2e storefront → T05)* · T03e ✅ *(nợ e2e customer storefront live → T05)* · T03b ✅ *(nợ SSE e2e live → T05)* · T04 ✅ *(nợ cross-tenant 0-row live + matview live + backfill run → T05)* · T05 ⬜ |
| S-P0-02 | Stop-the-bleed (Cluster C1, ADR-052) | P0 | ✅ | T01 ✅ · T02 ✅ · T03 ✅ · T04 ✅ · T05 ✅ · T06 ✅ *(cart deploy-lag regression, phát hiện T05 smoke)* |
| S-P0-03 | Safety-net (Cluster C2, ADR-052/054) | P0 | 🟡 | T01 ✅ *(CI soft→hard + coverage ratchet + openapi gate W-46 + deploy-drift wired; pulled 2 web fix + Python ruff/pytest; nợ → T01b CI-Postgres + T01c-hotfix _fetch_price_solver)* · T01b ⬜ · T01c-hotfix ⬜ · T02 ⬜ · T03 ⬜ · T04 ⬜ · T05 ⬜ |
| S-AUDIT | Docs audit định kỳ (vĩnh viễn) | META | ∞ | T01: rewrite `docs/README.md` theo cấu trúc v2 (phát hiện từ T08) — chờ |


## §3 Queue P0 → P1 → P2 (việc còn lại tới go-live)

### P0 — bắt buộc trước go-live (theo order tenant → payment → compliance)

| # | Item | ADR | Status | Ghi chú (từ verify) |
|---|---|---|---|---|
| 1 | Multi-tenant SaaS (RLS + tenant_id) | ADR-040 | 🟡 → S-P0-01 | V011 applied (T01 ✅): tenants/memberships + tenant_id 10 bảng + RLS + icp_app; còn wire runtime T02–T05 |
| 2 | Payment VNPay/Momo/ZaloPay (Intent 06) | ADR-038 | 🟡 | orders/payments controller + IPN signature + idempotent dedup_key + V011 ALTER `chk_payment_method +vnpay` |
| 3 | `payment_callbacks` + status `refunded` | ADR-038 | 🟡 | 1 txn ↔ N callback; V011 |
| 4 | GDPR/Luật BVDLCN 2025 consent + DSAR + retention | ADR-041 | 🟡 | `consent_records`/`data_subject_requests`/`data_retention_policies` chưa có; consent gate tracking; V011 |
| 5 | Auth hardening (rate-limit + refresh rotation + CORS/CSP) | — | 🟡 | `@nestjs/throttler`+Redis; reuse-detection trên `sessions.refresh_token_hash` UNIQUE (V009 đã có) |
| 6 | DR / backup / PITR | — | 🟡 | pg_dump + WAL-G + restore runbook; Vespa/Redis snapshot |
| 7 | Grafana Alerting + SLO/error-budget + production dashboards | — | 🟡 | alert p95/error-rate/payment/aggregator; dashboards Service map (RED), Intent latency, LLM cost, Behavior funnel, per-tenant panel |
| 8 | File upload validate (MIME + size) | — | ✅ | DONE S-P0-02/T03 (W-63): magic-byte png/jpeg/webp + size cap TRƯỚC decode/vision → 415/413 (`intent/image-upload.validator.ts`) |
| 9 | Tenant-scoped analytics matview | — | 🟡 | matview +`tenant_id` GROUP BY (sau S-tenant) |
| 31 | Idempotency MW order: chạy SAU JwtAuthGuard | — | 🟡 | MW hiện trước guard → userId='anon' luôn + tenantScope từ header client-controlled (idempotency.middleware.ts:111-155); cache-hit serve trước auth. Pre-existing trước T02. Fix cần refactor MW chain order (RECON T02 Issue #4). cross-tenant risk: cache scope theo header client tự khai → thủng isolation S-P0-01 đang xây |

### P1 — nên có

| # | Item | ADR | Status | Ghi chú |
|---|---|---|---|---|
| 10 | Kafka wire + topic `icp.*` | ADR-002 | 🟡 | hiện chỉ Redis pub/sub `sse:pubsub:{rid}`; 0 import kafkajs |
| 11 | Outbox-relay worker + sweeper + DLQ | ADR-006 | 🟡 | Outbox WRITE có thật (MCP `events.append`, `published_at=NULL`); relay→Kafka + sweeper chưa wire |
| 12 | 8 worker canonical (skeleton → thật) | ADR-002 | 🟡 | `apps/workers/src` hiện chỉ 2 file; cards = inline trong graph (`importing_by_images.py:751`) |
| 13 | Shopee crawler thật (`shopee-crawl`) | ADR-039 | 🟡 | giữ schema `shopee_prices_mock` → đổi nguồn; rủi ro ToS |
| 14 | Hash-chain audit (`audit_log` + worker) | ADR-042 | 🟡 | bảng + worker `audit-logger` chưa có; SHA256(prev_hash ‖ canonical_json); V011/V012 |
| 15 | Circuit breaker + retry (call ngoài) | — | 🟡 | VNPay/Momo/ZaloPay + Vespa + Gemini/OpenAI + Shopee |
| 16 | Matview refresh job (3 matview) | — | 🟡 | cron `REFRESH MATERIALIZED VIEW CONCURRENTLY` |
| 17 | `products` CRUD (GET/POST/DELETE) | — | 🟡 | hiện chỉ `PATCH :id` |
| 18 | CI gate nâng cao | — | 🟡 | lint --max-warnings 0 + tsc + openapi:sync drift + coverage + next build apps/web — bằng chứng: latent break CSS import T02b-1 lọt CI green (report T02b-2 issue #1), tsc không resolve CSS import. spec files bị tsconfig exclude khỏi typed-lint — vướng 2 task liên tiếp (T03c known-issue-2, T03d known-issue-1) |
| 19 | Load test (k6) + runbook/on-call | — | 🟡 | verify SLO |
| 20 | Secrets vault + graceful shutdown | — | 🟡 | rotate JWT/API; SIGTERM drain |
| 21 | Regex-PII redactor (bổ sung Pino path-redact) | — | 🟡 | — |
| 22 | A11y audit (reduced-motion + WCAG AA + aria) | — | 🟡 | — |
| 23 | Redis HA (Sentinel/Cluster) | — | 🟡 | RedisSaver + pub/sub SPOF |
| 33 | Script `backfill-image-descriptions` rework | — | 🟡 | per-tenant + identity header + đi qua MCP (hiện PG-direct + Vespa-direct, vi phạm ADR-003, không tenant — tombstoned T03d) hoặc retire |

### P2 / TÙY CHỌN — khi scale

| # | Item | ADR | Status | Ghi chú |
|---|---|---|---|---|
| 24 | Per-tenant LTR `personalized` | ADR-043 | 🟡 | `tenant_ranking_weights` chưa có; `product.sd` 6 profile, KHÔNG có `personalized` |
| 25 | Usage metering (billing SaaS) | ADR-044 | 🟡 | `usage_events`/`usage_daily` chưa có |
| 26 | `co_purchase_matrix` precompute | — | 🔵 | reader=`analytics.co_purchased` (on-the-fly); chỉ khi chậm ở scale |
| 27 | TTS FE audio playback | — | 🔵 | wire `speech.synthesize` → FE |
| 28 | gtrends real API / Image CDN / dark mode / i18n / token contract test | — | 🔵 | — |
| 29 | Đồng bộ log level enum structlog→Pino (warning→warn, critical→fatal) | — | 🔵 | query Loki hiện phải OR 2 enum |
| 30 | Inline comment pattern voice:context Redis FIFO 5 turns TTL 30min (Intent 02 + 07) | — | 🔵 | thêm note tại `_node_load_voice_context` 2 graph khi chạm code; "KHÔNG đổi schema mà không bump version" |
| 34 | FE ẩn/khoá page intent 01+07 dưới `/s/[slug]` cho non-member (hiện 403 lúc submit — UX, không security) | ADR-050 | 🟡 | sau T03e enforce per-intent policy |
| 32 | `nest build` emit không hoạt động, dùng `tsc` trực tiếp | — | ✅ | FIXED 06-12: Dockerfile `rm -rf dist *.tsbuildinfo` + `build`=`tsc -p tsconfig.build.json` (incremental:false) thay nest build → clean full emit. Acceptance: delta source + docker build CÓ-cache → string mới có trong dist của image + gateway tsc-built boot OK. (Lịch sử: docker build có-cache ship dist stale, lộ ở smoke T02c) |
| 35 | Workers runtime: tsx → dist compiled (đồng bộ cách fix #32 của gateway) | — | 🟡 | gán C3-RT. Nợ từ S-P0-02/T02: housekeeper chạy qua `tsx src/*.ts` (ESM `.js` ext + parity seed-shopee); chuyển sang `node dist/*.js` khi C3-RT chuẩn hoá runtime worker |

### Map 105 finding → cluster (ADR-052 · nguồn `docs/INVENTORY_2026-06-13.md`)

> Sổ phủ luật **W-ID mồ côi** (CLAUDE.md §5): mọi ID inventory phải có nhà.
> **Đếm: 14+17+13+8+0+5+9+14+10 (C1·C2·C3·C3-RT·C4·C5·C6·C7·C8) + 12 GIỮ + 3 S-AUDIT = 105.** ✅
> ID = A1–A22 (S-SCALE-AUDIT) + W-23…W-105. ID chỉ sống ở cột **IDs** (tên cluster machine-clean).
> Đóng cluster → tick W-IDs nhận (✅/🟡/🔵). Bất biến cứng (ADR-052): **outbox/DLQ + error
> envelope (C3) XONG TRƯỚC payment (C4)**.
> ⚠️ **Ranh giới C2–C8 PROVISIONAL** (neo theo thứ tự ADR-052 + domain inventory),
> firm khi từng slice spawn. **C1 chốt** (= slice S-P0-02). Phân theo verdict/domain,
> KHÔNG theo severity (1 P1 latent có thể nằm C1).

| Cluster | Tên | IDs (∑) | Slice |
|---|---|---|---|
| **C1** | Stop-the-bleed (timebomb + perimeter P0 + latent-P0 design) | W-58✅,59✅,60✅,61🟡,62✅,63✅,66✅,67✅,85✅,94✅,104✅ · A16✅,A17✅,A18✅ (**14**) | **S-P0-02** (active) |
| **C2** | Safety-net (test/CI/eval/golden + obs cost-trace) — TRƯỚC AI-refactor | A13 · W-32,37,40,**46✅**(openapi gate, S-P0-03/T01),54,55,56,74,75,**76🟡**(soft-fail→hard+ratchet+git_sha gate **partial**: deploy-drift gate wired [smoke-live.sh+GIT_SHA stamp], live-smoke stage conditional→T01b),77,78,79,80,81,93 (**17**) | **S-P0-03** (active) |
| **C3** | Async backbone & event integrity (Kafka/outbox/relay/DLQ/envelope/retry-CB/events-partition) — XONG TRƯỚC payment | A7,A10,A11,A12,A15,A20,A21 · W-44,68,70,71,72,73 (**13**) | — |
| **C3-RT** | Runtime-prod hardening & backpressure (flask→gunicorn/MCP-pool/Redis-HA/SSE-cap/deadlock-retry/load-shed) — *split của C3 per Plan KI#3* | A1,A3,A4,A5 · W-86,95,96,97 (**8**) | — |
| **C4** | Payment & order integrity | (**0** inventory — payment = build mới BACKLOG #2/#3, không phải weakness có sẵn; phụ thuộc cứng C3 outbox/DLQ) | — |
| **C5** | Media & cache (object store/CDN/cache-tiers/ETag) | W-47,88,89,90,91 (**5**) | — |
| **C6** | Tenant depth (quota/lifecycle/GDPR-delete/RLS-deep/PII/index-composite) | A6 · W-45,50,51,57,87,98,99,100 (**9**) | — |
| **C7** | AI v6 (ADR-051: evidence-loop/tool-RAG/reflection/validate/route-lite/guardrails) | W-23,24,25,26,28,31,33,34,35,36,38,39,42,92 (**14**) | — |
| **C8** | Scale infra (k8s/Vespa-HA/mTLS/secret-mgr/WAF/CDN-assets/ISR-SSG/JWT-kid) | A8,A19,A22 · W-64,65,69,101,102,103,105 (**10**) | — |
| **GIỮ** | Verdict GIỮ — KHÔNG cần action (defer/chủ ý) | A2,A9,A14 · W-27,29,30,41,43,48,49,52,53 (**12**) | — |
| **S-AUDIT** | Docs/workflow drift → audit định kỳ | W-82,83,84 (**3**) | S-AUDIT |

**Phán quyết Plan KI#3:** bất biến = "outbox/DLQ + error envelope XONG TRƯỚC payment".
relay (W-68) + envelope (W-44) + events-partition (A7) → **C3** (KHÔNG C5: async backbone
≤C3, trước media/cache C5 + payment C4). **Runtime-prod tách hàng riêng C3-RT** (gunicorn
A1/MCP-pool A3/Redis-HA A4/SSE-cap A5 + backpressure W-86/95/96/97) — theo điều kiện KI#3.
**W-61** primary C1 (critical npm→0 ở T05: next 14.2.25 + vitest 3.2.6), residual npm
high/moderate → C8; **pip CVE langgraph** (4, AI; PYSEC-2026-83 + CVE-2025-64439 +
CVE-2026-27794) → **C7** (kernel refactor C7 bump langgraph major tất yếu, vá CVE đi cùng
chuyến; MCP pip = 0). **W-104**
🟡 **deferred→C8 (risk-accepted)** — key Gemini/OpenAI đã lộ trong audit output;
**Human chấp nhận rủi ro 2026-06-13** (key paid có limit chi tiêu); runbook rotate =
`docs/RUNBOOK_SECRETS.md` (T04); rotate THẬT + secret-manager khi làm C8.

**Notes T04 (C3-RT/C2 scope):** **W-97** load-shed đầy đủ **(gồm resume path)** — T04
chỉ bound /intent request-spawn (`main.py:465`), resume (`:606`) = continuation chưa
bound; total in-flight cap gồm resume → C3-RT. **W-75** (e2e cluster CI) +nợ: fix parse
seed customer password (cross-user idempotency e2e bị skip ở T04 acceptance #1, isolation
đã đảm bảo structural bởi user-id verified trong key).

**Note T06 (C2 scope):** **W-76** (CI safety-net) +**deploy-drift gate**: build SHA stamp
trong image + live-smoke so SHA container vs HEAD (bài học T06 — cart outage do mcp stale
pre-T03b ẩn vì CI soft-fail + cart chưa smoke; + BACKLOG #32 docker-cache-stale tiền lệ).

**Residual S-P0-03/T01 (ruff-baseline + suspected bug):** gỡ CI soft-fail (W-76) lộ nợ Python —
6 `# noqa` baseline trong `apps/ai` (vá khi chạm file): 5×F841 `user_id` extraction vestigial
(`cart_by_text.py` ×3, `buying_by_voices.py` ×2) + **1×F821 NGHI BUG THẬT** —
`importing_by_images.py:_fetch_price_solver(mcp_client, context)` gọi `identity_kwargs(state)`
với `state` UNDEFINED → NameError trên path `avg>0` (KHÔNG bắt bởi `except McpError`); identity
KHÔNG thread vào `analytics.suggest_price` MCP call. Chưa fix (đổi signature graph dùng chung,
untestable thiếu langgraph local). Giữ noqa-baseline T01 tới khi hotfix đóng. Ratchet floor
gateway=29% (DB-integration specs opt-out `RUN_DB_TESTS` khi không có PG; nâng khi T01b thêm
CI-Postgres job). 5×F841 vestigial: dọn khi chạm file ở C7.

- **T01c-hotfix** *(mới, không W-ID — phát hiện T01, chạy SAU T01b)*: `_fetch_price_solver`
  identity NameError, `ai/graphs/intents/importing_by_images.py`.

**T01b (tách khỏi T01 — cần compose/DB runner, chạy TRƯỚC T01c-hotfix):** matrix Postgres
service trong CI + `RUN_DB_TESTS=1` cho gateway (19 spec auth/tenant-isolation un-skip) + mcp
stock-atomic + ratchet lại gateway floor (29% → số mới đo). Acceptance: spec đang skip chạy thật
+ demo gate-bite postgres-down → đỏ + revert. *(openapi gate W-46 + deploy-drift artifacts ĐÃ
vào T01 — export standalone không cần compose; chỉ live-smoke stage `deploy-smoke` conditional
`RUN_DEPLOY_SMOKE=true` → T01b.)*

## §4 Done gần đây

- **2026-06-13 · S-P0-02 CLOSE** (`93befff` + close) — **Cluster C1 Stop-the-bleed ✅
  (6 task, 13 finding + 1 regression):** T01 governance pack (5 ADR 051-055 + 3 amend +
  NFR + map 105→cluster + re-verify 13/13) · T02 housekeeper worker (gỡ bom W-66 partition
  + W-67 matview, V014) · T03 vỏ cứng Gateway (W-58 ValidationPipe · W-60 throttler+Redis ·
  W-62 helmet · W-63 upload sniff, #8) · T04 danh tính+cô lập (#31 idempotency interceptor
  SAU guard · ADR-047 gỡ ports · W-104 runbook · W-94 semaphore 503) · T05 stock atomic
  ADR-055 (W-85 decrement_stock primitive · W-59 next 14.2.25 · W-61 npm 0 critical) ·
  T06 cart deploy-lag fix (regression T03b stale mcp). **W-ID đóng:** W-58/59/60/62/63/66/
  67/85/94/104 ✅ · #31/ADR-047-gap ✅ · W-61 🟡. **2 risk-acceptance (Human 2026-06-13):**
  W-104 keys lộ→rotate C8 · CSP report-only (gate cấm enforce thiếu Plan). **Nợ đẩy:**
  W-61 npm residual→C8 · pip langgraph (4 CVE)→C7 · seed customer password→W-75 · deploy-
  drift gate→C2(W-76). **Risk còn:** cart=customer 0-membership isolation ở MCP; AI/MCP
  egress chưa allowlist (C8); resume path chưa load-shed (C3-RT).

- **2026-06-12 · S-P0-01/T03e** (`1406903`): Per-intent membership policy (ADR-050)
  — IntentPolicyGuard thay TenantMembershipGuard tại POST /intent + /:rid/action;
  classify (modality,hint) mirror dispatch main.py:326-398 → membership {01 import,
  07 analyzing} / customer {02 buy,03 search,04 recommend,05 cart} + default-deny
  tuple lạ; membership_required lưu intent:cache VALUE lúc POST, action enforce sau
  ownership; assertOwnership tách membership (customer 0-membership truy cập rid của
  chính họ). Divergence (text,'analyze')→403 fail-closed (ADR-050 amend §3). RECON:
  FE intent/06 placeholder không qua POST /intent → payment ngoài matrix OK. Nợ e2e
  customer storefront live → T05.
- **2026-06-12 · S-P0-01/T04** (`8e4f066`): Vespa + analytics tenant scope —
  product.sd +tenant_id, 4 query tool ép inject_tenant_filter + index ghi tenant,
  matview filter app-level, backfill CLI PARTIAL-UPDATE (ADR-036), NN
  approximate:false (Sx09-F guard); ADR-040 amend MIGRATE role scope; nợ live
  verify (0-row/matview/backfill) → T05.
- **2026-06-12 · S-P0-01/T02c** (`937378e`, `a76c0aa`): Gateway→MCP tenant
  propagation — helper buildMcpIdentityHeaders 1 nơi, áp cả mcp.client lẫn
  cart.service raw-fetch; params user_id giữ song song (xoá T03); smoke live
  xác nhận 2 header trên wire. Phát sinh: BACKLOG #32 nâng mức — docker build
  CÓ cache vẫn ship dist stale (nest build emit no-op) → #32 = tiền-điều-kiện
  cứng của T03.
- **2026-06-10 · S-META-02/T01** (`632b9e8`): tách `docs/legacy/DECISIONS.md` thành
  39 file ADR riêng tại `docs/decisions/` + INDEX.md; gỡ 7 dòng "Trạng thái triển khai
  (verified...)" khỏi ADR-002/006/040/041/042/043/044 (Single Home); mv file gốc sang
  `docs/archive-v1/`.
- **2026-06-10 · META R0.1** (`de5c40f`, `c920998`, `54b1061`, `972f866`, `ea3dc4a`):
  `scripts/gen-facts.sh` v2 (DB live + frontend section) · CLAUDE.md root ·
  `.github/workflows/guards.yml` (facts-drift + commit-lint) · nhập bộ docs cũ vào repo.

---

**END.** Single Home — status không sống ở ADR (CLAUDE.md §9). Mỗi đóng slice phải
chạy `bash scripts/gen-facts.sh` rồi sync `MASTER_BACKLOG.md` §2 (status) + §4 (done).
