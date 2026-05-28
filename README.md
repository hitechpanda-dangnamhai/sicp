# ICP — Intelligent Commerce Platform

> Nền tảng thương mại thông minh cho người bán (merchant), kết hợp **AI hội thoại + thị giác máy + tìm kiếm hybrid (vector + BM25 + cross-encoder rerank)**. Bốn luồng AI cốt lõi: **nhập hàng bằng ảnh**, **mua hàng bằng giọng nói**, **tìm sản phẩm bằng text**, và **gợi ý sản phẩm từ ảnh**.

Hackathon Finviet 2026 — monorepo `icp` (`v0.0.1`, private/UNLICENSED).

---

## 1. Mô tả dự án + Tech stack

ICP là một **monorepo pnpm** gồm 5 service ứng dụng + 4 hạ tầng backing, giao tiếp qua REST + SSE + JSON-RPC (MCP) + Kafka events.

| Layer | Công nghệ | Vai trò |
|---|---|---|
| **Web (FE)** | Next.js `14.2.18` (App Router) · React `18.3` · TanStack Query `5` · Tailwind `3.4` · Radix UI · React Hook Form · zod `4` · lucide/tabler icons · canvas-confetti · Storybook `9` | Giao diện người dùng (mobile-first phone frame), 8 màn intent |
| **Gateway (BFF)** | NestJS `10.4` · `@nestjs/swagger` · nestjs-zod · ioredis `5.4` · `pg` `8.13` · zod `3.23` · OpenTelemetry | API gateway: auth (JWT), cart, intent dispatch, dashboard stats, SSE relay |
| **AI service** | Python `3.11–3.12` · Flask `3` · **LangGraph `0.2.76`** + langchain-core `0.3` · langgraph-checkpoint-redis `0.1.3` (RedisSaver) · redis `5` · google-generativeai · openai · pydantic `2` · httpx | Orchestrator LangGraph (Pattern A interrupt/resume) cho 4 intent graphs |
| **MCP server** | Python `3.11–3.12` · Flask `3` (JSON-RPC 2.0 over HTTP) · google-generativeai `0.8` · openai `1.40` · redis · httpx · OpenTelemetry | Tool layer: `vespa.hybrid_search`, `vision.analyze`, `speech.transcribe/synthesize`, `cart.*`, `analytics.*` |
| **Workers** | Node/TypeScript | Behavior event consumers (Kafka → analytics) |
| **DB** | PostgreSQL `16` | Orders, order_items, products, users, analytics MV |
| **Cache/Cart** | Redis Stack `7.4` | Cart JSON snapshot (`cart:{user_id}`), voice session memory (`voice:context:{user_id}`), RedisSaver checkpoint, SSE pub/sub |
| **Search** | **Vespa `8`** | Hybrid search: BM25 + CLIP vector (512-dim) + cross-encoder rerank (global-phase) |
| **Events** | Redpanda `v23.3.10` (Kafka-compatible) | Behavior event bus |
| **Observability** | OpenTelemetry → (Grafana/Tempo/Loki/Prometheus — compose riêng) | Traces/logs/metrics |

### Kiến trúc dòng chảy (tóm tắt)

```
Browser ──REST/SSE──> Gateway (NestJS :3001) ──HTTP──> AI service (Flask+LangGraph :5001)
                          │                                   │
                          │                                   └─JSON-RPC─> MCP (:5050) ──> Vespa :8080
                          ├─ioredis─> Redis :6379                                       ├─> Gemini / OpenAI API
                          └─pg──────> Postgres :5432              MCP ──> Redis / Postgres / Kafka
```

### 4 luồng AI (route ↔ intent)

