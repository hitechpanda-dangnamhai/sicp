# Master Slice Backlog — ICP (Production)

> **Version:** 2.0 (production re-cast). **Supersedes** hackathon Step-2 backlog v1.x–v2.7 (Phiên Sx04..Sx08 changelog).
> **Date:** 2026-06-09
> **Status:** ⭐ ACTIVE
> **Source of truth:** query DB + source code (live) > 14 canonical. Slice status **đối chiếu trực tiếp code 2026-06-09** (6 graph + controllers + DB).
>
> **Mục đích:** Backlog công việc cấp slice, map **slice → phase → intent** + trạng thái thật (DONE / CHƯA CODE / TÙY CHỌN) + **Production work backlog** (việc còn lại cho go-live). Đồng bộ với `phases/PHASE_0X_*.md` + `MASTER_ROADMAP.md`.
>
> **Lineage:** Hackathon → Production (ADR-037). Cruft hackathon (effort theo ngày, Phiên Sx0X, D-S0X-NN/C-S0X-NN, demo/pitch) đã loại. Slice ID giữ làm tham chiếu lịch sử; **đơn vị thật giờ = Phase + Production work item**.

---

## Legend
✅ DONE (verified code/DB) · 🟡 CHƯA CODE (spec/cam kết) · 🔵 TÙY CHỌN (chưa cam kết). Ưu tiên: P0/P1/P2.

> ⚠️ **Nhiều status backlog cũ STALE.** Doc cũ ghi S-04/S-05/S-09 = IN_PROGRESS, S-10 = TODO; nhưng **code đã verify** các graph (searching/cart/recommend/analyzing_by_voices) tồn tại & chạy → thực tế **DONE**. Chuẩn = code.

---

## Slice → Phase → Intent → Status (verified 2026-06-09)

| Slice | Tên | Phase | Intent | Status thật | Evidence |
|---|---|---|---|---|---|
| S-00 | Repo Reality Check | — | — | ✅ DONE | audit one-time |
| S-00b | Foundation Scaffold | 01 | — | ✅ DONE | monorepo + 2 compose + V001..V010 + Vespa schema + CI |
| S-01 | UI Foundation | 00 | — | ✅ DONE | `components/{ui,icp}` (atoms/molecules/organisms/layout) |
| S-02 | Runtime Foundation | 01 | — | ✅ DONE | OTel + codegen + idempotency + tracker + router |
| S-03 | Auth + Home Dashboard | 02 | 08 | ✅ DONE | auth controller 5 route + dashboard controller |
| S-04 | Product Discovery | 02 | 03 | ✅ **DONE** *(cũ IN_PROGRESS)* | `searching_by_text.py` + vespa.hybrid_search |
| S-05 | Cart/Order | 04 | 05 | ✅ **DONE** *(cũ IN_PROGRESS)* | `cart_by_text.py` + cart controller 7 route |
| S-06 | Payment | 04 | 06 | 🟡 **CHƯA CODE** | không orders/payment controller (ADR-038 VNPay/Momo/ZaloPay) |
| S-07 | Image AI Import | 03 | 01 | ✅ DONE | `importing_by_images.py` + cards pipeline |
| S-08 | Voice Buy | 04 | 02 | ✅ DONE *(TTS FE deferred)* | `buying_by_voices.py` + speech.transcribe |
| S-09 | Recommendation | 05 | 04 | ✅ **DONE** *(cũ IN_PROGRESS)* | `recommend_by_images.py` + image_nearest_neighbor |
| S-10 | Analytics Voice | 05 | 07 | ✅ **DONE** *(cũ TODO)* | `analyzing_by_voices.py` + analytics 10 tool + 3 matview |
| S-11 | Hardening *(was Demo)* | 06 | — | 🟡 CHƯA CODE | production hardening (xem dưới) |

> 8/8 intent UI/graph DONE; chỉ **Intent 06 payment = CHƯA CODE**. Phần còn lại = production hardening (workers, Kafka, multi-tenant, GDPR, audit, LTR, usage, alerting, DR).

---

## Production work backlog (việc còn lại — consolidated)

> Đây là backlog production thật (thay slice hackathon). Mỗi item = nhãn + ưu tiên + cross-ref phase/ADR.

### P0 — bắt buộc trước go-live

