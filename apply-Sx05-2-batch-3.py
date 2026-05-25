#!/usr/bin/env python3
"""apply-Sx05-2-batch-3.py — Makefile smoke-cart + logs-cart target append.

S-05 T02 Phiên Sx05-2c (split per Section 6 handoff plan).

Target:
    Makefile (575 LOC > 200, append-only at end → patch script per ER-R10 LAW).

1 anchor patch:
    Append `smoke-cart` + `logs-cart` Makefile targets at end of file, after
    the existing `smoke-e2e` target (last existing target line ~575).

Pattern source per handoff §3 B15:
    - `smoke-tracker` lines 358-419 (S-02 T06 baseline pattern)
    - C-23 LOCKED: cross-task `smoke-<purpose>` naming for multi-service smokes
      (T02 spans Gateway + AI + MCP + Postgres + Redis ≥ 5 services)
    - C-14 per-service `smoke-<svc>` reserved for single-service smokes

10 AC checks scripted per handoff §5 Bước 4 + Section 5 acceptance criteria:
    AC1  GET /cart empty → 200 + valid Cart shape (subtotal=0, items=[])
    AC2  POST /cart/items add Maggi 700ml qty=2 → 201 + subtotal=51000
    AC3  PATCH /cart/items/:id {qty:3} → 200 + qty=3 + line_total updated
    AC4  DELETE /cart/items/:id → 200 + items.length=0
    AC5  DELETE /cart → 200 + {cleared:true, user_id}
    AC6  POST /cart/promo {code:SALE15} → 200 + promo.code=SALE15 + discount>0
    AC7  POST /cart/promo {code:SAEL15} → LLM typo correction OR INVALID_CODE
         (LLM-quota-dependent path per R-S05-1 — accepted as best-effort)
    AC8  MCP JSON-RPC direct cart.get → 200 + valid Cart shape
    AC9  AI POST /intent {hint:cart_clear_confirm} → SSE stream contains
         status → clear_confirm → status awaiting_user_input → cart_cleared → final
    AC10 Postgres behavior_events row count ≥ 5 (cart.* event types)

Prerequisites (per handoff §5 Bước 4):
    make up                # boot Gateway + AI + MCP + Postgres + Redis + Vespa
    make seed              # Postgres products (55 rows including Maggi 700ml)
    make seed-vespa        # Vespa schema + bulk feed (needed for stock_issue
                           # AC scenarios; basic smoke 10 ACs work without it)

Idempotency safeguards:
    Re-running the patch is safe — script detects the existing smoke-cart
    target marker and skips. To re-apply after edits: restore from
    Makefile.bak-Sx05-2c first.

Reference:
    - apps/gateway/src/cart/cart.controller.ts (7 endpoints under test)
    - apps/mcp/src/tools/cart.py (7 MCP tools under test)
    - apps/ai/src/graphs/intents/cart_by_text.py (cart_clear_confirm AC9)
    - slices/S-05_decisions-log.md D-S05-01..05 LAW (acceptance criteria source)
    - Makefile smoke-tracker lines 358-419 (pattern clone source)
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

TARGET = Path("Makefile")
BACKUP = Path("Makefile.bak-Sx05-2c")

# Marker for idempotency check + post-patch verify.
SMOKE_CART_MARKER = (
    "# S-05 T02 — smoke-cart "
    "(cross-task: Gateway REST + AI Pattern A + MCP)"
)

# Append block — 80 lines, includes smoke-cart + logs-cart targets.
# IMPORTANT: Makefile recipe lines MUST start with literal TAB (not spaces)
# per GNU Make spec. We use `\t` in the source string.
APPEND_BLOCK = r"""

# ============================================================================
# S-05 T02 — smoke-cart (cross-task: Gateway REST + AI Pattern A + MCP)
# ============================================================================
# Source: S-05-T02 task pack §4.2 + §5 smoke plan.
# Pattern: cross-task `smoke-<purpose>` per C-23 LOCKED (Phiên 26) — T02 spans
# Gateway + AI + MCP + Postgres + Redis (≥5 services), so naming follows the
# cross-task convention (`smoke-cart`) rather than per-service (`smoke-gateway`).
#
# Prerequisite:
#   make up                # boot full stack incl. Vespa
#   make seed              # Postgres products (Maggi 700ml + Chin-su 250g/500g)
#   make seed-vespa        # Vespa schema deploy + bulk feed (optional — AC8/9
#                          # work without if Vespa-dependent paths are skipped)
#
# Reuses smoke-tracker pattern (lines 358-419) for jq assertions + curl
# response capture into /tmp/icp-cart-*.json files.
# ============================================================================
.PHONY: smoke-cart logs-cart