| Route | Intent | Luồng |
|---|---|---|
| `/intent-01` | **Import bằng ảnh** | Ảnh sản phẩm → `vision.analyze` (Gemini) → prefill form + market trend + Shopee compare → thêm vào catalog |
| `/intent-02` | **Mua bằng giọng nói** | Ghi âm → STT (OpenAI) → parse intent (Gemini LLM) → resolve qua Vespa → clarify / bulk add giỏ → voice session memory |
| `/intent-03` | **Tìm bằng text** | Query → understanding → Vespa hybrid (BM25 + CLIP vector + cross-encoder rerank) → product cards + match badge + reason chip |
| `/intent-04` | **Gợi ý từ ảnh** | Ảnh → `vision.analyze` → recommend sản phẩm tương tự + co-purchase → thêm giỏ |

Các route phụ: `/home` (dashboard), `/intent-05` (giỏ hàng), `/intent-06` (thanh toán — placeholder), `/intent-07` (analytics — placeholder), `/me` (profile), `/auth/login`.

---

## 2. Yêu cầu môi trường

| Yêu cầu | Phiên bản | Ghi chú |
|---|---|---|
| **Docker** + Docker Compose | mới (v2 plugin `docker compose`) | Chạy toàn bộ stack |
| **Node.js** | `>= 20.0.0` | FE + Gateway + Workers + seed |
| **pnpm** | `>= 9.0.0` (khuyến nghị `9.15.0`) | Package manager monorepo |
| **Python** | `>= 3.11, < 3.13` (verified 3.12.3) | AI/MCP service **và** để export model ONNX |
| Đĩa trống | ~6–8 GB | Hai model ONNX (~990MB) + venv export (~2GB) + images |
| RAM | ≥ 8 GB free cho Docker | Vespa nạp 2 model ONNX vào RAM lúc validate (heap đã chỉnh 2–6GB) |

### Cổng (host ports — từ `infra/docker-compose.yml`)

| Service | Port | | Service | Port |
|---|---|---|---|---|
| Web | `3000` | | Postgres | `5432` |
| Gateway | `3001` | | Redis | `6379` |
| AI | `5001` | | Redpanda (Kafka) | `9092` / `9644` |
| MCP | `5050` | | Vespa | `8080` (query) / `19071` (config) |

### Biến môi trường (`.env` ở **root repo**)

Các container `gateway/ai/mcp/web` đều load `env_file: ../.env` (tức `.env` đặt ở **thư mục gốc repo**).

> ⚠️ **Repo KHÔNG kèm `.env.example`** (xem mục "Tài liệu còn thiếu"). Dưới đây là các biến tham chiếu trong code/compose — hãy tự tạo `.env` ở root:

```env
# --- AI / LLM keys (BẮT BUỘC để 4 luồng AI chạy) ---
GOOGLE_GEMINI_API_KEY=...     # Gemini 2.5 Flash (vision.analyze + LLM intent parse/reasons)
OPENAI_API_KEY=...            # gpt-4o-transcribe (STT voice) + gpt-4o-mini-tts (TTS)

# --- Auth ---
JWT_SECRET=...                # ký JWT (gateway)

# --- Service wiring (thường đã có default qua docker network, ghi rõ nếu chạy ngoài Docker) ---
DATABASE_URL=postgresql://icp:icp_dev_password@postgres:5432/icp
REDIS_URL=redis://redis:6379
KAFKA_BROKERS=redpanda:9092
MCP_URL=http://mcp:5050
AI_SERVICE_URL=http://ai:5001
VESPA_URL=http://vespa:8080
VESPA_ENDPOINT=http://vespa:8080
VESPA_CONFIG_SERVER=http://vespa:19071

# --- Tunable (có default trong code) ---
MATCH_THRESHOLD_HIGH=0.85     # voice resolve: >0.85 = auto-add
MATCH_THRESHOLD_LOW=0.6       # 0.6–0.85 = clarify; <0.6 = no-match alt
```

Credentials Postgres mặc định (trong compose): user `icp` / password `icp_dev_password` / db `icp`.

---

