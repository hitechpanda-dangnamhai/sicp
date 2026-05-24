# CLIP-multilingual ONNX Model Export Instructions

> **Slice:** S-04 First Product Discovery
> **Task:** T01 (Phiên Sx04-2)
> **LAW:** D-S04-10 (Vespa Native `hugging-face-embedder` CLIP-multilingual-512)
> **Spec source:** `02_DATA_MODEL.md` §2.1 + `S-04-T01_Vespa-NativeEmbed-CuratedSeed-CoPurchase.md` section 4 sub-item C
> **Version:** v4 (Phiên Sx04-2 Bước 4 attempt #4 reality finding — directory rename clip-multilingual → clip_multilingual per Vespa naming constraint)

This directory MUST contain `model.onnx` (~516MB FP32) + `tokenizer.json` (~2.8MB) BEFORE running `make vespa-deploy`. AI cannot emit binary files >100MB from sandbox — generate via the procedure below.

**S-07 forward-compat:** Same model + same procedure produces 512-dim CLIP shared image+text vector space. S-07 vision-buy reuses this directory; no re-export needed.

## Prerequisites

- Python `>=3.10, <3.13` (verified working: Python 3.12.3)
- ~3GB free disk (venv ~2GB + model.onnx 516MB)
- Stable internet (~600MB download from Hugging Face Hub first run)

## Procedure (1:1 step sequence — verified Phiên Sx04-2 Ubuntu 24)

### Step 1 — Create venv (Ubuntu 23.04+ PEP 668 mandate)

Ubuntu 23.04+ blocks `pip install` on system Python (PEP 668 `externally-managed-environment` error). Use a throwaway venv anywhere on disk.

⚠️ **venv location recommendation (Phiên Sx04-2 reality finding):**

Recommended: create venv OUTSIDE `models/` directory to keep deploy zip clean:

```bash
cd ~/icp-onnx-venv          # or any path outside infra/vespa/models/
python3 -m venv .venv-onnx
source .venv-onnx/bin/activate
cd /path/to/icpp/sicp/infra/vespa/models/clip_multilingual   # back to model dir for Step 5 export
```

Acceptable alternative (defense-in-depth): venv inside `models/clip_multilingual/.venv-onnx/`. This works because:
1. Root `.gitignore` matches `.venv/` prefix → not committed
2. `infra/vespa/deploy.sh` v2 has explicit zip exclusion pattern `-x "models/**/.venv*/*"` → not packaged into Vespa application zip

Both options produce identical export results. Outside-models is recommended only for cleanliness — venv consumes ~2GB which can be confusing in `du` output of the model directory.

After activation, your shell prompt prefix becomes `(.venv-onnx)`.

### Step 2 — Upgrade pip + setuptools + wheel

```bash
pip install --upgrade pip setuptools wheel
```

### Step 3 — Install torch CPU-only (avoid 532MB CUDA build)

Default pip resolver pulls `torch` (~532MB with CUDA), but ONNX export only needs CPU torch (~150MB). Install CPU build separately FIRST so the next pip install detects it and skips the CUDA download.

```bash
pip install --index-url https://download.pytorch.org/whl/cpu torch
```

### Step 4 — Install optimum + transformers + sentence-transformers (pinned)

⚠️ **CRITICAL pin:** `sentence-transformers<4.0`. Version 5.x makes `SentenceTransformer.config` a read-only property, which breaks `optimum-cli ... --library-name sentence_transformers` (AttributeError: property 'config' has no setter). Verified working pair: optimum 2.1.0 + sentence-transformers 3.4.1.

```bash
pip install "optimum[onnxruntime]>=1.20" "transformers>=4.40" "sentence-transformers>=2.7,<4.0" "onnx>=1.15"
```

Total install size ~700MB (transformers, tokenizers, onnxruntime, scipy, etc.).

### Step 5 — Run export with the correct library flag

⚠️ **CRITICAL flag:** `--library-name sentence_transformers` (with hyphen between `library` and `name`; underscore in `sentence_transformers`). Using `--library-name transformers` instead exports only the raw XLMRoberta encoder, producing 768-dim output — violates ADR-036 LAW (512-dim).

```bash
optimum-cli export onnx \
  --library-name sentence_transformers \
  --task feature-extraction \
  -m sentence-transformers/clip-ViT-B-32-multilingual-v1 \
  .
```

The final `.` (current directory) writes output files into `infra/vespa/models/clip_multilingual/`.

Expected runtime: ~2-5 min (first run downloads ~600MB model snapshot from Hugging Face Hub to `~/.cache/huggingface/`, then exports + traces to ONNX). Subsequent runs hit cache → ~1 min.

## Expected output files

After successful export, this directory contains:

```
infra/vespa/models/clip_multilingual/
├── EXPORT.md                       (this file — committed)
├── model.onnx                      (~516MB FP32 — NOT committed, in .gitignore)
├── tokenizer.json                  (~2.8MB XLMRoberta multilingual — NOT committed)
├── config.json                     (~500 bytes — committed optional)
├── special_tokens_map.json         (~700 bytes)
├── tokenizer_config.json           (~1.3KB)
├── vocab.txt                       (~996KB XLMRoberta vocab)
└── .venv-onnx/                     (throwaway — gitignored by `.venv/` pattern)
```

## Verification steps

### 1. File existence + size

```bash
ls -lh model.onnx tokenizer.json config.json
# Expected: model.onnx 516M (~540MB), tokenizer.json 2.8M, config.json ~500B
```

### 2. ONNX graph shape sanity check ⚠️ CRITICAL (dim must be 512)

```bash
python -c "
import onnx
m = onnx.load('model.onnx')
print('Inputs:')
for i in m.graph.input:
    print(f'  - {i.name}: {[d.dim_value if d.HasField(\"dim_value\") else d.dim_param for d in i.type.tensor_type.shape.dim]}')
print('Outputs:')
for o in m.graph.output:
    print(f'  - {o.name}: {[d.dim_value if d.HasField(\"dim_value\") else d.dim_param for d in o.type.tensor_type.shape.dim]}')
print(f'IR version: {m.ir_version}, Opset: {m.opset_import[0].version}')
"
```

Expected output:
```
Inputs:
  - input_ids: ['batch_size', 'sequence_length']
  - attention_mask: ['batch_size', 'sequence_length']
Outputs:
  - token_embeddings: ['batch_size', 'sequence_length', 768]
  - sentence_embedding: ['batch_size', 512]    ← 512 CRITICAL, must match product.sd
IR version: 8, Opset: 18
```

⚠️ If `sentence_embedding` shows 768 instead of 512 → Step 5 used wrong `--library-name` flag (must be `sentence_transformers`, NOT `transformers`). Delete files, re-run Step 5.

### 3. Multilingual cosine sanity (Stop Condition 3 per Task Pack section 7)

```bash
python -c "
from sentence_transformers import SentenceTransformer
import numpy as np
m = SentenceTransformer('sentence-transformers/clip-ViT-B-32-multilingual-v1')
e1 = m.encode('nước tương')
e2 = m.encode('soy sauce')
cos = np.dot(e1, e2) / (np.linalg.norm(e1) * np.linalg.norm(e2))
print(f'cosine(nước tương, soy sauce) = {cos:.4f}')
# Stop Condition 3: must be > 0.6. Verified Phiên Sx04-2 result: 0.9595.
"
```

**Note on CLIP cosine baseline:** CLIP text encoder was trained with image-text contrastive loss, not text-text. As a result text-text cosines have a HIGH baseline — unrelated Vietnamese phrases may score ~0.85, while highly related cross-language pairs score ~0.95. What matters is **relative discrimination** (gap between related and unrelated), which Vespa rank profile `ai_augmented` combines with BM25 + trend_score to produce sensible top-k ordering. Do not interpret CLIP text-text cosines as absolute [0,1] semantic similarity.

### 4. Exit venv (optional)

```bash
deactivate
```

The venv stays on disk and can be re-activated later if you need to re-export. Or `rm -rf .venv-onnx/` to free ~2GB disk.

## Storage / distribution strategy

`model.onnx` + `tokenizer.json` are listed in root `.gitignore` (large binary files). Distribution options for team members:

1. **Each dev runs the procedure above once** (recommended for hackathon — simplest, ~5 min one-time including venv setup)
2. CI artifact registry (S3 / GitHub Releases) — defer beyond S-04
3. Git LFS — explicitly NOT used (LFS quota costs)

## Container packaging

Vespa hugging-face-embedder resolves model paths RELATIVE TO THE DEPLOYED APPLICATION PACKAGE (the zip), not the container filesystem. `infra/vespa/deploy.sh` line 39 zip command includes `models/` directory, so model files are packaged inside the application zip + uploaded to Vespa config server at `make vespa-deploy`.

**Do NOT** add bind mount `./infra/vespa/models:/opt/vespa/models` to `docker-compose.yml` — that path would NOT be resolved by Vespa embedder (deviation from D-S04-10 LAW §2.1 spec).

⚠️ **Vespa `deploy.max-size`:** 516MB model.onnx + ~3MB tokenizer + tiny config = ~520MB zip. Vespa config server default `deploy.max-size` is 500MB. If `make vespa-deploy` returns size error: increase limit via Vespa config (defer to operational fix; not S-04 T01 scope).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `error: externally-managed-environment` on pip install | Ubuntu 23.04+ PEP 668 blocks system Python writes | Use venv (Step 1) |
| `optimum-cli: command not found` | optimum not installed or venv not active | Re-activate venv: `source .venv-onnx/bin/activate` |
| `AttributeError: property 'config' of 'SentenceTransformer' object has no setter` | sentence-transformers 5.x + optimum 2.1.0 incompat | Downgrade: `pip install "sentence-transformers<4.0"` (Step 4 pin) |
| ONNX dim = 768 instead of 512 | Step 5 used `--library-name transformers` (only encoder) | Re-run Step 5 with `--library-name sentence_transformers` (full pipeline) |
| `IncompleteRead` during torch download | Network instability, large CUDA wheel | Use torch CPU-only (Step 3 splits this out) |
| `RuntimeError: Failed to find a model card` | Hugging Face Hub down or no internet | Retry; check connectivity |
| Vespa logs `Cannot find embedder model file` at `make vespa-deploy` | Files exist on host but deploy.sh zip didn't include them | Verify deploy.sh line 39 zips `models/`; confirm files exist before running deploy |
| `docker logs icp-vespa` shows OOM at boot | Container memory limit too low for ~150MB ONNX in RAM | Increase Docker memory per Stop Condition 2 Task Pack section 7 |
| Vespa deploy returns 413 / size error | App package zip ~520MB exceeds default deploy.max-size 500MB | Increase Vespa config server `deploy.max-size` (operational) |

## Cross-references

- **LAW spec:** `slices/S-04_decisions-log.md` D-S04-10
- **Data model:** `02_DATA_MODEL.md` §2.1 (Vespa Embedder Component)
- **Task Pack:** `S-04-T01_Vespa-NativeEmbed-CuratedSeed-CoPurchase.md` section 4 sub-item C + section 7 Stop Conditions 2/3
- **services.xml:** `infra/vespa/services.xml` `<component id="clip_multilingual" type="hugging-face-embedder">` block
- **product.sd:** `infra/vespa/schemas/product.sd` `field text_embedding type tensor<float>(x[512])` (must match `sentence_embedding` ONNX output dim)
- **Vespa Engineering Blog:** Jun 2023 Enhancing Embedding Management; Aug 2023 Accelerating Transformer Embedding Retrieval; Apr 2024 Matryoshka + Binary; Jan 2026 Embedding Tradeoffs Quantified

## Update Log

- **v1 (Phiên Sx04-2 Bước 3 emit)** — Initial emit per Task Pack section 4 sub-item C spec. Used `--library transformers` (incorrect — produces 768-dim), missing venv setup, size estimates wrong (150MB vs reality 516MB).
- **v2 (Phiên Sx04-2 Bước 4 pre-smoke)** — 5 reality findings patched: (1) `--library` → `--library-name`; (2) `transformers` → `sentence_transformers` (full pipeline 512-dim); (3) added venv setup steps for Ubuntu PEP 668; (4) pin `sentence-transformers<4.0` (compat with optimum 2.1.0); (5) corrected size estimates (model.onnx 516MB, tokenizer.json 2.8MB); added torch CPU-only split (avoid 532MB CUDA build); added CLIP cosine baseline explanation; expanded troubleshooting from 4 → 9 entries.
- **v3 (Phiên Sx04-2 Bước 4 mid-smoke deploy reality finding)** — Step 1 clarification: venv path recommendation changed to "outside models/ dir" with defense-in-depth note that inside-models is also acceptable because deploy.sh v2 has explicit zip exclusion patterns (`-x "models/**/.venv*/*"`). Triggered by discovery that 1st deploy attempt produced 3.4GB zip (97k files) due to `.venv-onnx/` inclusion → curl `out of memory` failure. Companion patch: `deploy.sh` v1 → v2 (zip exclusion + curl `--upload-file` streaming).
- **v4 (Phiên Sx04-2 Bước 4 attempt #4 reality finding)** — Directory path text fix: `clip-multilingual` → `clip_multilingual` (5 occurrences in this file). Triggered by Vespa schema validation `INVALID_APPLICATION_PACKAGE: directory or file name 'clip-multilingual' is not valid. Please rename this to only contain letters, numbers or underscores.` Vespa auto-derives model identifier from `models/<dir>/` name; hyphens REJECTED, only `[a-zA-Z0-9_]+` allowed. Companion patches: `02_DATA_MODEL.md` §2.1 lines 424-425, 439, 444 + `infra/vespa/services.xml` lines 7, 10, 19, 20, 21, 39, 41, 42, 43 + `infra/vespa/deploy.sh` comments + `.gitignore` patterns + operational `mv` directory rename. NO LAW semantic change — component ID `clip_multilingual` was already underscore-correct; only directory PATH strings fixed.