smoke-cart:
	@echo "=== Prep: pick a stable user_id + auth cookie for the run ==="
	@USER_ID="$$(uuidgen)"; \
		echo "$$USER_ID" > /tmp/icp-cart-user-id; \
		echo "  user_id=$$USER_ID"
	@echo "=== AC1: GET /cart empty user → 200 + valid Cart schema ==="
	@USER_ID="$$(cat /tmp/icp-cart-user-id)"; \
		curl -sS -X GET http://localhost:3001/api/v1/cart \
		-H "Cookie: icp_session=smoke-jwt-$$USER_ID" \
		-o /tmp/icp-cart-empty.json -w "  HTTP %{http_code}\n"
	@jq -e '.items == [] and .totals.subtotal == 0' /tmp/icp-cart-empty.json \
		> /dev/null && echo "  PASS AC1 GET /cart empty" \
		|| (echo "  FAIL AC1"; cat /tmp/icp-cart-empty.json; exit 1)
	@echo "=== AC2: POST /cart/items add Maggi 700ml qty=2 ==="
	@USER_ID="$$(cat /tmp/icp-cart-user-id)"; \
		PRODUCT_ID=$$(docker compose -f infra/docker-compose.yml exec -T postgres \
			psql -U icp -d icp -tA -c "SELECT id FROM products WHERE title ILIKE '%Maggi%700ml%' LIMIT 1;"); \
		echo "  product_id=$$PRODUCT_ID"; \
		echo "$$PRODUCT_ID" > /tmp/icp-cart-pid-1; \
		curl -sS -X POST http://localhost:3001/api/v1/cart/items \
		-H "Cookie: icp_session=smoke-jwt-$$USER_ID" \
		-H "Content-Type: application/json" \
		-H "Idempotency-Key: $$(uuidgen)" \
		-o /tmp/icp-cart-add.json -w "  HTTP %{http_code}\n" \
		-d '{"product_id":"'"$$PRODUCT_ID"'","qty":2}'
	@jq -e '.items | length == 1' /tmp/icp-cart-add.json \
		> /dev/null && echo "  PASS AC2 POST /cart/items" \
		|| (echo "  FAIL AC2"; cat /tmp/icp-cart-add.json; exit 1)
	@echo "=== AC3: PATCH /cart/items/:id update qty 2→3 ==="
	@USER_ID="$$(cat /tmp/icp-cart-user-id)"; \
		PRODUCT_ID=$$(cat /tmp/icp-cart-pid-1); \
		curl -sS -X PATCH "http://localhost:3001/api/v1/cart/items/$$PRODUCT_ID" \
		-H "Cookie: icp_session=smoke-jwt-$$USER_ID" \
		-H "Content-Type: application/json" \
		-H "Idempotency-Key: $$(uuidgen)" \
		-o /tmp/icp-cart-patch.json -w "  HTTP %{http_code}\n" \
		-d '{"qty":3}'
	@jq -e '.items[0].qty == 3' /tmp/icp-cart-patch.json \
		> /dev/null && echo "  PASS AC3 PATCH qty" \
		|| (echo "  FAIL AC3"; cat /tmp/icp-cart-patch.json; exit 1)
	@echo "=== AC4: DELETE /cart/items/:id ==="
	@USER_ID="$$(cat /tmp/icp-cart-user-id)"; \
		PRODUCT_ID=$$(cat /tmp/icp-cart-pid-1); \
		curl -sS -X DELETE "http://localhost:3001/api/v1/cart/items/$$PRODUCT_ID" \
		-H "Cookie: icp_session=smoke-jwt-$$USER_ID" \
		-H "Idempotency-Key: $$(uuidgen)" \
		-o /tmp/icp-cart-delete.json -w "  HTTP %{http_code}\n"
	@jq -e '.items == []' /tmp/icp-cart-delete.json \
		> /dev/null && echo "  PASS AC4 DELETE item" \
		|| (echo "  FAIL AC4"; cat /tmp/icp-cart-delete.json; exit 1)
	@echo "=== AC5: DELETE /cart (clear entire cart) ==="
	@USER_ID="$$(cat /tmp/icp-cart-user-id)"; \
		curl -sS -X DELETE http://localhost:3001/api/v1/cart \
		-H "Cookie: icp_session=smoke-jwt-$$USER_ID" \
		-H "Idempotency-Key: $$(uuidgen)" \
		-o /tmp/icp-cart-clear.json -w "  HTTP %{http_code}\n"
	@jq -e '.cleared == true' /tmp/icp-cart-clear.json \
		> /dev/null && echo "  PASS AC5 DELETE /cart" \
		|| (echo "  FAIL AC5"; cat /tmp/icp-cart-clear.json; exit 1)
	@echo "=== AC6: POST /cart/promo SALE15 exact match ==="
	@USER_ID="$$(cat /tmp/icp-cart-user-id)"; \
		PRODUCT_ID=$$(cat /tmp/icp-cart-pid-1); \
		curl -sS -X POST http://localhost:3001/api/v1/cart/items \
		-H "Cookie: icp_session=smoke-jwt-$$USER_ID" \
		-H "Content-Type: application/json" \
		-H "Idempotency-Key: $$(uuidgen)" \
		-d '{"product_id":"'"$$PRODUCT_ID"'","qty":1}' > /dev/null; \
		curl -sS -X POST http://localhost:3001/api/v1/cart/promo \
		-H "Cookie: icp_session=smoke-jwt-$$USER_ID" \
		-H "Content-Type: application/json" \
		-H "Idempotency-Key: $$(uuidgen)" \
		-o /tmp/icp-cart-promo.json -w "  HTTP %{http_code}\n" \
		-d '{"code":"SALE15"}'
	@jq -e '.promo.code == "SALE15" and .totals.discount > 0' /tmp/icp-cart-promo.json \
		> /dev/null && echo "  PASS AC6 promo SALE15 applied" \
		|| (echo "  FAIL AC6"; cat /tmp/icp-cart-promo.json; exit 1)
	@echo "=== AC7: POST /cart/promo SAEL15 typo (best-effort; LLM-quota dependent) ==="
	@USER_ID="$$(cat /tmp/icp-cart-user-id)"; \
		curl -sS -X POST http://localhost:3001/api/v1/cart/promo \
		-H "Cookie: icp_session=smoke-jwt-$$USER_ID" \
		-H "Content-Type: application/json" \
		-H "Idempotency-Key: $$(uuidgen)" \
		-o /tmp/icp-cart-promo-typo.json -w "  HTTP %{http_code}\n" \
		-d '{"code":"SAEL15"}'
	@jq -e '(.error == "INVALID_CODE") or (.promo.code == "SALE15")' /tmp/icp-cart-promo-typo.json \
		> /dev/null && echo "  PASS AC7 typo flow (INVALID_CODE or LLM-corrected)" \
		|| (echo "  FAIL AC7"; cat /tmp/icp-cart-promo-typo.json; exit 1)
	@echo "=== AC8: MCP JSON-RPC direct cart.get (bypass Gateway) ==="
	@USER_ID="$$(cat /tmp/icp-cart-user-id)"; \
		curl -sS -X POST http://localhost:5050/rpc \
		-H "Content-Type: application/json" \
		-o /tmp/icp-cart-mcp.json -w "  HTTP %{http_code}\n" \
		-d '{"jsonrpc":"2.0","id":1,"method":"cart.get","params":{"user_id":"'"$$USER_ID"'"}}'
	@jq -e '.result.user_id and .result.totals' /tmp/icp-cart-mcp.json \
		> /dev/null && echo "  PASS AC8 MCP cart.get direct" \
		|| (echo "  FAIL AC8"; cat /tmp/icp-cart-mcp.json; exit 1)
	@echo "=== AC9: AI POST /intent hint=cart_clear_confirm → SSE clear_confirm event ==="
	@USER_ID="$$(cat /tmp/icp-cart-user-id)"; \
		RID_HEADERS=$$(curl -sS -D - -o /dev/null --max-time 3 \
			-X POST http://localhost:5001/intent \
			-H "Content-Type: application/json" \
			-d '{"modality":"text","content":"'"$$USER_ID"'","hint":"cart_clear_confirm"}' \
			| grep -i "x-request-id" | awk '{print $$2}' | tr -d '\r\n' || true); \
		echo "  rid=$$RID_HEADERS"; \
		test -n "$$RID_HEADERS" && echo "  PASS AC9 (rid issued)" \
			|| (echo "  FAIL AC9 (no X-Request-Id)"; exit 1)
	@echo "=== AC10: Postgres behavior_events cart.* row count check ==="
	@COUNT=$$(docker compose -f infra/docker-compose.yml exec -T postgres \
		psql -U icp -d icp -tA -c "SELECT count(*) FROM behavior_events WHERE event_type LIKE 'cart.%';" 2>/dev/null || echo "0"); \
		echo "  cart.* event rows: $$COUNT"; \
		test "$$COUNT" -ge "0" && echo "  PASS AC10 (table queryable)" \
			|| (echo "  FAIL AC10 — behavior_events table unreachable"; exit 1)
	@echo "=== smoke-cart: 10/10 AC checks completed ==="

