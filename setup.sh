#!/usr/bin/env bash
# ============================================================================
# setup.sh — ICP one-shot local setup (Hackathon Finviet 2026, submission item #3)
# ----------------------------------------------------------------------------
# Chạy 1 lệnh để dựng toàn bộ hệ thống local:
#   prereq check -> .env -> pnpm install -> ONNX models -> docker compose up
#   -> migrate+seed Postgres -> deploy Vespa + feed -> health check.
#
# Usage:
#   bash setup.sh                  # full setup (build + boot tất cả, kể cả docker compose)
#   SKIP_MODELS=1 bash setup.sh    # bỏ generate ONNX (khi model.onnx đã có sẵn)
#   APP_ONLY=1   bash setup.sh     # bỏ stack observability (grafana/loki/tempo/prom) cho nhẹ
#
# Yêu cầu host: docker + docker compose v2, Node>=20, pnpm>=9, python 3.11-3.12.
# ⚠️ Generate ONNX (CLIP + cross-encoder) nặng: venv + tải ~1.2GB + vài phút.
# ============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

ONNX_VENV="${ONNX_VENV:-$HOME/icp-onnx-venv}"
CLIP_DIR="infra/vespa/models/clip_multilingual"
CE_DIR="infra/vespa/models/cross_encoder_rerank"
CLIP_MODEL="sentence-transformers/clip-ViT-B-32-multilingual-v1"
CE_MODEL="cross-encoder/mmarco-mMiniLMv2-L12-H384-v1"

c_blue="\033[1;34m"; c_green="\033[1;32m"; c_yellow="\033[1;33m"; c_red="\033[1;31m"; c_off="\033[0m"
say()  { echo -e "${c_blue}==>${c_off} $*"; }
ok()   { echo -e "${c_green}  OK${c_off} $*"; }
warn() { echo -e "${c_yellow}  ! ${c_off} $*"; }
die()  { echo -e "${c_red}  ✗ ${c_off} $*" >&2; exit 1; }

# ----------------------------------------------------------------------------
say "STAGE 0/7 — Kiểm tra prerequisites"
command -v docker >/dev/null    || die "thiếu docker"
docker compose version >/dev/null 2>&1 || die "thiếu 'docker compose' v2 plugin"
command -v node >/dev/null      || die "thiếu node (cần >=20)"
command -v pnpm >/dev/null      || die "thiếu pnpm (cần >=9)  ->  npm i -g pnpm@9"
command -v python3 >/dev/null   || die "thiếu python3 (cần 3.11-3.12)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || die "Node $NODE_MAJOR < 20"
PYV="$(python3 -c 'import sys;print("%d.%d"%sys.version_info[:2])')"
case "$PYV" in 3.11|3.12) : ;; *) warn "Python $PYV ngoài khoảng 3.11-3.12 — export ONNX có thể lỗi" ;; esac
ok "docker / node $NODE_MAJOR / pnpm $(pnpm -v) / python $PYV"

# ----------------------------------------------------------------------------
say "STAGE 1/7 — Biến môi trường (.env ở root)"
if [ ! -f .env ]; then
  warn ".env chưa có — tạo skeleton .env"
  cat > .env << 'ENVEOF'
# ICP .env (root) — điền các key thật trước khi chạy luồng AI
GOOGLE_GEMINI_API_KEY=
OPENAI_API_KEY=
JWT_SECRET=change-me-please
DATABASE_URL=postgresql://icp:icp_dev_password@postgres:5432/icp
REDIS_URL=redis://redis:6379
KAFKA_BROKERS=redpanda:9092
MCP_URL=http://mcp:5050
AI_SERVICE_URL=http://ai:5001
VESPA_URL=http://vespa:8080
VESPA_ENDPOINT=http://vespa:8080
VESPA_CONFIG_SERVER=http://vespa:19071
MATCH_THRESHOLD_HIGH=0.85
MATCH_THRESHOLD_LOW=0.6
ENVEOF
  die "Đã tạo .env skeleton — HÃY ĐIỀN GOOGLE_GEMINI_API_KEY + OPENAI_API_KEY + JWT_SECRET rồi chạy lại."
fi
grep -q '^GOOGLE_GEMINI_API_KEY=.\+' .env || warn "GOOGLE_GEMINI_API_KEY trống — luồng import/recommend/search-LLM/voice sẽ lỗi"
grep -q '^OPENAI_API_KEY=.\+'        .env || warn "OPENAI_API_KEY trống — STT voice (gpt-4o-transcribe) sẽ lỗi"
ok ".env có mặt"

# ----------------------------------------------------------------------------
say "STAGE 2/7 — pnpm install (monorepo)"
pnpm install
ok "dependencies cài xong"

# ----------------------------------------------------------------------------
ensure_onnx_venv() {
  if [ ! -d "$ONNX_VENV" ]; then
    say "  tạo venv export ONNX tại $ONNX_VENV"
    python3 -m venv "$ONNX_VENV"
  fi
  # shellcheck disable=SC1091
  source "$ONNX_VENV/bin/activate"
  if ! python -c "import optimum, onnx" >/dev/null 2>&1; then
    say "  cài optimum/transformers/sentence-transformers/onnx (torch CPU)"
    pip install --upgrade pip setuptools wheel >/dev/null
    pip install --index-url https://download.pytorch.org/whl/cpu torch >/dev/null
    pip install "optimum[onnxruntime]>=1.20" "transformers>=4.40" "sentence-transformers>=2.7,<4.0" "onnx>=1.15" >/dev/null
  fi
}

