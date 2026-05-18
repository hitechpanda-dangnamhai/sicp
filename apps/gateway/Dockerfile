# =============================================================================
# apps/gateway/Dockerfile — ICP API Gateway
# =============================================================================
# Stage:    T03 stub (S-00b Foundation Scaffold, Phiên 6)
# Purpose:  Minimal HTTP server respond GET /health → 200 {status:ok,stub:true}.
#           Goal là cho compose build context resolve được tại T08; KHÔNG có
#           NestJS, KHÔNG có OTel SDK, KHÔNG có real controllers — defer S-02.
# Port:     3001 (per docs/phases/PHASE_01_INFRA.md line 28)
# Base:     node:20-alpine (per decisions-log.md D-03 — Node 20 LTS)
# Replace:  S-02 Day 3 sẽ overwrite với multi-stage NestJS build
#           (per docs/phases/PHASE_01_INFRA.md Day 3 + ADR per D-05 CommonJS).
# =============================================================================

FROM node:20-alpine

WORKDIR /app

# Copy chỉ manifest stub; T03 không có src/ (defer S-02).
# Pnpm install không cần ở T03 vì empty dependencies — root pnpm workspace
# enumerate apps/gateway/package.json là đủ.
COPY package.json ./

# Informational (per task pack Q-5 ack). Compose `ports:` mapping trong T08
# mới thực sự bind host port.
EXPOSE 3001

# Stub HTTP server inline (per execution guide §4.3 line 672 pattern).
# Sử dụng CommonJS `require` per Q-1 ack — package.json không set "type",
# default CommonJS, .js inline string parsed CJS. CMD array form (exec form)
# đảm bảo signal forwarding tới PID 1 đúng cách.
CMD ["node", "-e", "require('http').createServer((req,res)=>{if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({status:'ok',stub:true}));}else{res.writeHead(404);res.end();}}).listen(3001,()=>console.log('gateway stub listening on 3001'))"]

# Healthcheck per decisions-log.md D-02 (stateless service defaults).
# `wget` built-in alpine — no extra install needed.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD wget -q -O- http://localhost:3001/health || exit 1