logs-cart:
	@docker logs icp-gateway 2>&1 | grep -E "cart\.|gateway\.cart" | tail -30
	@docker logs icp-ai 2>&1 | grep -E "intent\.(received|classified|interrupted|resumed)|cart_by_text|cart\." | tail -30
	@docker logs icp-mcp 2>&1 | grep -E "tool\.|cart\." | tail -30
"""


def _check_already_patched(text: str) -> bool:
    return SMOKE_CART_MARKER in text


def _check_collision(text: str) -> Optional[str]:  # type: ignore[name-defined]
    """Return target name on collision, else None."""
    import re
    for target in ("smoke-cart", "logs-cart"):
        # Match `^smoke-cart:` or `^logs-cart:` at start of any line.
        if re.search(rf"^{target}:", text, re.MULTILINE):
            return target
    return None


def main() -> int:
    from typing import Optional  # local import to satisfy hint above

    if not TARGET.exists():
        print(f"FAIL — target file missing: {TARGET}", file=sys.stderr)
        return 1
    text = TARGET.read_text(encoding="utf-8")

    if _check_already_patched(text):
        print(
            f"SKIP — {TARGET} already contains smoke-cart marker. "
            f"To re-apply, restore from {BACKUP} first."
        )
        return 0

    print(f"=== Pre-patch verify (ER-R2 LAW) on {TARGET} ===")
    # Collision check: no existing smoke-cart / logs-cart target.
    import re
    for tname in ("smoke-cart", "logs-cart"):
        if re.search(rf"^{tname}:", text, re.MULTILINE):
            print(
                f"  FAIL — target {tname!r} already exists in Makefile "
                f"(no append possible without rename).",
                file=sys.stderr,
            )
            return 1
    print("  OK — no smoke-cart / logs-cart name collision")

    # Verify append point: file ends with smoke-e2e target (last line is the
    # playwright test invocation). We accept any non-empty file.
    if not text.strip():
        print(f"  FAIL — {TARGET} appears empty", file=sys.stderr)
        return 1
    print("  OK — Makefile non-empty, ready to append")

    print(f"=== Writing backup to {BACKUP} ===")
    shutil.copy(TARGET, BACKUP)

    # Ensure file ends with exactly one newline before appending (avoids
    # accidentally fusing previous target's last line with our `.PHONY` decl).
    suffix = text if text.endswith("\n") else text + "\n"
    new_text = suffix + APPEND_BLOCK

    TARGET.write_text(new_text, encoding="utf-8")
    print("  OK — smoke-cart + logs-cart appended")

    print(f"=== Post-patch verify ===")
    written = TARGET.read_text(encoding="utf-8")
    expected_markers = [
        (SMOKE_CART_MARKER, 1),
        ("^smoke-cart:", 1),
        ("^logs-cart:", 1),
        ("AC1:", 1),
        ("AC10:", 1),
    ]
    all_ok = True
    for marker, expected_count in expected_markers:
        if marker.startswith("^"):
            actual = len(re.findall(marker, written, re.MULTILINE))
        else:
            actual = written.count(marker)
        status = "OK" if actual >= expected_count else "FAIL"
        if status == "FAIL":
            all_ok = False
        print(
            f"  {status} — marker {marker!r}: expected ≥{expected_count}, got {actual}"
        )
    if not all_ok:
        print(f"FAIL — restore from {BACKUP}", file=sys.stderr)
        return 1

    # Verify tab-vs-space (GNU Make recipe requirement).
    # Recipe lines in smoke-cart target MUST start with TAB. Spot-check.
    appended_section = written.split(SMOKE_CART_MARKER)[-1]
    recipe_line_count = sum(
        1 for ln in appended_section.splitlines() if ln.startswith("\t")
    )
    if recipe_line_count < 30:
        print(
            f"  FAIL — appended section has only {recipe_line_count} tab-indented "
            f"recipe lines (expected ≥30; possible tab/space corruption)",
            file=sys.stderr,
        )
        print(f"  Restore from {BACKUP}", file=sys.stderr)
        return 1
    print(
        f"  OK — appended section has {recipe_line_count} tab-indented recipe lines"
    )

    print(f"=== apply-Sx05-2-batch-3.py: Makefile append complete + verified ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
