# =============================================================================
# apps/mcp/Dockerfile — ICP MCP Tool Server (JSON-RPC) — T03 stub
# =============================================================================
# Stage:    T03 stub (S-00b Foundation Scaffold, Phiên 6)
# Purpose:  Minimal HTTP server respond GET /health → 200 {status:ok,stub:true}.
#           T03 chỉ tạo build context resolve được tại T08. KHÔNG có MCP tool
#           registry, KHÔNG có JSON-RPC handler, KHÔNG có psycopg/redis/OTel —
#           defer S-02 Day 5.
# Port:     5050 (per docs/phases/PHASE_01_INFRA.md line 30)
# Base:     python:3.11-slim (per decisions-log.md D-03 — Python 3.11)
# Replace:  S-02 Day 5 sẽ overwrite với MCP tool registry + JSON-RPC POST /rpc
#           + GET /health controller (per docs/phases/PHASE_01_INFRA.md Day 5
#           + C4 patch S-00 audit cho DoD-3 readiness probe).
# =============================================================================

FROM python:3.11-slim

WORKDIR /app

# Slim image không có curl built-in. Cài curl cho HEALTHCHECK directive
# (per execution guide §4.3 line 699-700). Cleanup apt cache.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./

EXPOSE 5050

# Stub HTTP server inline (per Q-3 ack Plan A). Same pattern apps/ai/Dockerfile
# với port 5050. Newlines `\n` JSON-escaped → literal newlines pre-python.
CMD ["python", "-c", "import http.server,json\nclass H(http.server.BaseHTTPRequestHandler):\n  def do_GET(self):\n    if self.path=='/health':\n      self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps({'status':'ok','stub':True}).encode())\n    else:\n      self.send_response(404);self.end_headers()\nprint('mcp stub listening on 5050',flush=True)\nhttp.server.HTTPServer(('',5050),H).serve_forever()"]

# Healthcheck per decisions-log.md D-02 (stateless service defaults).
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD curl -fsS http://localhost:5050/health || exit 1