## 3. ⭐ Cài đặt model ONNX (CLIP + Cross-encoder) — BƯỚC QUAN TRỌNG NHẤT

> **Vì sao phức tạp:** Vespa cần 2 file binary ONNX **KHÔNG được commit vào git** (quá lớn, nằm trong `.gitignore`). Bạn **phải tự generate** chúng **TRƯỚC khi** chạy `make vespa-deploy`, nếu không Vespa sẽ fail lúc boot/validate. Vespa nạp model qua **application package zip** (do `deploy.sh` đóng gói thư mục `models/`) — KHÔNG qua bind-mount.

Hai model cần có:

| Thư mục | File cần tạo | Model gốc (Hugging Face) | Kích thước | Vai trò |
|---|---|---|---|---|
| `infra/vespa/models/clip_multilingual/` | `model.onnx` | `sentence-transformers/clip-ViT-B-32-multilingual-v1` | ~516 MB (FP32) | Embed text→512-dim (vector recall + ảnh cross-modal) |
| `infra/vespa/models/cross_encoder_rerank/` | `model.onnx` | `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` | ~449 MB | Rerank top-30 (global-phase logit) |

Các file `tokenizer.json` / `config.json` của cả 2 model **đã có sẵn** trong repo; chỉ thiếu `model.onnx`.

### 3.0. Môi trường export (chung cho cả 2 model)

Ubuntu 23.04+ chặn `pip install` vào system Python (PEP 668) → dùng venv tạm:

```bash
# Tạo venv NGOÀI thư mục models/ để zip deploy không bị phình
python3 -m venv ~/icp-onnx-venv
source ~/icp-onnx-venv/bin/activate
pip install --upgrade pip setuptools wheel

# torch CPU-only (tránh tải bản CUDA ~532MB)
pip install --index-url https://download.pytorch.org/whl/cpu torch

# optimum + transformers + sentence-transformers (PIN bắt buộc)
# ⚠️ sentence-transformers PHẢI < 4.0 (5.x làm .config read-only → vỡ optimum export)
pip install "optimum[onnxruntime]>=1.20" "transformers>=4.40" "sentence-transformers>=2.7,<4.0" "onnx>=1.15"
```

### 3.1. Export CLIP (`clip_multilingual/model.onnx`)

> Đây là quy trình **chính thức có sẵn** trong repo: `infra/vespa/models/clip_multilingual/EXPORT.md`.

```bash
cd infra/vespa/models/clip_multilingual

# ⚠️ FLAG QUAN TRỌNG: --library-name sentence_transformers (KHÔNG phải transformers)
#    Dùng "transformers" sẽ ra encoder thô 768-dim → SAI (phải 512-dim).
optimum-cli export onnx \
  --library-name sentence_transformers \
  --task feature-extraction \
  -m sentence-transformers/clip-ViT-B-32-multilingual-v1 \
  .
```

**Verify (BẮT BUỘC) — output `sentence_embedding` phải là 512:**

```bash
python -c "
import onnx; m = onnx.load('model.onnx')
for o in m.graph.output:
    print(o.name, [d.dim_value or d.dim_param for d in o.type.tensor_type.shape.dim])
# Kỳ vọng: sentence_embedding [batch_size, 512]   ← 512 là BẮT BUỘC (khớp product.sd)
"
```

Nếu ra **768** → đã dùng sai `--library-name`; xóa file và export lại với `sentence_transformers`.

### 3.2. Export Cross-encoder (`cross_encoder_rerank/model.onnx`)

> ⚠️ **Repo KHÔNG có file `EXPORT.md` cho model này** (xem mục "Tài liệu còn thiếu"). Quy trình dưới đây được **suy ra theo pattern CLIP + theo định danh model ghi trong `infra/vespa/schemas/product.sd` (dòng 341) và `services.xml` (dòng 74)** — bạn **nên verify lại output** trước khi deploy.

Model là `XLMRobertaForSequenceClassification` (1 logit output, hidden 384). Cần export task `text-classification`:

