# AI Architecture v6 — Single Home chi tiết graph kernel

> **Quyết định kiến trúc neo ở [ADR-051](decisions/ADR-051.md)** (umbrella, họ ADR).
> File này = Single Home chi tiết triển khai AI (00_CONTEXT §4); update CÙNG PR
> khi đổi graph kernel. Doc này **supersede fossil v5** (mọi mô tả AI v5 rải rác
> trong `docs/archive-v1/` = read-only lineage).
>
> ⚠️ **Skeleton (S-P0-02/T01):** mới neo pointer + khung. Chi tiết materialize khi
> cluster **C7 (AI v6)** chạm — mỗi nâng cấp có ADR con (ADR-051 §Decision).

## §0 Trạng thái

- **Nguồn sự thật code:** `apps/ai/src/` (graph kernel sống ở CODE — CLAUDE.md §9).
- **Status triển khai:** `MASTER_BACKLOG.md` (KHÔNG ở đây — Single Home).
- **v5 core (đã chạy thật):** evidence loop · tool-RAG · confidence deterministic ·
  reflection ×2 · memory 3-tier. (Verify path:line khi chạm — luật re-verify §0.1.)

## §1 Sáu nâng cấp v6 (chi tiết materialize tại C7)

Neo từ ADR-051 §Decision — mỗi mục có ADR con khi C7 chạm:

1. **Planner tách executor** + task-DAG song song (latency + decompose).
2. **Eval-driven:** golden set + regression gate TRƯỚC mọi refactor prompt/graph.
3. **Cost là kiến trúc:** routing theo độ khó + prompt/semantic cache + cost
   per-tenant (chi tiết [ADR-054](decisions/ADR-054.md)).
4. **Guardrails + per-tool authz tenant-scoped** (biên security multi-tenant AI).
5. **Tách workload** chat-graph (LangGraph, ADR-048) vs batch/long-running
   (durable engine, C5/C7).
6. **Context budget + compaction per-node.**

## §2 TODO (mở khi C7 spawn)

- [ ] Sơ đồ graph kernel hiện tại (router → 8 subgraph) — PULL từ code, không chép doc.
- [ ] Bảng node × tool MCP × budget.
- [ ] Eval harness + golden set location.
- [ ] Cost/trace schema (ADR-054 W-93 durable trace).
