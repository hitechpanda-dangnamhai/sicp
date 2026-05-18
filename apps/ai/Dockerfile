# =============================================================================
# apps/ai/Dockerfile — ICP AI Orchestration (Flask + LangGraph) — T03 stub
# =============================================================================
# Stage:    T03 stub (S-00b Foundation Scaffold, Phiên 6)
# Purpose:  Minimal HTTP server respond GET /health → 200 {status:ok,stub:true}.
#           T03 chỉ tạo build context resolve được tại T08. KHÔNG có Flask,
#           KHÔNG có LangGraph, KHÔNG có OTel SDK, KHÔNG có structlog —
#           defer S-02 Day 4.
# Port:     5001 (per docs/phases/PHASE_01_INFRA.md line 29)
# Base:     python:3.11-slim (per decisions-log.md D-03 — Python 3.11)
# Replace:  S-02 Day 4 sẽ overwrite với Flask + LangGraph + OTel stack
#           (per docs/phases/PHASE_01_INFRA.md Day 4).
# =============================================================================

FROM python:3.11-slim

WORKDIR /app

# Slim image không có curl built-in. Cài curl cho HEALTHCHECK directive
# (per execution guide §4.3 line 699-700 — "Python slim cài curl cho
# consistency với production patterns"). Cleanup apt cache để giảm layer size.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

# Copy chỉ manifest stub; T03 không có src/ (defer S-02).
# pip install -e không chạy ở T03 vì dependencies empty.
COPY pyproject.toml ./

EXPOSE 5001

# Stub HTTP server inline via `python -c` (per Q-3 ack Plan A inline).
# Sử dụng stdlib `http.server` — không cần install dependency.
# Newlines `\n` trong JSON array string sẽ được Docker JSON parser convert
# thành literal newlines trước khi pass tới python interpreter — verified.
# CMD array form (exec) đảm bảo signal forwarding tới PID 1 đúng cách.
CMD ["python", "-c", "import http.server,json\nclass H(http.server.BaseHTTPRequestHandler):\n  def do_GET(self):\n    if self.path=='/health':\n      self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps({'status':'ok','stub':True}).encode())\n    else:\n      self.send_response(404);self.end_headers()\nprint('ai stub listening on 5001',flush=True)\nhttp.server.HTTPServer(('',5001),H).serve_forever()"]

# Healthcheck per decisions-log.md D-02 (stateless service defaults).
# `curl -fsS` flags: -f fail on HTTP error, -s silent, -S show error.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD curl -fsS http://localhost:5001/health || exit 1
