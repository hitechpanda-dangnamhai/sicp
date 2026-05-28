# Cross-encoder Rerank ONNX Model Export Instructions

> **Slice:** S-07/S-08 (Sx07-F-debug — Vespa native ONNX cross-encoder global-phase rerank)
> **LAW ref:** rank-profile `cross_encoder_rerank` trong `infra/vespa/schemas/product.sd`
> **Model:** `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` (multilingual, Vietnamese-capable)
> **Version:** v1 (NEW — Phiên Sx08-K 2026-05-29)
>
> ⚠️ **TÀI LIỆU SUY RA (derived):** Repo trước đây **chưa có** EXPORT.md cho model này (chỉ CLIP có).
> Quy trình dưới được dựng theo **mẫu `clip_multilingual/EXPORT.md`** + **định danh model ghi trong
> `product.sd` (dòng 341) và `services.xml` (dòng 74)** + cấu hình thực `config.json`
> (`XLMRobertaForSequenceClassification`, hidden 384, 1 logit). **Hãy verify output ONNX** (mục
> Verification) trước khi `make vespa-deploy` — đặc biệt tên input/output phải khớp `product.sd`.

Thư mục này PHẢI chứa `model.onnx` (~449 MB) + `tokenizer.json` (đã có sẵn) **TRƯỚC khi** chạy
`make vespa-deploy`. AI không thể emit file binary >100MB từ sandbox → generate theo quy trình dưới.

## Vì sao cần model này

Rank-profile `cross_encoder_rerank` (kế thừa `ai_augmented`) dùng **global-phase** rerank top-30
ứng viên bằng logit của cross-encoder. Model ONNX BẮT BUỘC có: **input** `input_ids` + `attention_mask`,
**output** `logits` (product.sd đọc `onnx(cross_encoder_rerank).logits{d0:0, d1:0}`). Tokenizer
`tokenizer.json` đã commit sẵn (dùng chung với component `cross_encoder_tokenizer` trong services.xml).

## Prerequisites

- Python `>=3.11, <3.13` (verified 3.12.x)
- ~3 GB đĩa trống (venv ~2GB + model.onnx ~449MB)
- Internet ổn định (~500MB tải snapshot Hugging Face lần đầu)
- Có thể tái dùng venv đã tạo cho CLIP

## Procedure (1:1)

### Step 1 — venv (Ubuntu 23.04+ PEP 668)

Tái dùng venv CLIP, hoặc tạo mới:

```bash
python3 -m venv ~/icp-onnx-venv
source ~/icp-onnx-venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install --index-url https://download.pytorch.org/whl/cpu torch
pip install "optimum[onnxruntime]>=1.20" "transformers>=4.40" "onnx>=1.15"
```

> Cross-encoder là HF `AutoModelForSequenceClassification` thuần → **KHÔNG** cần
> `--library-name sentence_transformers` (khác CLIP). Dùng export `transformers` mặc định.

### Step 2 — Export ONNX (task text-classification)

```bash
cd infra/vespa/models/cross_encoder_rerank

optimum-cli export onnx \
  --task text-classification \
  -m cross-encoder/mmarco-mMiniLMv2-L12-H384-v1 \
  .
```

`.` cuối ghi output vào chính thư mục này. Runtime ~2–4 phút (lần đầu tải snapshot về cache).

## Expected output files

```
infra/vespa/models/cross_encoder_rerank/
├── EXPORT.md                  (file này — committed)
├── model.onnx                 (~449MB — NOT committed, gitignore)
├── tokenizer.json             (đã commit sẵn — XLM-RoBERTa)
├── config.json                (đã commit sẵn)
├── special_tokens_map.json    (đã commit sẵn)
└── tokenizer_config.json      (đã commit sẵn)
```

## Verification (BẮT BUỘC)

### 1. Tên input/output

```bash
python -c "
import onnx; m = onnx.load('model.onnx')
print('IN :', [i.name for i in m.graph.input])
print('OUT:', [o.name for o in m.graph.output])
print('opset:', m.opset_import[0].version)
"
```

