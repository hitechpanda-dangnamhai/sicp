# ICP — Tổng hợp RECON Audit (đọc-only)

> Ngày: 2026-06-13 · Repo: `/home/hai-dang/projects/icpp/sicp` (branch `main`)
> Gộp 3 phiên: **S-SCALE-AUDIT** (22 verdict) + **S-WEAKNESS-100** (W-23→W-84) + **S-BLINDSPOT** (W-85→W-105)
> Tổng: **105 mục inventory**. Severity: **P0**=thủng/sập prod ngay · **P1**=chặn scale/tăng trưởng · **P2**=nợ chất lượng.
> Verdict: GIỮ / REFACTOR / REBUILD / XÂY-MỚI.

**Lưu ý đính chính đã verify trong audit:**
- Checkpoint TTL `default_ttl:30` = **30 PHÚT** (langgraph-checkpoint-redis dùng đơn vị phút; comment `main.py:123` xác nhận) → **khớp ADR-048, KHÔNG phải bug** (2 sub-agent đọc nhầm = 30s → P0 giả đã loại).
- `.env` chứa key Gemini/OpenAI thật nhưng **gitignored + KHÔNG tracked trong git** (`git ls-files` = NOT-TRACKED) → **KHÔNG phải git-leak** (P1 hardening, nên rotate vì đã lộ trong audit output).

---

## PHẦN A — S-SCALE-AUDIT (22 verdict gốc)

