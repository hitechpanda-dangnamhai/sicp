# ICP Docs

> Bộ tài liệu nguồn cho dự án ICP. Đây là **source of truth** — code phải khớp docs, không ngược lại.

## Cấu trúc

```
docs/
├── 00_CONTEXT.md           ← Luôn paste vào đầu mọi conversation với AI
├── 01_ARCHITECTURE.md      ← Clean architecture, dependency rules
├── 02_DATA_MODEL.md        ← Postgres DDL, Vespa schema, Redis keys, Kafka topics
├── 03_API_CONTRACTS.md     ← REST endpoints, DTOs, SSE format, MCP tools
├── 04_INTENT_SPECS.md      ← Chi tiết 8 intents
├── 05_CODING_CONVENTIONS.md ← Style, testing, naming
├── 06_OBSERVABILITY.md     ← OpenTelemetry, ops logs, metrics, traces (Phase 01+)
├── 07_BEHAVIOR_LOGS.md     ← User events cho recommendation / Vespa learn-to-rank
├── 08_FE_BE_CONTRACT.md    ← OpenAPI codegen, type-safe FE↔BE workflow
├── LOG_CATALOG.md          ← Registry mọi log message + behavior event type (append-only)
├── DECISIONS.md            ← ADR log
└── phases/
    ├── PHASE_00_DESIGN_SYSTEM.md  ← Tokens, palette, component library
    ├── PHASE_01_INFRA.md
    ├── PHASE_02_AUTH_SEARCH.md
    ├── PHASE_03_IMPORT.md
    ├── PHASE_04_BUY_CART_PAY.md
    ├── PHASE_05_RECO_ANALYTICS.md
    ├── PHASE_06_POLISH.md
    └── *_HANDOFF.md         ← Sinh ra sau khi xong mỗi phase
```

## Workflow khi nhờ AI code

### Bước 1 — Trước khi mở conversation mới

Chọn phase đang làm. Chuẩn bị 3 files:
1. `00_CONTEXT.md` (luôn luôn)
2. `phases/PHASE_XX_<name>.md` (phase hiện tại)
3. Doc tham chiếu tuỳ task:
   - Code DB → kèm `02_DATA_MODEL.md`
   - Code API → kèm `03_API_CONTRACTS.md` + `08_FE_BE_CONTRACT.md`
   - Code intent graph → kèm `04_INTENT_SPECS.md`
   - Code module mới → kèm `01_ARCHITECTURE.md` + `05_CODING_CONVENTIONS.md`
   - Code logging/metrics/tracing → kèm `06_OBSERVABILITY.md` + `LOG_CATALOG.md`
   - Code tracker/aggregator/Vespa signals → kèm `07_BEHAVIOR_LOGS.md`
   - Code FE component → kèm `PHASE_00_DESIGN_SYSTEM.md` + `08_FE_BE_CONTRACT.md`
   - Code FE feature (API call, mutation) → kèm `08_FE_BE_CONTRACT.md`

Nếu phase trước đã có handoff:
4. `phases/PHASE_(XX-1)_HANDOFF.md`

### Bước 2 — Mẫu prompt mở đầu

```
Tôi đang code dự án ICP. Đây là context (paste docs vào đây):

<docs/00_CONTEXT.md>
...
</docs/00_CONTEXT.md>

<docs/phases/PHASE_03_IMPORT.md>
...
</docs/phases/PHASE_03_IMPORT.md>

Task hôm nay: implement use case CreateProductFromDraft trong NestJS gateway.
Đọc context trên, rồi xác nhận hiểu rồi mới code.
```

### Bước 3 — Trong khi code

- Khi AI đề xuất 1 quyết định kiến trúc mới → bạn paste vào `DECISIONS.md` (status Proposed), review, đổi sang Accepted nếu OK
- Khi schema/DTO/API thay đổi → update docs liên quan TRƯỚC khi code (docs-first)
- Code chỉ là output, không lưu trữ context dài hạn

### Bước 4 — Sau khi xong 1 phase

Yêu cầu AI tạo `PHASE_XX_HANDOFF.md` với template:

```markdown
# Phase XX — Handoff

## Đã làm được
- ...

## Module / file đã tạo
- apps/gateway/src/products/* → ...
- apps/ai/src/graphs/intents/importing_by_images.py → ...

## Public interfaces exposed (cho phase sau import)
- REST: POST /products
- MCP tool: products.create
- Event: ProductImported
- TypeScript types: ProductCreateDTO, Product

## Decisions thêm vào (đã ghi DECISIONS.md)
- ADR-011: ...

## Known issues / nợ kỹ thuật
- ...

## Phase sau (XX+1) cần lưu ý
- ...
```

Đây là "ngắn gọn nhưng đủ" context để phase sau biết cái gì đã có.

## Quy tắc cho AI khi đọc bộ doc này

1. **Đọc 00_CONTEXT trước** mọi thứ khác
2. **Khi conflict** giữa intuition và doc → theo doc
3. **Khi doc không cover** một quyết định → đề xuất, đợi human chốt, ghi DECISIONS
4. **Không tự sửa doc** trừ khi human yêu cầu rõ ràng
5. **Khi handoff phase** → tạo HANDOFF.md, đừng dồn vào CHANGELOG dài

## Limits & nâng cấp tương lai

- Hackathon scope không cover: monitoring, observability, multi-region, A/B
- Sau Hackathon nếu phát triển: cân nhắc OpenTelemetry, GraphQL gateway, micro-frontend