```bash
cd infra/vespa/models/cross_encoder_rerank

optimum-cli export onnx \
  --task text-classification \
  -m cross-encoder/mmarco-mMiniLMv2-L12-H384-v1 \
  .
```

**Verify — model phải có input `input_ids` + `attention_mask` và output `logits`** (rank profile `cross_encoder_rerank` đọc `onnx(cross_encoder_rerank).logits{d0:0,d1:0}`):

```bash
python -c "
import onnx; m = onnx.load('model.onnx')
print('IN :', [i.name for i in m.graph.input])      # kỳ vọng có input_ids, attention_mask
print('OUT:', [o.name for o in m.graph.output])     # kỳ vọng có 'logits'
"
```

> Nếu tên input/output khác (`token_type_ids` thừa, hay output không phải `logits`), cần điều chỉnh export hoặc `product.sd` cho khớp. Đây là điểm rủi ro do thiếu doc gốc.

### 3.3. Lưu ý vận hành (gotchas đã biết)

- **`deploy.max-size`:** Hai model ~**990 MB** → zip application package vượt mặc định Vespa `deploy.max-size` = 500 MB. **Phải tăng** `deploy.max-size` của config server, nếu không `make vespa-deploy` báo lỗi size/413. (Vespa operational config — xem docs Vespa; repo chưa tự động hóa bước này.)
- **Heap Vespa:** đã set `VESPA_CONFIGSERVER_JVMARGS`/`VESPA_CONTAINER_JVMARGS = -Xms2g -Xmx6g` trong compose (mặc định 1.5GB sẽ OOM khi validate 2 model ONNX).
- **Cross-encoder warning** `input 'input_ids'/'attention_mask' element type 'long' bound to float … conversion might be lossy`: lành tính với token-ID (giá trị nhỏ), KHÔNG chặn chạy.
- **`cross_encoder_tokens` là derived attribute**: khi đổi schema field này, phải **re-feed/reindex** (chạy lại `make seed-vespa`) để populate lại token, nếu không doc giữ token cũ/rỗng.
- **Cách phân phối model cho team:** mỗi dev tự chạy quy trình trên 1 lần (~5 phút). KHÔNG dùng Git LFS, KHÔNG bind-mount `models/` vào container.

### 3.4. Troubleshooting nhanh

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `externally-managed-environment` khi pip | Ubuntu PEP 668 | Dùng venv (3.0) |
| CLIP ra dim 768 | sai `--library-name transformers` | export lại với `sentence_transformers` |
| `property 'config' has no setter` | sentence-transformers ≥5.x | `pip install "sentence-transformers<4.0"` |
| Vespa `Cannot find embedder model file` | `model.onnx` chưa tạo / chưa zip | tạo model trước, kiểm `deploy.sh` zip `models/` |
| `make vespa-deploy` lỗi 413/size | zip > `deploy.max-size` 500MB | tăng `deploy.max-size` config server |
| `docker logs icp-vespa` OOM | heap thấp | đã set 2–6GB; tăng RAM Docker nếu cần |

---

## 4. Cài đặt & chạy local (từng bước)

```bash
# 0) Clone + vào repo
git clone <repo-url> icp && cd icp

# 1) Cài dependency toàn monorepo (Node/TS)
pnpm install

# 2) Tạo file .env ở ROOT repo (xem mục 2) — điền GOOGLE_GEMINI_API_KEY + OPENAI_API_KEY + JWT_SECRET

# 3) ⭐ TẠO 2 MODEL ONNX (mục 3) — BẮT BUỘC trước khi deploy Vespa
#    -> infra/vespa/models/clip_multilingual/model.onnx
#    -> infra/vespa/models/cross_encoder_rerank/model.onnx

# 4) Boot toàn bộ stack (app + hạ tầng + observability)
make up
#    = tạo network `icp` + docker compose up -d (postgres/redis/redpanda/vespa + gateway/ai/mcp/web)

# 5) Migrate + seed Postgres (5 users + 60 products + policies/promo)
make seed
#    = bash infra/migrations/apply.sh  +  pnpm --filter @icp/seed run seed

# 6) Deploy Vespa app package (kèm model ONNX) + chờ readiness + feed 60 sản phẩm
make seed-vespa
#    = (seed) + bash infra/vespa/deploy.sh + chờ :8080 health + pnpm --filter @icp/seed run vespa-feed

# 7) Mở app
#    Web:     http://localhost:3000
#    Gateway: http://localhost:3001   (Swagger: /api docs nếu bật)
```