| # | Vùng | Verdict | Lý do |
|---|------|---------|-------|
| 1 | AI runtime (`flask run`, no gunicorn) | REFACTOR | Dev server single-process — đổi gunicorn/uvicorn (`apps/ai/Dockerfile:71`) |
| 2 | AI statelessness | GIỮ | Redis checkpoint, scale ngang được (`main.py:254-257`) |
| 3 | MCP no-pool Postgres | REFACTOR | connect/tool-call → cạn FD khi QPS cao (`mcp/src/db.py:111`) |
| 4 | Redis SPOF | REFACTOR | 7 vai trò 1 instance, no HA → mất = idempotency+SSE chết (`docker-compose.yml:99`) |
| 5 | Gateway SSE proxy | GIỮ | manual write + cleanup tốt; thêm cap concurrent (`intent.controller.ts:247-347`) |
| 6 | Index tenant_id | REFACTOR | chỉ single-col, thiếu composite cho query nóng (`V011:137-138`) |
| 7 | Partition `events` | REFACTOR | events unbounded; behavior_events OK (`V001:141-154`) |
| 8 | Vespa deployment | REFACTOR→REBUILD | single-node redundancy=1, mất node mất data (`services.xml:81,85,90`) |
| 9 | Connection pooling | GIỮ | max 10/gateway đủ tới ~3 instance (`pg-pool.provider.ts:56`) |
| 10 | Async backbone (Kafka) | REBUILD | chưa wire, workers skeleton (`app.module.ts:20`) |
| 11 | Inline-blocking work | REFACTOR | Vespa/LLM/cards loop chặn request (`importing_by_images.py:752,1014`) |
| 12 | Outbox relay | REBUILD | write có, relay chết, no index published_at (`events.py:99`) |
| 13 | Test coverage | REFACTOR | AI 5%, gateway 22%, no gate |
| 14 | Clean-arch | GIỮ | 0 vi phạm domain→infra |
| 15 | External resilience | REFACTOR | timeout có, retry/CB thiếu, Postgres no-timeout |
| 16 | Idempotency-before-auth (#31) | REBUILD | cache serve pre-auth, scope header chưa verify (`idempotency.middleware.ts:115-117`) |
| 17 | Tenant-from-header | REBUILD | `x-tenant-id` raw, validate 50 dòng sau |
| 18 | AI/MCP header-trust (ADR-047) | REFACTOR | isolation chỉ trên giấy, port expose host |
| 19 | Prod orchestration | REBUILD | chỉ compose dev, no k8s/helm/tf |
| 20 | Zero-downtime deploy | REFACTOR | SIGTERM có, no rolling/LB |
| 21 | Migration-on-deploy | REFACTOR | apply.sh tốt nhưng chạy tay |
| 22 | (Vespa HA — gộp #8) | — | — |

**Tally A:** GIỮ ×5 · REFACTOR ×12 · REBUILD ×5.

---

## PHẦN B — S-WEAKNESS-100 (W-23 → W-84)

### D1 — AI / LangGraph
| ID | Finding | path:line | Sev | Verdict |
|---|---|---|---|---|
| W-23 | Trùng lặp ~320 LoC (co_purchase_lookup×3, _node_final×5, load/save_voice_context×2) | `searching_by_text.py:744-826` | P2 | REFACTOR |
| W-24 | Linear/conditional DAG mỗi intent, KHÔNG evidence-loop ReAct | `graphs/intents/*` | P1 | REFACTOR |
| W-25 | KHÔNG tool-RAG; mỗi node hardcode tool MCP (37 tool, LLM no agency) | `searching_by_text.py:461` | P1 | REFACTOR |
| W-26 | KHÔNG budget-guard/circuit-breaker/max-iter graph-level | `searching_by_text.py:581` | P1 | REFACTOR |
| W-27 | Confidence = LLM tự khai + threshold, không deterministic 5-factor | `searching_by_text.py:174` | P2 | GIỮ |
| W-28 | KHÔNG post-evidence reflection (chỉ pre-flight detect_typo) | `searching_by_text.py:150` | P1 | REFACTOR |
| W-29 | KHÔNG goal-stack / đổi goal giữa chừng | `graphs/intents/*` | P1 | GIỮ(scope) |
| W-30 | Synthesize monolithic (không tách gather→filter→compose) | `generate_reasons` node | P2 | GIỮ |
| W-31 | KHÔNG per-tool fallback chain | `llm_client.py:396` | P1 | REFACTOR |
| W-32 | KHÔNG eval harness/golden dataset/regression gate CI (1 test/20 file) | `apps/ai/tests/` | P1 | XÂY-MỚI |
| W-33 | Model routing có lite/default ✓ nhưng KHÔNG prompt-cache/semantic-cache/per-tenant cost | `llm_client.py:64` | P1 | REFACTOR |
| W-34 | Per-tool authz: header identity inject nhưng KHÔNG enforce node-side | `mcp_client.py:87` | P2 | REFACTOR |
| W-35 | KHÔNG context compaction/per-node budget — voice_history+dict inject nguyên | `buying_by_voices.py:393` | P1 | REFACTOR |
| W-36 | Prompt tách .txt nhưng KHÔNG version | `apps/ai/src/prompts/` | P2 | REFACTOR |
| W-37 | KHÔNG prompt regression test | `apps/ai/tests/` | P1 | XÂY-MỚI |
| W-38 | LLM output = `json.loads` string, KHÔNG Pydantic validate | `llm_client.py:208,248` | P1 | REFACTOR |
| W-39 | Timeout comment ≠ code (detect_typo 3s/doc 5s; reasons 15s/doc 10s) | `searching_by_text.py:164,527` | P2 | REFACTOR |
| W-40 | KHÔNG log token/cost (usage_metadata không đọc) | `llm_client.py` | P1 | XÂY-MỚI |
| W-41 | Classifier fail-open (modality lạ → default search) | `main.py:397` | P2 | GIỮ |
| W-42 | `image_b64`(~2.7MB)+`voice_audio_b64`(~1.3MB) trong checkpoint state → serialize nặng | `state.py:243,289` | P1 | REFACTOR |
| W-43 | Resume double-submit: Gateway có SETNX, AI in-process KHÔNG khoá | `main.py:469-607` | P2 | GIỮ |

> **Đính chính:** checkpoint TTL = 30 phút khớp ADR-048 → **NO FINDING** (không phải P0 như 2 agent báo).

### D2 — API & Contract
| W-44 | KHÔNG global exception filter — envelope thủ công, uncaught lệch shape/thiếu request_id | `main.ts`,`app.module.ts` | P1 | REFACTOR |
| W-45 | KHÔNG pagination chuẩn (chỉ `cards.list`, limit-only) | `cards.controller.ts:74-87` | P2 | REFACTOR |
| W-46 | KHÔNG CI gate openapi.json drift (CLAUDE.md nói có; `guards.yml` thiếu) | `.github/workflows/guards.yml` | P1 | XÂY-MỚI |

### D3 — FE Performance
| W-47 | Raw `<img>` + base64 inline, KHÔNG next/image | `Avatar.tsx:103`,`UserImageBubble.tsx:72` | P2 | REFACTOR |
| W-48 | Optimistic update một phần (chỉ cart qty) | `forgot-password/page.tsx:68` | P2 | GIỮ |
| W-49 | SSE KHÔNG resume-from-last-event-id | `sse-client.ts:60` | P2 | GIỮ |

### D4 — Data Model & Query
| W-50 | FK ON DELETE không nhất quán/không document | `V001:117,178,199,217` | P2 | REFACTOR |
| W-51 | THIẾU `idx_sessions_user_id` → seq-scan mỗi auth lookup | `postgres-session.repo.ts:173` | P1 | REFACTOR |
| W-52 | `trend_score REAL` (float) không document precision — non-money OK | `V001:126` | P2 | GIỮ |

### D5 — Caching
| W-53 | Intent-metadata cache no single-flight khi TTL hết (negligible — Redis-only) | `intent.service.ts:174` | P2 | GIỮ |

### D6 — Observability
| W-54 | Trace AI→MCP extraction chưa verify (chỉ auto-instrument) → trace có thể đứt | `mcp/src/server.py` | P1 | REFACTOR |
| W-55 | KHÔNG OTel metric cost/token LLM | `llm_client.py` | P1 | XÂY-MỚI |
| W-56 | SLO trên giấy, KHÔNG đo/alert | `MASTER_BACKLOG.md:7` | P1 | XÂY-MỚI |
| W-57 | PII (email/phone/name) KHÔNG trong redact (chỉ secret) — #21 | `logger.ts:98` | P2 | REFACTOR |

### D7 — Security (ngoài #31, ADR-047)
| W-58 | KHÔNG global ValidationPipe → MỌI createZodDto không enforce runtime | `intent-suggest-attrs.controller.ts:140` | **P0** | REBUILD |
| W-59 | `next@14.2.18` CVE CRITICAL auth-bypass (GHSA-f82v-jwr5-mffw) | `apps/web/package.json` | **P0** | REFACTOR(bump) |
| W-60 | KHÔNG rate-limit — login/forgot-password mở brute-force | `auth.controller.ts:95` | **P0** | XÂY-MỚI |
| W-61 | 17 high + 24 moderate npm CVE; pip-audit chưa chạy | `pnpm audit` | P1 | REFACTOR |
| W-62 | KHÔNG helmet/CSP/HSTS/X-Frame-Options | `main.ts:115` | P1 | XÂY-MỚI |
| W-63 | Upload MIME size-only, KHÔNG magic-byte (#8) | `intent-request.dto.ts:57` | P1 | REFACTOR |
| W-64 | JWT 1 secret, KHÔNG kid — rotation = mass logout | `jwt.helper.ts:60` | P1 | REFACTOR |
| W-65 | `vitest` dev-only critical CVE | `apps/gateway` | P2 | REFACTOR |

### D8 — Workers & Jobs thiếu
| W-66 | ⏰ behavior_events partition CHỈ tới 2026-08-01 — INSERT FAIL sau đó (TIME-BOMB) | `V001:285-290` | **P0** | XÂY-MỚI |
| W-67 | KHÔNG job refresh matview (fn có, no caller) → analytics stale mãi | `V006:127` | P1 | XÂY-MỚI |
| W-68 | Outbox relay/sweeper chết — `events.published_at=NULL` không drain | `apps/workers/src/index.ts` | P1 | XÂY-MỚI |
| W-69 | KHÔNG backup/backup-verify/DR | `infra/` | P1 | XÂY-MỚI |
| W-70 | KHÔNG DLQ/failed-job retry | `apps/workers` | P1 | XÂY-MỚI |
| W-71 | KHÔNG purge DB sessions (expires_at phình) | sessions table | P2 | XÂY-MỚI |
| W-72 | KHÔNG log rotation (compose thiếu max-size) | `docker-compose.yml` | P2 | REFACTOR |
| W-73 | KHÔNG stuck-intent/checkpoint reaper | `apps/ai` | P2 | GIỮ |
| W-74 | KHÔNG metric rollup/downsample | `infra/otel/prometheus.yml` | P2 | REFACTOR |

### D9 — Testing & CI
| W-75 | E2E chỉ 2-3/8 intent (I01/02/03/04/07 trống) | `apps/web/e2e/` | P1 | XÂY-MỚI |
| W-76 | CI lint/test/typecheck SOFT-FAIL (`\|\| echo`), no coverage gate, E2E không gate | `.github/workflows/ci.yml:54,68,82` | P1 | REFACTOR |
| W-77 | KHÔNG load test (k6/artillery/locust) | — | P1 | XÂY-MỚI |
| W-78 | KHÔNG failure-injection test (MOCK_LLM_TIMEOUT có, không dùng) | `llm_client.py:41` | P2 | XÂY-MỚI |
| W-79 | KHÔNG migration rollback test | `infra/migrations/` | P2 | XÂY-MỚI |
| W-80 | Seed 1 tenant, KHÔNG fixture multi-tenant isolation | `infra/seed/` | P2 | REFACTOR |
| W-81 | KHÔNG contract test FE↔BE generated client | — | P2 | XÂY-MỚI |

### D10 — Docs/Workflow drift
| W-82 | `gen-facts.sh` miss prompts + cache-topology + jobs | `scripts/gen-facts.sh` | P2 | REFACTOR |
| W-83 | ADR-013 real-time Vespa partial-update chưa implement — code batch-only | `ADR-013:5-6` | P2 | REFACTOR |
| W-84 | ADR-025 cite `09_FIELD_AUDIT.md` không kèm path archive (mơ hồ) | `ADR-025:2` | P2 | REFACTOR |

**Tally B (W-23→84, 62 finding):** P0 ×4 · P1 ×30 · P2 ×28.
**4 P0:** W-58 (DTO không enforce) · W-59 (Next.js CVE) · W-60 (no rate-limit) · W-66 (partition time-bomb).

---

## PHẦN C — S-BLINDSPOT (W-85 → W-105)

### B1 — DB Contention
| W-85 | Oversell: validate_stock SELECT-only, no FOR UPDATE, no atomic UPDATE; TOCTOU; SETNX best-effort | `cart.py:335-339` | **P1** (→P0 khi S-06 checkout ship) | REFACTOR |
| W-86 | No deadlock-retry; isolation default READ COMMITTED; no lock/statement_timeout | `db.py:90-116`,`pg-pool.provider.ts:58` | P2 | REFACTOR |
| W-87 | Mọi CREATE INDEX non-CONCURRENTLY (OK deploy; khoá bảng nếu add index live) | `infra/migrations/V*.sql` | P2 | GIỮ→REFACTOR |

### B2 — Cache Tiers thiếu
| W-88 | GET read-heavy (cards/dashboard/cart/public/products) hit MCP→PG mỗi request, no cache-aside | `cards.controller.ts:65`,`dashboard.controller.ts:67`,`public.controller.ts:41` | P1 | XÂY-MỚI |
| W-89 | KHÔNG ETag/Cache-Control/Last-Modified trên data endpoint | gateway controllers | P2 | REFACTOR |
| W-90 | Ảnh base64 inline trong Postgres — no object store + no CDN (one-way door) | `V010 image_data`,`products.py:26` | P1 | REBUILD |
| W-91 | Vespa search no cache result (query trùng vẫn hit fresh) | `vespa.py:43-150` | P2 | REFACTOR |

### B3 — LLM Independence
| W-92 | parse_voice_intent + reason_need là classification/extraction nhưng vẫn dùng DEFAULT (lite-able) | `buying_by_voices.py:643,1472` | P2 | REFACTOR |
| W-93 | KHÔNG lưu durable LLM input/output/score → không dataset fine-tune | `llm_client.py` | P1 | XÂY-MỚI |

### B4 — Backpressure
| W-94 | AI Flask spawn 1 daemon-thread/request KHÔNG giới hạn → cạn OS thread khi tải (sập ĐẦU TIÊN) | `main.py:465` | **P1** ⚠️ | REFACTOR |
| W-95 | KHÔNG queue/bounded-pool giữa service; AI→MCP tạo McpClient mới mỗi call | `mcp_client.py:83`,`searching_by_text.py:458` | P1 | REFACTOR |
| W-96 | KHÔNG cancellation propagation: SSE disconnect → graph vẫn chạy hết, đốt quota | `main.py` | P1 | REFACTOR |
| W-97 | KHÔNG load-shed 503/429 trên intent path → overload cascade | `gateway/intent`+`ai/main.py` | P1 | XÂY-MỚI |

### B5 — Tenant depth
| W-98 | T05 chưa start — gánh nợ e2e 2-tenant/SSE-live/storefront/matview-live verify | `MASTER_BACKLOG.md:55`,`S-P0-01.md:309` | P1 | GIỮ(tracked) |
| W-99 | Per-tenant quota = 0 → 1 tenant vắt kiệt tài nguyên chung | — | P1 | XÂY-MỚI |
| W-100 | KHÔNG tenant lifecycle/offboarding/GDPR-delete (ADR-041 + Luật BVDLCN 2025) | `ADR-041` | P1 | XÂY-MỚI |

### B6 — FE Serving
| W-101 | Toàn bộ route dynamic 'use client', no ISR/SSG cho landing/storefront | `next.config.js:37`,`app/page.tsx:59` | P1 | REFACTOR |
| W-102 | `_next/static` Node serve (no CDN/assetPrefix) — nghẽn RPS/replica khi tải | `next.config.js` | P2 | REFACTOR |

### B7 — Security Depth
| W-103 | KHÔNG mTLS; service plaintext HTTP; MỌI port infra expose host; compose thiếu internal:true; OTel tls.insecure | `docker-compose.yml:181-308`,`collector-config.yaml:42` | P1 | REFACTOR |
| W-104 | Key Gemini+OpenAI thật trong .env plaintext, inject 4 container, no secret manager (VERIFY: gitignored+không tracked → không git-leak; nên rotate) | `.env:41-42` | P1 | REFACTOR |
| W-105 | KHÔNG WAF/reverse-proxy trước Gateway | `infra/` | P2 | XÂY-MỚI |

**Tally C (W-85→105, 21 finding):** P0 ×0 · P1 ×14 · P2 ×7.
**2 latent-P0:** W-85 (oversell khi checkout ship) · W-94 (thread-exhaustion khi tải thật).

---

## ✅ NO FINDING (đã kiểm, sạch) — tổng hợp

- **AI:** state schema dùng chung `IcpState` · memory 3-tier · parallel Task-DAG · fallback Gemini→OpenAI đúng spec · classifier rule-based · **checkpoint TTL 30 phút khớp ADR-048** · provider abstraction 1 điểm swap · CLIP embeddings self-host $0 · no external I/O trong DB txn.
- **Data:** no N+1 · JSONB chỉ display/search có GIN · enum DB↔Zod khớp · hard-delete chủ ý · TIMESTAMPTZ khắp nơi · **money = BIGINT (no float)** · SET LOCAL txn-scoped (no pool leak) · 5 bảng không tenant_id đều chủ ý+documented.
- **Caching:** session invalidation explicit · mọi TTL hợp lý · idempotency SETNX atomic · error không cache.
- **API/FE:** versioning v1 chủ ý · error message sanitize không leak stack/SQL · bundle gọn · no render-waterfall · EventSource cleanup on unmount · next standalone stateless scale-ngang.
- **Security:** SSRF — outbound dùng env URL nội bộ · không secret hardcode trong repo · redaction log cấu hình đúng.
- **Docs:** ADR-017/019/012/040 honor đúng · phần lớn cite archive-v1 là chủ ý lineage.

---

## ⭐ INSIGHTS — điều Plan dễ bỏ sót

1. **Mọi DTO Zod ở Gateway đang là TRANG TRÍ** (W-58: no ValidationPipe). Cộng W-60 (no rate-limit) + W-63 (upload MIME) + #31 + ADR-047 = toàn bộ biên input/auth Gateway yếu hơn vẻ ngoài code. Cụm P0 thật.
2. **W-66 là finding DUY NHẤT có deadline lịch cứng (2026-08-01).** Mọi thứ khác degrade; cái này HARD-FAIL `POST /track`. Fix rẻ (cron/pg_partman) — phải nhảy hàng đợi.
3. **Async backbone gap làm payment SAI, không chỉ "scale".** W-44 (no exception filter) + W-68 (outbox chết) + W-70 (no DLQ): charge fail không chỗ retry, event mất, lỗi leak. Phải có TRƯỚC S-05 payment.
4. **Test safety-net là ẢO đúng chỗ rủi ro nhất.** W-76 (CI soft-fail) + AI 1 test/20 file + E2E 2/8 + no load/chaos/rollback. Cộng W-23 (320 LoC trùng) + W-37: refactor graph AI gần như không guardrail.
5. **2 quả bom nguy hiểm nhất đều LATENT:** W-85 oversell vô hại hôm nay chỉ vì checkout chưa có (ship vỡ nếu không atomic NGAY); W-94 thread-per-request sập khi tải thật. "Xanh nhưng là mìn" — fix lúc thiết kế, trước load-test.
6. **Ảnh base64 (W-90) = cửa một chiều cộng dồn mọi tầng:** phình DB, chặn CDN, thổi payload, vô hiệu image-opt FE, Postgres thành image server. Đòn bẩy cao nhất cho tải — làm sớm, càng để càng đắt.
7. **Tin tốt:** provider-independence ĐÃ xuất sắc (1 điểm swap LLM + CLIP self-host $0). Đòn bẩy giảm-cost gần như sẵn sàng — chỉ thiếu durable trace (W-93) + route 2 task sang lite (W-92), đều rẻ.

---

## TỔNG ĐẾM TOÀN CỤC

| Phiên | Mục | P0 | P1 | P2 | Ghi chú |
|---|---|---|---|---|---|
| S-SCALE-AUDIT | 22 | — | — | — | GIỮ×5 REFACTOR×12 REBUILD×5 |
| S-WEAKNESS (W-23→84) | 62 | 4 | 30 | 28 | |
| S-BLINDSPOT (W-85→105) | 21 | 0 | 14 | 7 | +2 latent-P0 |
| **TỔNG** | **105** | **4 (+cụm REBUILD security)** | **44** | **35** | |

**4 P0 cứng:** W-58 · W-59 · W-60 · W-66.
**Latent-P0:** W-85 (oversell-khi-checkout) · W-94 (thread-exhaustion-khi-tải).

### Thứ tự thực thi đề xuất
1. **W-66** — partition time-bomb 2026-08-01 (deadline cứng, fix rẻ).
2. **Cụm Gateway-perimeter** — W-58 / W-59 / W-60 + #31 + ADR-047.
3. **Thiết kế-atomic W-85 + cap-thread W-94** — TRƯỚC khi load-test.
4. **W-90** — ảnh → object store (mở khoá mọi perf hạ nguồn).
5. **Outbox/DLQ (W-68/W-70)** — TRƯỚC S-05 payment.
6. **CI safety-net (W-76)** — TRƯỚC khi refactor AI (W-23/W-32/W-37).
7. **Vespa HA, prod orchestration (k8s), cache tiers** — chuẩn bị scale.

---
*Đọc-only RECON. Mỗi claim kèm path:line. Không sửa code trong các phiên này.*
