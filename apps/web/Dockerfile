# =============================================================================
# apps/web/Dockerfile — ICP Web (Next.js) — T03 PLACEHOLDER
# =============================================================================
# Stage:    T03 stub (S-00b Foundation Scaffold, Phiên 6)
# Purpose:  Minimal HTTP server respond GET /health → 200 {status:ok,stub:true}.
#           T03 mục tiêu chỉ là cho compose build context resolve được tại T08.
#
# *** T08 SẼ OVERWRITE FILE NÀY HOÀN TOÀN ***
# T08 sẽ thay bằng Next.js 14 multi-stage build (builder + runner stages, per
# ADR-033/034/035 + decisions-log.md D-03 — Next.js 14.2.x + Tailwind 3.4.x +
# shadcn). Lý do sequencing: T08 cần web source code (app/, components/,
# globals.css, next.config.js) trước khi viết production Dockerfile.
#
# Port:     3000 (per docs/phases/PHASE_01_INFRA.md line 31)
# Base:     node:20-alpine (per decisions-log.md D-03 — Node 20 LTS)
# =============================================================================

FROM node:20-alpine

WORKDIR /app

COPY package.json ./

EXPOSE 3000

# Stub HTTP server inline — same pattern apps/gateway/Dockerfile (per Q-4 ack
# Option A: web cũng expose /health stub để DoD-3 literal được thỏa mãn ngay
# T03). CommonJS `require` per Q-1 ack. CMD array form cho PID 1 signaling.
CMD ["node", "-e", "require('http').createServer((req,res)=>{if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({status:'ok',stub:true}));}else{res.writeHead(404);res.end();}}).listen(3000,()=>console.log('web stub listening on 3000 — T08 will replace with Next.js'))"]

# Healthcheck per decisions-log.md D-02 (stateless defaults).
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD wget -q -O- http://localhost:3000/health || exit 1