> `make seed-vespa` idempotent — chạy lại an toàn (Vespa dùng session-id; feed là upsert theo docid).
> Tail log: `make logs` (tất cả) · `make logs-ai` · `make logs-mcp`.

### Tài khoản test (seed sẵn — mật khẩu **`demo1234`** cho tất cả)

| Email | Role |
|---|---|
| `merchant1@demo.icp` | merchant *(tài khoản demo chính)* |
| `merchant2@demo.icp` | merchant |
| `customer1@demo.icp` | customer |
| `customer2@demo.icp` | customer |
| `admin@demo.icp` | admin |

Đăng nhập `merchant1@demo.icp` / `demo1234` → vào `/home`.

---

## 5. Kê khai open-source libraries, AI/LLM & API bên thứ ba

> Repo gốc: license **UNLICENSED** (private, dự thi). Để tạo danh sách license **đầy đủ & chính xác**, chạy: `pnpm licenses list` (JS) + `pip-licenses` trong venv AI/MCP (Python). Bảng dưới liệt kê thành phần chính + license **thường gặp** (cần verify với upstream trước khi tái phân phối).

### 5.1. Thư viện open-source chính

| Thành phần | License (thường) | Layer |
|---|---|---|
| Next.js, React, TanStack Query, Tailwind, Radix UI, React Hook Form, zod, tailwind-merge, Storybook | MIT | Web |
| lucide-react, canvas-confetti | ISC | Web |
| @tabler/icons-react | MIT | Web |
| NestJS (`@nestjs/*`), nestjs-zod, ioredis, `pg` | MIT | Gateway |
| OpenTelemetry (JS + Python) | Apache-2.0 | Gateway/AI/MCP |
| Flask, Werkzeug, httpx | BSD-3-Clause | AI/MCP |
| LangGraph, langchain-core, langgraph-checkpoint-redis, redis-py, pydantic | MIT | AI/MCP |
| optimum / transformers / sentence-transformers / onnx (export model) | Apache-2.0 | Tooling export |

### 5.2. Hạ tầng (Docker images) — ⚠️ chú ý license không thuần OSI

| Image | License | Ghi chú |
|---|---|---|
| `postgres:16-alpine` | PostgreSQL License (OSI) | OK |
| **`redis/redis-stack-server:7.4.0-v8`** | **RSALv2 / SSPLv1 (source-available, KHÔNG thuần OSI)** | Cần lưu ý điều khoản dùng |
| **`redpandadata/redpanda:v23.3.10`** | **BSL 1.1 (source-available)** | Cần lưu ý điều khoản dùng |
| `vespaengine/vespa:8` | Apache-2.0 | OK |

### 5.3. AI / LLM models & API bên thứ ba (proprietary)

| Dịch vụ | Model | Dùng ở | Biến env |
|---|---|---|---|
| **Google Gemini API** | `gemini-2.5-flash` | `vision.analyze` (import/recommend ảnh) + LLM parse intent / sinh reason (search, voice) | `GOOGLE_GEMINI_API_KEY` |
| **OpenAI API** | `gpt-4o-transcribe` (STT) | Chuyển giọng nói → text (voice buy) | `OPENAI_API_KEY` |
| **OpenAI API** | `gpt-4o-mini-tts` (TTS) | Sinh giọng phản hồi (backend đã có; **FE chưa wire** — known issue) | `OPENAI_API_KEY` |