| Item | Phase / ADR | Mô tả + nên dùng gì |
|---|---|---|
| **Payment VNPay/Momo/ZaloPay (Intent 06)** | 04 / ADR-038 | orders/payments controller + `/orders/checkout` idempotent + init/callback/IPN/refund; online momo/zalopay/vnpay + offline cod/bank_transfer; verify IPN signature; dedup_key; no-log payload; **V011 ALTER chk_payment_method +vnpay (DB thiếu)** |
| **payment_callbacks + refund + V011** | 04 / ADR-038 | bảng payment_callbacks (1 txn↔N) + status `refunded`; migration V011 |
| **Multi-tenant (RLS, tenant_id)** | 01/02/03/04/05 / ADR-040 | tenants + tenant_memberships + `tenant_id` 10 bảng; X-Tenant-Id + JWT claim → TenantContextGuard → RLS GUC; scope mọi query; isolation test |
| **GDPR consent/DSAR + retention** | 02/07 / ADR-041 | consent_records + data_subject_requests + data_retention_policies; gate tracking theo consent; access/erasure |
| **Auth hardening** | 02 | rate-limit/lockout (`@nestjs/throttler`+Redis); refresh reuse-detection; CORS allowlist + helmet/CSP/HSTS |
| **DR / backup / PITR** | 01/06 | pg_dump + WAL-G; restore runbook; Vespa/Redis snapshot |
| **Grafana Alerting + SLO** | 06 | alert p95/error-rate/payment/aggregator; Grafana Alerting + Prometheus rules |
| **File upload validate** | 03 | MIME + size + reject oversize trước analyze |
| **Tenant-scoped analytics matview** | 05 | matview +tenant_id GROUP BY |

### P1 — nên có

| Item | Phase / ADR | Mô tả |
|---|---|---|
| **Kafka wire + outbox-relay worker + DLQ** | 01/03/04 | KafkaJS topic `icp.*`; relay events `published_at=NULL`; trace propagation headers |
| **8 worker canonical** | 01/03/04/05 | payment/inventory/notification/behavior-aggregator/card-generator/outbox/audit-logger/shopee-crawl |
| **Shopee crawler thật** | 03 / ADR-039 | worker shopee-crawl → `shopee_prices` (ToS risk) |
| **Hash-chain audit** | 06 / ADR-042 | `audit_log` immutable + worker audit-logger (per-tenant chain) |
| **Circuit breaker + retry** | 03/04/05 | call ngoài VNPay/Momo/ZaloPay, Vespa, Gemini/OpenAI, Shopee |
| **Matview refresh job** | 05 | cron REFRESH CONCURRENTLY 3 matview |
| **products CRUD GET/POST/DELETE** | 03 | hiện chỉ PATCH :id |
| **CI gate nâng cao** | 01/06 | lint --max-warnings 0 + tsc + openapi:sync drift + coverage threshold |
| **Load test (k6) + runbook/on-call** | 06 | verify SLO |
| **Secrets vault + graceful shutdown** | 01/06 | rotate JWT/API keys; SIGTERM drain |
| **Regex-PII redactor** | 06 | bổ sung Pino path-redact |
| **A11y audit** | 00/06 | reduced-motion + contrast WCAG AA + aria |
| **Redis HA** | 02 | Sentinel/Cluster (RedisSaver + pub/sub SPOF) |

### P2 / TÙY CHỌN — khi scale / optimization

| Item | Phase / ADR | Nhãn |
|---|---|---|
| **Per-tenant LTR `personalized`** | 05/02 / ADR-043 | 🟡 CHƯA CODE — tenant_ranking_weights + Vespa profile personalized |
| **Usage metering (billing SaaS)** | 06 / ADR-044 | 🟡 CHƯA CODE — usage_events + usage_daily |
| **co_purchase_matrix precompute** | 05 | 🔵 TÙY CHỌN — matview khi on-the-fly chậm (reader=co_purchased) |
| **TTS FE audio playback** | 04/05 | 🔵 TÙY CHỌN — wire speech.synthesize → FE |
| **gtrends real API / Image CDN / dark mode / i18n / token contract test** | 00/03 | 🔵 TÙY CHỌN |

---

## Cross-phase dependency (production)

```
Phase 00 (UI) ─┐
Phase 01 (Infra)─┼─► Phase 02 (Auth+Search) ─► Phase 03 (Import) ─┐
                 │                              Phase 05 (Reco+Analytics)
                 └─────────────────────────────► Phase 04 (Cart+Buy+Pay) ─┘
                                                          ↓
                                                 Phase 06 (Obs/Ops/Hardening) ─► GO-LIVE
```

Critical path go-live (P0): Payment (Intent 06) + Multi-tenant + GDPR + Auth hardening + DR + Alerting.

---

## Priority summary

| Ưu tiên | Số item | Trọng tâm |
|---|---|---|
| **P0** | 9 | payment, multi-tenant, GDPR, auth hardening, DR, alerting |
| **P1** | 13 | Kafka/workers, audit, shopee crawler, breaker, CI, load test |
| **P2/TÙY CHỌN** | ~9 | LTR, usage metering, co_purchase_matrix, CDN, i18n |

---

## What's NOT in this backlog

- Sub-tasks chi tiết per item → `slices/` tasklist (nếu duy trì).
- Day-by-day estimate, pitch/demo (đã loại — production).

---

**END OF MASTER SLICE BACKLOG (Production v2.0).**
**Generated:** 2026-06-09 · evidence-based, đối chiếu trực tiếp code/DB. Đồng bộ `MASTER_ROADMAP.md` + `phases/PHASE_0X_*.md`.
