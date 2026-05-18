# ICP — Intelligent Commerce Platform

> Hackathon 2026 — Demo trợ lý AI cho chủ shop nhỏ: 1 màn hình, nhập hàng /
> mua / phân tích bằng voice + image + text.

**Status:** Foundation scaffold (S-00b). Stack chưa runnable end-to-end cho đến
khi slice S-00b hoàn tất tất cả 8 tasks (T01-T08). Hiện tại T01 = repo root
config files only.

---

## Quickstart

```bash
# 1. Setup env vars
cp .env.example .env
# Sửa .env với LLM API keys + secrets thật (KHÔNG commit .env)

# 2. Install workspace deps (sau khi T02 init shared-types + apps/workers)
pnpm install

# 3. Boot stack + load seed data (sau khi T07 + T08 tạo compose files)
make up && make seed

# 4. Mở UI placeholder
# http://localhost:3000     — Web (Next.js, "ICP loaded")
# http://localhost:3001     — Gateway (NestJS)
# http://localhost:3002     — Grafana (admin/admin)
```

Xem `make help` để liệt kê tất cả targets.

---

## Tech stack (LOCKED — xem `docs/00_CONTEXT.md` §2)

| Layer | Tech | Version |
|---|---|---|
| Frontend | Next.js + React | 14.2.x (App Router) |
| Styling | Tailwind CSS | 3.4.x |
| Component lib | shadcn (copy-paste) | latest |
| Animation | CSS keyframes + Framer Motion + canvas-confetti | — |
| State (client) | Zustand | v5 |
| State (server) | TanStack Query | v5 |
| API Gateway | NestJS | 10 |
| AI Service | Flask + LangGraph | Python 3.11 |
| LLM (multimodal) | Gemini 2.0 Flash | via `google-generativeai` |
| LLM (reasoning) | OpenAI GPT-4o-mini | via `langchain-openai` |
| Search | Vespa | 8.x |
| Embeddings | CLIP ViT-B/32 (512 dim) | per ADR-036 |
| Relational DB | PostgreSQL | 16-alpine |
| Cache | Redis | 7-alpine |
| Message bus | Kafka (Redpanda for dev) | latest |
| Observability | OTel Collector + Loki + Tempo + Prometheus + Grafana | LGTM stack |
| Package manager | pnpm | 9.15.0 (canonical) |
| Node runtime | Node | 20-alpine |

---

## Repo layout

```
icp/
├── docs/                       ← SOURCE OF TRUTH (read-only)
│   ├── 00_CONTEXT.md           ← anchor doc
│   ├── 01_ARCHITECTURE.md
│   ├── 02_DATA_MODEL.md
│   ├── 03_API_CONTRACTS.md
│   ├── 04_INTENT_SPECS.md
│   ├── 05_CODING_CONVENTIONS.md
│   ├── 06_OBSERVABILITY.md
│   ├── 07_BEHAVIOR_LOGS.md
│   ├── 08_FE_BE_CONTRACT.md
│   ├── 09_FIELD_AUDIT.md
│   ├── DECISIONS.md            ← ADR log
│   └── phases/                 ← PHASE_00..06 specs + handoffs
├── apps/
│   ├── web/                    ← Next.js 14         (init: T08)
│   ├── gateway/                ← NestJS 10          (stub: T03)
│   ├── ai/                     ← Flask + LangGraph  (stub: T03)
│   ├── mcp/                    ← MCP server Python  (stub: T03)
│   └── workers/                ← Kafka consumers    (stub: T02)
├── packages/
│   └── shared-types/           ← TS types dùng chung (scaffold: T02)
├── infra/
│   ├── docker-compose.yml                  ← app stack (T08)
│   ├── docker-compose.observability.yml    ← LGTM stack (T07)
│   ├── migrations/                         ← V001..V008 SQL (T04)
│   ├── seed/                               ← users/products/policies + seed.ts (T05)
│   ├── vespa/                              ← schemas/product.sd + services.xml (T06)
│   └── otel/                               ← collector + datasources (T07)
├── package.json                ← root orchestrator (this commit)
├── pnpm-workspace.yaml         ← workspaces declaration (this commit)
├── tsconfig.base.json          ← shared TS config (this commit)
├── .env.example                ← env template (this commit)
├── .gitignore                  ← (this commit)
├── .editorconfig               ← (this commit)
├── Makefile                    ← stack lifecycle (this commit)
└── README.md                   ← (this commit)
```

---

## Architectural decisions (ADRs)

Tất cả quyết định lớn ghi trong [`docs/DECISIONS.md`](docs/DECISIONS.md). 4 ADRs
trực tiếp ảnh hưởng foundation scaffold:

| ADR | Decision | Áp dụng |
|---|---|---|
| **ADR-033** | Component framework: **shadcn (copy-paste) + Tailwind CSS v3** | `apps/web` (T08) |
| **ADR-034** | Animation hybrid: CSS keyframes + Framer Motion (`framer-motion/m` lazy) + canvas-confetti | `apps/web` (T08+) |
| **ADR-035** | State mgmt: **Zustand** (cross-component) + **TanStack Query** (server) + **react-hook-form** (forms) + Context (low-freq) + useState (local) | `apps/web` (T08, populate trong S-01/S-02) |
| **ADR-036** | Image + text embeddings: **CLIP ViT-B/32 với 512 dim** | Vespa `product.sd` (T06). **Note:** Embeddings stored Vespa-only (C12 LOCKED Option B 2026-05-18) — KHÔNG có VECTOR columns trên Postgres products table. |

---

## Workflow & methodology

- **Workflow doc:** [`docs/workflow/ICP_WORKFLOW_FINAL.md`](docs/workflow/ICP_WORKFLOW_FINAL.md) — 10 Steps + 7 Rules
- **Operating system:** [`ai-delivery/TASK_OPERATING_SYSTEM.md`](ai-delivery/TASK_OPERATING_SYSTEM.md) — 7 Rules bất biến
- **Current slice:** [`slices/S-00b_BRIEF.md`](slices/S-00b_BRIEF.md) — Foundation Scaffold (8 tasks T01→T08)

Commit convention: [Conventional Commits](https://www.conventionalcommits.org/).
Branch: `main` + feature branches `feat/...`, `fix/...`, `docs/...`.

---

## Status — known gaps (sau T01)

T01 chỉ emit root config files. Stack chưa runnable end-to-end. Per
`slices/S-00b_TASKLIST.md`, các tasks tiếp theo:

- **T02** — `packages/shared-types/` + `apps/workers/` skeleton
- **T03** — 4 service Dockerfile stubs (gateway/ai/mcp/web)
- **T04** — `infra/migrations/V001__init.sql` + `apply.sh`
- **T05** — `infra/seed/` (users/products/policies + `seed.ts`)
- **T06** — `infra/vespa/` (CLIP 512 schema + deploy.sh)
- **T07** — Observability stack compose + configs
- **T08** — App compose + Next.js init + CI workflow

Sau T08 xong: `make up && make seed` → expected pass 6/9 DoD items per
PHASE_01_INFRA.md.

---

## License

UNLICENSED — internal hackathon project.
