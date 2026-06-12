# apps/ai — ICP AI Orchestration (Flask + LangGraph + OTel)

Universal intent service: nhận `POST /intent` (SSE stream) + `POST /intent/{rid}/resume`
(Pattern A interrupt+resume). Router → 6 intent graph (search / cart / import /
voice-buy / recommend / analyze). LLM Gemini primary + OpenAI fallback; gọi MCP qua
JSON-RPC; publish SSE qua Redis pub/sub.

## How to run

```
docker compose -f infra/docker-compose.yml up ai   # container icp-ai, port 5001
```

Identity Gateway-forward (ADR-047): header `X-User-Id` / `X-Tenant-Id` (KHÔNG verify
JWT — tin Gateway perimeter). AI đọc 2 header → `state.user_id` / `state.tenant_id`,
forward tiếp sang MCP qua `mcp_client` header.

## Env

| Var | Default | Ghi chú |
|---|---|---|
| `MCP_URL` | `http://mcp:5050/rpc` | MCP JSON-RPC endpoint |
| `REDIS_URL` | `redis://localhost:6379/0` | SSE pub/sub + RedisSaver checkpoint + voice:context |
| `FLASK_RUN_PORT` | `5001` | — |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | — | LLM primary / fallback |

## Key endpoints

- `GET /health` · `GET /ready` — liveness/readiness
- `POST /intent` — universal intent, trả SSE `text/event-stream` (+ header `X-Request-Id`)
- `POST /intent/<rid>/resume` — internal Gateway-forwarded resume (202)

## How to run tests

Image `icp/ai:dev` KHÔNG copy `tests/` và pytest nằm ở `[optional-dependencies].dev`
(không cài lúc build). CI pytest chưa tồn tại (BACKLOG §3 P1 #18). Chạy bằng cách mount
source vào image (đã có langgraph + runtime deps) rồi cài pytest:

```
docker run --rm -v "$PWD/apps/ai":/app -w /app icp/ai:dev \
  sh -c "pip install -q pytest pytest-asyncio && PYTHONPATH=/app python -m pytest tests/ -v"
```

(Chạy từ repo root. Mount = source live nên không cần rebuild image cho code mới.)