**Kỳ vọng:**
```
IN : ['input_ids', 'attention_mask']
OUT: ['logits']
```

⚠️ **Xử lý sai khác:**
- IN có thêm **`token_type_ids`** → product.sd hiện chỉ feed input_ids+attention_mask. XLM-RoBERTa
  (`type_vocab_size=1`) thường không cần; nếu export ra có → thêm function feed token_type_ids (tensor 0)
  trong product.sd HOẶC export lại bỏ input thừa.
- OUT không tên `logits` (vd `output_0`) → sửa product.sd `rerank_score()` cho khớp, hoặc map output
  trong khối `onnx-model`.

### 2. Sanity rerank

```bash
python -c "
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
mid='cross-encoder/mmarco-mMiniLMv2-L12-H384-v1'
tok=AutoTokenizer.from_pretrained(mid); mdl=AutoModelForSequenceClassification.from_pretrained(mid)
def score(q,d):
    x=tok(q,d,return_tensors='pt',truncation=True,max_length=256)
    return mdl(**x).logits[0].item()
print('relevant   :', round(score('đồ cay ăn phở','Tương ớt Chin-su vị cay'),3))
print('irrelevant :', round(score('đồ cay ăn phở','Muối tinh I-ốt Bạc Liêu'),3))
# Kỳ vọng: relevant > irrelevant (logit THÔ, có thể âm — KHÔNG phải xác suất 0..1)
"
```

> Output cross-encoder là **logit thô** (âm được). Đây là gốc việc badge match-% ở /intent-03 hiện
> số lạ (vd -482%): MCP `_extract_match_score`/`_build_yql` chưa nhận diện profile `cross_encoder_rerank`
> + FE normalize chưa đúng. Là **known issue backlog S-04**, KHÔNG phải lỗi model.

## Storage / packaging

Giống CLIP: `model.onnx` gitignored, **không** Git LFS, **không** bind-mount. `infra/vespa/deploy.sh`
zip thư mục `models/` → upload qua config server lúc `make vespa-deploy`.

⚠️ **`deploy.max-size`:** CLIP (~516MB) + cross-encoder (~449MB) ≈ **~990MB** zip > mặc định Vespa
`deploy.max-size = 500MB` → **phải tăng** trước deploy. Heap Vespa đã set 2–6GB trong docker-compose.yml.

## Troubleshooting

| Triệu chứng | Nguyên nhân | Fix |
|---|---|---|
| `externally-managed-environment` | Ubuntu PEP 668 | dùng venv (Step 1) |
| OUT không có `logits` | optimum đặt tên khác | sửa product.sd `rerank_score()` cho khớp / map output |
| IN có `token_type_ids` thừa | export sinh thêm input | feed tensor 0 trong product.sd hoặc export bỏ input |
| Vespa `Cannot find model file` | chưa tạo / chưa zip | tạo model trước; kiểm deploy.sh zip `models/` |
| deploy lỗi 413/size | zip ~990MB > 500MB | tăng `deploy.max-size` config server |
| `onnx_wrapper ... 'long' bound to 'float' lossy` | type coercion | lành tính với token-ID, bỏ qua |

## Cross-references

- Mẫu gốc: `infra/vespa/models/clip_multilingual/EXPORT.md`
- Schema: `infra/vespa/schemas/product.sd` (`onnx-model cross_encoder_rerank` + rank-profile)
- Tokenizer component: `infra/vespa/services.xml` (`<component id="cross_encoder_tokenizer">`)
- Vespa docs: https://docs.vespa.ai/en/cross-encoders.html
- Known issue match-%: README.md mục 6.1 + `slices/S-08_decisions-log.md` §3 [7]

## Update Log

- **v1 (Phiên Sx08-K 2026-05-29)** — NEW. Lấp khoảng trống (CLIP có EXPORT.md, cross-encoder không).
  Quy trình suy ra theo mẫu CLIP + định danh model trong product.sd/services.xml + config.json.
  Cần verify input/output ONNX khớp product.sd trước deploy.