### 5.4. Embedding / rerank models (Hugging Face — chạy trong Vespa)

| Model | License (thường) | Vai trò |
|---|---|---|
| `sentence-transformers/clip-ViT-B-32-multilingual-v1` | Apache-2.0 | Text/ảnh → 512-dim vector |
| `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` | Apache-2.0 | Rerank kết quả search |

---

## 6. Kịch bản test thủ công — 4 luồng chính

> Tiền đề: đã `make up` + `make seed` + `make seed-vespa` thành công; đã điền API keys vào `.env`. Đăng nhập `merchant1@demo.icp` / `demo1234`.

### 6.1. Tìm sản phẩm bằng text — `/intent-03`

1. Vào `/intent-03`, gõ ô tìm kiếm: **"Đồ cay cay ăn phở"** → Enter.
2. **Kỳ vọng:** xuất hiện "understanding bubble" (Aida hiểu là "gia vị cay ăn kèm phở"), badge "Tìm thấy N sản phẩm", và carousel sản phẩm **liên quan** (Tương ớt Chin-su / Cholimex / Sriracha / mì cay…), mỗi card có reason chip ("Vị cay vừa, phù hợp chấm phở").
3. Test câu unique: **"Coca-Cola"**, **"xúc xích Vissan"** → ra đúng sản phẩm.
4. Test rỗng / vô nghĩa: query lạ → state empty với gợi ý "Tìm rộng hơn".
5. **⚠️ Known issue:** badge **% match** trên card đang hiển thị **giá trị thô của cross-encoder** (có thể ra 2% / 56% / hoặc số âm như -40%) thay vì % chuẩn 0–100 — đây là lỗi normalize đã ghi nhận (backlog S-04), KHÔNG ảnh hưởng thứ hạng kết quả.

### 6.2. Gợi ý sản phẩm từ ảnh — `/intent-04`

1. Vào `/intent-04`, upload 1 ảnh sản phẩm (vd chai nước tương / gói mì).
2. **Kỳ vọng:** `vision.analyze` (Gemini) nhận diện → trả danh sách sản phẩm gợi ý tương tự + co-purchase, mỗi card có nút "+".
3. Bấm **"+"** trên 1 card → toast "Đã thêm". Sang `/intent-05` (giỏ) → **sản phẩm phải có trong giỏ** (xác nhận payload add-to-cart đúng).
4. Test ảnh mờ/không phải sản phẩm → thông báo độ tin cậy thấp / không nhận diện được.

### 6.3. Nhập hàng bằng ảnh — `/intent-01`

1. Vào `/intent-01`, chụp/upload ảnh sản phẩm cần nhập.
2. **Kỳ vọng:** 4-phase loading → form **prefill** (tên, brand, category, giá gợi ý) từ `vision.analyze`; có panel "Market trend" + "Shopee compare".
3. Chỉnh sửa field nếu cần → submit tạo product draft.
4. Test ảnh blur → mã `E_VISION_BLUR` / thông báo yêu cầu chụp lại rõ hơn.

### 6.4. Mua hàng bằng giọng nói — `/intent-02`

