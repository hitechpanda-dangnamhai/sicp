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
| S-META-02 | Hoà tan docs cũ | META | 🔄 | T01 ✅ · T02 ✅ · T03 ✅ · T04–T07 chờ · T08 chuẩn hoá tham chiếu (chạy cuối) chờ |
| S-AUDIT | Docs audit định kỳ (vĩnh viễn) | META | ∞ | — *(mỗi 10 slice/tháng)* |

## §3 Queue P0 → P1 → P2 (việc còn lại tới go-live)

### P0 — bắt buộc trước go-live (theo order tenant → payment → compliance)

| # | Item | ADR | Status | Ghi chú (từ verify) |
|---|---|---|---|---|
| 1 | Multi-tenant SaaS (RLS + tenant_id) | ADR-040 | 🟡 | `tenants`/`tenant_memberships` chưa có; 0 `tenant_id` DB+gateway; target V011 |
| 2 | Payment VNPay/Momo/ZaloPay (Intent 06) | ADR-038 | 🟡 | orders/payments controller + IPN signature + idempotent dedup_key + V011 ALTER `chk_payment_method +vnpay` |
| 3 | `payment_callbacks` + status `refunded` | ADR-038 | 🟡 | 1 txn ↔ N callback; V011 |
| 4 | GDPR/Luật BVDLCN 2025 consent + DSAR + retention | ADR-041 | 🟡 | `consent_records`/`data_subject_requests`/`data_retention_policies` chưa có; consent gate tracking; V011 |
| 5 | Auth hardening (rate-limit + refresh rotation + CORS/CSP) | — | 🟡 | `@nestjs/throttler`+Redis; reuse-detection trên `sessions.refresh_token_hash` UNIQUE (V009 đã có) |
| 6 | DR / backup / PITR | — | 🟡 | pg_dump + WAL-G + restore runbook; Vespa/Redis snapshot |
| 7 | Grafana Alerting + SLO/error-budget | — | 🟡 | thay "console-only"; alert p95/error-rate/payment/aggregator |
| 8 | File upload validate (MIME + size) | — | 🟡 | reject oversize trước Gemini vision |
| 9 | Tenant-scoped analytics matview | — | 🟡 | matview +`tenant_id` GROUP BY (sau S-tenant) |

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
| 18 | CI gate nâng cao | — | 🟡 | lint --max-warnings 0 + tsc + openapi:sync drift + coverage |
| 19 | Load test (k6) + runbook/on-call | — | 🟡 | verify SLO |
| 20 | Secrets vault + graceful shutdown | — | 🟡 | rotate JWT/API; SIGTERM drain |
| 21 | Regex-PII redactor (bổ sung Pino path-redact) | — | 🟡 | — |
| 22 | A11y audit (reduced-motion + WCAG AA + aria) | — | 🟡 | — |
| 23 | Redis HA (Sentinel/Cluster) | — | 🟡 | RedisSaver + pub/sub SPOF |

### P2 / TÙY CHỌN — khi scale

| # | Item | ADR | Status | Ghi chú |
|---|---|---|---|---|
| 24 | Per-tenant LTR `personalized` | ADR-043 | 🟡 | `tenant_ranking_weights` chưa có; `product.sd` 6 profile, KHÔNG có `personalized` |
| 25 | Usage metering (billing SaaS) | ADR-044 | 🟡 | `usage_events`/`usage_daily` chưa có |
| 26 | `co_purchase_matrix` precompute | — | 🔵 | reader=`analytics.co_purchased` (on-the-fly); chỉ khi chậm ở scale |
| 27 | TTS FE audio playback | — | 🔵 | wire `speech.synthesize` → FE |
| 28 | gtrends real API / Image CDN / dark mode / i18n / token contract test | — | 🔵 | — |

## §4 Done gần đây

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
