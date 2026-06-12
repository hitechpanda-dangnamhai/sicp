# RUNBOOK — Rotate LLM API keys (Gemini / OpenAI)

> Scope: `.env` keys `GEMINI_API_KEY` + `OPENAI_API_KEY` (gitignored, KHÔNG tracked).
> ⚠️ TUYỆT ĐỐI không paste giá trị key vào commit / log / ticket / chat.
> Secret manager thật = C8 (file này là tạm tới đó).

## Khi nào rotate
- Key lộ (audit output, log, screen-share) · nghi compromise · định kỳ 90 ngày.

## Các bước (≤5 phút)
1. **Tạo key mới** tại console provider: Gemini → aistudio.google.com/apikey ·
   OpenAI → platform.openai.com/api-keys.
2. **Thay vào `.env`** (host chạy compose): `GEMINI_API_KEY=<mới>` /
   `OPENAI_API_KEY=<mới>`. KHÔNG commit `.env`.
3. **Restart** service đọc key: `docker compose up -d ai mcp` (re-inject env_file).
4. **Smoke** 1 intent text → SSE trả lời (xác nhận key mới sống).
5. **REVOKE key cũ** tại console provider (xoá/disable) — **bắt buộc**, nếu không
   key lộ vẫn dùng được. Xác nhận key cũ trả 401 trước khi đóng runbook.