1. Vào `/intent-02`, bấm mic, **nói rõ và chậm**: *"Cho tôi 2 chai nước tương Maggi"*.
2. **Kỳ vọng:** state-A (đang ghi âm, timer ≤30s) → state-B (transcribing 4-phase) → STT ra text → parse intent → resolve qua Vespa → **bulk add vào giỏ** → state-E "Đã thêm vào giỏ" (success + nút "Mua tiếp" / "Thanh toán").
3. Test **clarify** (state-D): nói món mơ hồ nhiều SKU (vd *"cho tôi nước tương"*) → hiện chip-row các lựa chọn → chạm 1 chip → thêm vào giỏ.
4. Test **action khác:** *"bỏ Maggi khỏi giỏ"* (remove) · *"thêm 1 chai nữa"* (update_qty) · *"sản phẩm hồi nãy là gì?"* (query — voice session memory).
5. Test **no-match** (state-F): nói món không có trong catalog → hiện thẻ sản phẩm thay thế (similarity).
6. **⚠️ Known issues:**
   - STT tiếng Việt **sai khi nói nhanh/dài/ồn** → nói rõ + chậm thì chính xác.
   - **state-C ("giỏ tạm chờ xác nhận") không reachable**: BE auto-commit thẳng món match unique → bỏ qua bước xác nhận (đã ghi KNOWN-ISSUE, chờ quyết định flow).
   - Một số field typed-SSE (match %, similarity %, peek-card) đang ẩn do BE chưa cấp typed → FE đọc defensive (không bịa số).

### 6.5. Edge cases đã xử lý (tóm tắt)

- Input rỗng / query vô nghĩa → empty state + gợi ý.
- Ảnh mờ/không hợp lệ → `E_VISION_BLUR`.
- STT lỗi/không có giọng → `E_TRANSCRIBE_FAILED` / `E_NO_SPEECH`.
- Permission mic bị từ chối → `E_PERMISSION_DENIED`.
- LLM timeout → fallback (search Variant A baseline BM25) / error code.
- Add-to-cart lỗi → giỏ không đổi (validate field payload).

---

## 7. ⚠️ Tài liệu / file CÒN THIẾU (cần bổ sung trước khi nộp)

Dựa trên source snapshot, các thứ sau **không có trong repo** và nên bổ sung:

1. **`.env.example`** — không có file template biến môi trường. Mục 2 ở trên là danh sách suy ra từ code/compose; nên tạo `.env.example` chính thức ở root.
2. **`infra/vespa/models/cross_encoder_rerank/EXPORT.md`** — **KHÔNG có** quy trình export cho model cross-encoder (chỉ CLIP có `EXPORT.md`). Quy trình ở mục 3.2 là **suy ra** từ định danh model trong `product.sd`/`services.xml` → **cần verify** output ONNX (`logits` + `input_ids`/`attention_mask`) trước khi deploy.
3. **Bộ docs spec `docs/`** — snapshot chỉ còn `docs/README.md`; các file `00_CONTEXT` → `08_FE_BE_CONTRACT`, `02_DATA_MODEL`, `03_API_CONTRACTS`, `04_INTENT_SPECS`, `phases/*` **không có trong zip**. Cần để làm **Hạng mục #4 — Tài liệu kiến trúc** (System Architecture Diagram, Sequence Diagram, API doc, ERD).
4. **Bằng chứng deploy (Hạng mục #3)** + **Link live (Hạng mục #7)** — repo chỉ có Dockerfile + docker-compose (đủ cho phương án "docker-compose up"), nhưng chưa có URL deploy public + script `setup.sh` one-shot. Cân nhắc thêm `setup.sh` gói gọn các bước mục 4.
5. **License chính xác** — bảng mục 5 là license "thường gặp"; chạy `pnpm licenses list` + `pip-licenses` để có bản kê khai chuẩn (đặc biệt lưu ý **Redis Stack** và **Redpanda** không thuần OSI).
6. **Unit test** — Makefile có `make test` nhưng chưa rõ độ phủ; BTC **cộng điểm** nếu có unit test cơ bản (mục D PDF). Nên bổ sung.

---

*Tài liệu này mô tả ICP — Intelligent Commerce Platform (Hackathon Finviet 2026). Mọi thông tin kỹ thuật được trích từ source thật (`package.json`, `pyproject.toml`, `docker-compose.yml`, `Makefile`, `infra/vespa/*`, `infra/seed/*`); các mục suy ra/cần verify đã được đánh dấu rõ.*