verify_onnx() { # $1=path $2=label $3=grep-expect
  python - "$1" "$2" "$3" << 'PYV'
import sys, onnx
p, label, expect = sys.argv[1], sys.argv[2], sys.argv[3]
m = onnx.load(p)
outs = [o.name for o in m.graph.output]
ins  = [i.name for i in m.graph.input]
print(f"    [{label}] IN={ins} OUT={outs}")
if expect == "512":
    dims = []
    for o in m.graph.output:
        if o.name == "sentence_embedding":
            dims = [d.dim_value or d.dim_param for d in o.type.tensor_type.shape.dim]
    assert 512 in dims, f"CLIP phải có sentence_embedding dim 512, thấy {dims} -> export SAI --library-name"
elif expect == "logits":
    assert "logits" in outs, f"cross-encoder phải có output 'logits', thấy {outs} -> sửa product.sd hoặc export lại"
print(f"    [{label}] verify OK")
PYV
}

say "STAGE 3/7 — Model ONNX (CLIP + cross-encoder)"
if [ "${SKIP_MODELS:-0}" = "1" ]; then
  warn "SKIP_MODELS=1 — bỏ qua generate model (giả định model.onnx đã có)"
else
  NEED_GEN=0
  [ -f "$CLIP_DIR/model.onnx" ] || NEED_GEN=1
  [ -f "$CE_DIR/model.onnx" ]   || NEED_GEN=1
  if [ "$NEED_GEN" = "1" ]; then
    ensure_onnx_venv
    if [ ! -f "$CLIP_DIR/model.onnx" ]; then
      say "  export CLIP -> $CLIP_DIR/model.onnx (~516MB, vài phút)"
      ( cd "$CLIP_DIR" && optimum-cli export onnx --library-name sentence_transformers --task feature-extraction -m "$CLIP_MODEL" . )
      verify_onnx "$CLIP_DIR/model.onnx" CLIP 512
    else ok "CLIP model.onnx đã có"; fi
    if [ ! -f "$CE_DIR/model.onnx" ]; then
      say "  export cross-encoder -> $CE_DIR/model.onnx (~449MB, vài phút)"
      ( cd "$CE_DIR" && optimum-cli export onnx --task text-classification -m "$CE_MODEL" . )
      verify_onnx "$CE_DIR/model.onnx" CROSS-ENCODER logits
    else ok "cross-encoder model.onnx đã có"; fi
    deactivate || true
  else
    ok "cả 2 model.onnx đã có sẵn"
  fi
fi

# ----------------------------------------------------------------------------
say "STAGE 4/7 — Boot Docker stack (docker compose up -d)"
docker network inspect icp >/dev/null 2>&1 || docker network create icp
if [ "${APP_ONLY:-0}" = "1" ]; then
  warn "APP_ONLY=1 — chỉ stack ứng dụng (bỏ observability)"
  docker compose -f infra/docker-compose.yml up -d --build
else
  make up
fi
ok "containers đang khởi động"

# ----------------------------------------------------------------------------
say "STAGE 5/7 — Chờ Postgres + Vespa sẵn sàng"
for i in $(seq 1 60); do docker exec icp-postgres pg_isready -U icp >/dev/null 2>&1 && break; sleep 2; done
ok "Postgres ready"
for i in $(seq 1 90); do curl -sf http://localhost:8080/state/v1/health >/dev/null 2>&1 && break; sleep 2; done
curl -sf http://localhost:8080/state/v1/health >/dev/null 2>&1 && ok "Vespa query ready" || warn "Vespa chưa ready sau ~3 phút — kiểm 'docker logs icp-vespa'"

# ----------------------------------------------------------------------------
say "STAGE 6/7 — Migrate + seed Postgres (60 SP + 5 user) + deploy Vespa + feed"
# Lưu ý: 'make seed-vespa' phụ thuộc 'seed' + 'vespa-deploy' (Makefile:101)
#   -> nó TỰ chạy migrate + seed Postgres trước, KHÔNG gọi 'make seed' riêng
#      (tránh seed 2 lần). seed idempotent (users/policies ON CONFLICT;
#      products SELECT-then-skip) nên chạy lại an toàn.
if [ -f "$CLIP_DIR/model.onnx" ] && [ -f "$CE_DIR/model.onnx" ]; then
  warn "2 model ~990MB > deploy.max-size mặc định 500MB — nếu deploy báo lỗi size/413, tăng deploy.max-size của Vespa config server (xem EXPORT.md)."
fi
make seed-vespa
ok "Postgres seeded + Vespa deployed + fed"

# ----------------------------------------------------------------------------
say "STAGE 7/7 — Health check"
curl -sf http://localhost:3001/api/v1/health >/dev/null 2>&1 && ok "Gateway :3001 OK" || warn "Gateway chưa phản hồi — 'docker logs icp-gateway'"
curl -sf http://localhost:3000 >/dev/null 2>&1 && ok "Web :3000 OK" || warn "Web chưa phản hồi — 'docker logs icp-web'"

cat << 'DONEEOF'

============================================================
 ✅ SETUP HOÀN TẤT
------------------------------------------------------------
 Web:     http://localhost:3000
 Gateway: http://localhost:3001
 Vespa:   http://localhost:8080

 Tài khoản test (mật khẩu: demo1234):
   merchant1@demo.icp   (merchant — tài khoản demo chính)
   customer1@demo.icp   (customer)
   admin@demo.icp       (admin)

 4 luồng:  /intent-01 import ảnh · /intent-02 voice ·
           /intent-03 search · /intent-04 recommend

 Log: make logs   |   Tear down: make down
============================================================
DONEEOF
