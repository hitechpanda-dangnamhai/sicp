#!/usr/bin/env python3
"""apply-Sx05-2-batch-1.py — main.py 4-anchor patch per ER-R10 LAW.

S-05 T02 Phiên Sx05-2b — Backend Services Layer.

Targets:
    apps/ai/src/main.py (601 LOC > 200, change ~5% → patch script REQUIRED).

4 anchor patches:

    Patch 1 (anchor: line 480 `mode = payload.get("mode", "ai_augmented")`):
        ADD entry_intent extraction from payload.hint after mode extraction.

    Patch 2 (anchor: line 494 initial_state dict opening):
        ADD entry_intent field in initial_state dict.

    Patch 3 (anchor: line 301 `graph = compile_searching_by_text_graph(saver, publisher)`
             inside _drive_graph_async):
        REPLACE single-line hard-coded compile with if-elif dispatch on
        initial_state.entry_intent (cart_by_text vs searching_by_text).

    Patch 4 (anchor: line 393 same hard-coded compile inside _drive_graph_resume_async):
        REPLACE with same dispatch logic, reading entry_intent from
        checkpoint-restored state via async-friendly saver.aget peek.

Defensive verify pre-patch:
    - All 4 anchor strings present + uniquely identifiable in target file.
    - Counts match expected post-patch (idempotent — re-run is safe with backup).

Backup: writes apps/ai/src/main.py.bak-Sx05-2b before any modification.

Per Phiên Sx04-7 saver lifecycle fix LAW:
    The lazy import `from .graphs.intents.cart_by_text import
    compile_cart_by_text_graph` is INSIDE the if-elif branch (not at module
    top) — defers cart_by_text module load until first cart_clear_confirm or
    cart_view_with_stock_check request fires. Avoids import-time side effects
    polluting main.py.

Usage:
    # From repo root
    python3 apply-Sx05-2-batch-1.py

Idempotent re-run protection:
    Script aborts if the patched markers already exist (avoids double-patch).
    To re-run after partial failure: restore from .bak-Sx05-2b first.

Reference:
    - slices/S-05_decisions-log.md D-S05-01 + C-S05-F Path α resolution
    - apps/ai/src/main.py:301 + :393 (4 anchors verified Phiên Sx05-2-DISCOVER)
    - TASK_OPERATING_SYSTEM.md v3.2 ER-R10 LAW (>200 LOC file = patch script
      mandatory for change <30%)
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

TARGET = Path("apps/ai/src/main.py")
BACKUP = Path("apps/ai/src/main.py.bak-Sx05-2b")

# ---------------------------------------------------------------------------
# Anchor specifications (verified Phiên Sx05-2-DISCOVER + re-verified Sx05-2b)
# ---------------------------------------------------------------------------

# Patch 1: ADD entry_intent extraction after mode extraction.
ANCHOR_1_OLD = """            # S-04 NEW: mode field defaults to 'ai_augmented' per D-S04-03 LAW.
            mode = payload.get("mode", "ai_augmented")
            span.set_attribute("ai.modality", modality)
            span.set_attribute("ai.mode", mode)"""

ANCHOR_1_NEW = """            # S-04 NEW: mode field defaults to 'ai_augmented' per D-S04-03 LAW.
            mode = payload.get("mode", "ai_augmented")
            # S-05 T02 NEW (Phiên Sx05-2 per C-S05-F Path α + D-S05-01 LAW):
            # Extract optional hint field as entry_intent for graph dispatch.
            # Allowed values: 'cart_clear_confirm', 'cart_view_with_stock_check'.
            # Backward-compat: hint absent/other values → classifier-driven
            # default search flow (S-04 router_graph heuristic).
            entry_intent = payload.get("hint") if isinstance(
                payload.get("hint"), str
            ) else None
            span.set_attribute("ai.modality", modality)
            span.set_attribute("ai.mode", mode)
            if entry_intent:
                span.set_attribute("ai.entry_intent", entry_intent)"""

# Patch 2: ADD entry_intent into initial_state dict (target ~line 494).
ANCHOR_2_OLD = """            initial_state: dict[str, Any] = {
                "request_id": request_id,
                "modality": modality,
                "content": content,
                "mode": mode,
                "attempt_n": 1,
                "first_card_emitted": False,
                "intent": None,
                "confidence": None,
                "trace_id": format(span.get_span_context().trace_id, "032x"),
            }"""

ANCHOR_2_NEW = """            initial_state: dict[str, Any] = {
                "request_id": request_id,
                "modality": modality,
                "content": content,
                "mode": mode,
                "attempt_n": 1,
                "first_card_emitted": False,
                "intent": None,
                "confidence": None,
                "trace_id": format(span.get_span_context().trace_id, "032x"),
                # S-05 T02 NEW per C-S05-F Path α LAW: entry_intent persists in
                # checkpointed state so _drive_graph_resume_async can recover
                # the correct graph compile target on resume (cart vs search).
                "entry_intent": entry_intent,
            }"""

# Patch 3: Replace hard-coded compile inside _drive_graph_async (line ~301).
# Use unique surrounding context to ensure exact-match (this exact string
# appears 3 times in main.py — bak file at line 44, _drive_graph_async at
# line 301, _drive_graph_resume_async at line 393; we patch via context window).
ANCHOR_3_OLD = """                    # ─── End fix ───

                    graph = compile_searching_by_text_graph(saver, publisher)
                    config = {"configurable": {"thread_id": request_id}}
                    async for _chunk in graph.astream(initial_state, config=config):"""

ANCHOR_3_NEW = """                    # ─── End fix ───

                    # S-05 T02 NEW per C-S05-F Path α LAW + D-S05-01 LAW:
                    # Dispatch graph compile target by entry_intent.
                    entry_intent_dispatch = initial_state.get("entry_intent")
                    if entry_intent_dispatch in (
                        "cart_clear_confirm", "cart_view_with_stock_check"
                    ):
                        # Lazy import — defers cart_by_text module load until
                        # first cart entry-intent request fires (avoids
                        # module-import side effects polluting main.py).
                        from .graphs.intents.cart_by_text import (
                            compile_cart_by_text_graph,
                        )
                        graph = compile_cart_by_text_graph(saver, publisher)
                    else:
                        graph = compile_searching_by_text_graph(saver, publisher)
                    config = {"configurable": {"thread_id": request_id}}
                    async for _chunk in graph.astream(initial_state, config=config):"""

# Patch 4: Replace hard-coded compile inside _drive_graph_resume_async (~line 393).
# Distinguished from Patch 3 by surrounding context (Command(resume=...) call).
ANCHOR_4_OLD = """        async def _astream_resume_with_saver() -> None:
            async with AsyncRedisSaver.from_conn_string(
                redis_url, ttl=_SAVER_TTL_CONFIG
            ) as saver:
                await saver.asetup()
                publisher = RedisPublisher(redis_url=redis_url)
                try:
                    graph = compile_searching_by_text_graph(saver, publisher)
                    config = {"configurable": {"thread_id": request_id}}
                    async for _chunk in graph.astream(
                        Command(resume=resume_value), config=config
                    ):"""

ANCHOR_4_NEW = """        async def _astream_resume_with_saver() -> None:
            async with AsyncRedisSaver.from_conn_string(
                redis_url, ttl=_SAVER_TTL_CONFIG
            ) as saver:
                await saver.asetup()
                publisher = RedisPublisher(redis_url=redis_url)
                try:
                    # S-05 T02 NEW per C-S05-F Path α LAW + D-S05-01 LAW:
                    # Peek checkpointed state to recover entry_intent for
                    # correct graph compile target on resume. RedisSaver
                    # persisted state.entry_intent at first node's interrupt;
                    # we read it back before compile.
                    config = {"configurable": {"thread_id": request_id}}
                    entry_intent_dispatch = None
                    try:
                        checkpoint_tuple = await saver.aget_tuple(config)
                        if checkpoint_tuple and checkpoint_tuple.checkpoint:
                            channel_values = (
                                checkpoint_tuple.checkpoint.get("channel_values")
                                or {}
                            )
                            entry_intent_dispatch = channel_values.get(
                                "entry_intent"
                            )
                    except Exception as peek_err:  # noqa: BLE001
                        structlog.get_logger().warning(
                            "intent.resume_peek_failed",
                            request_id=request_id,
                            error=str(peek_err),
                        )
                    if entry_intent_dispatch in (
                        "cart_clear_confirm", "cart_view_with_stock_check"
                    ):
                        from .graphs.intents.cart_by_text import (
                            compile_cart_by_text_graph,
                        )
                        graph = compile_cart_by_text_graph(saver, publisher)
                    else:
                        graph = compile_searching_by_text_graph(saver, publisher)
                    async for _chunk in graph.astream(
                        Command(resume=resume_value), config=config
                    ):"""


# ---------------------------------------------------------------------------
# Patch application logic with verify-before-edit (ER-R2 LAW)
# ---------------------------------------------------------------------------


def _verify_anchor_unique(text: str, anchor: str, name: str) -> None:
    """Abort if anchor not present or appears multiple times (ambiguous)."""
    count = text.count(anchor)
    if count == 0:
        print(f"  FAIL — {name}: anchor not found", file=sys.stderr)
        print(f"  First 100 chars of expected anchor: {anchor[:100]!r}", file=sys.stderr)
        sys.exit(1)
    if count > 1:
        print(
            f"  FAIL — {name}: anchor appears {count} times (ambiguous, "
            f"refine context window)",
            file=sys.stderr,
        )
        sys.exit(1)
    print(f"  OK   — {name}: anchor found exactly once")


def _check_already_patched(text: str) -> bool:
    """Return True if main.py appears to have been patched already.

    Idempotency guard: if any of the post-patch markers exist, skip the
    whole script with a friendly message (rather than corrupting via
    double-patch).
    """
    markers = [
        "S-05 T02 NEW (Phiên Sx05-2 per C-S05-F Path α + D-S05-01 LAW)",
        "entry_intent_dispatch = initial_state.get",
    ]
    return any(m in text for m in markers)


def main() -> int:
    if not TARGET.exists():
        print(f"FAIL — target file missing: {TARGET}", file=sys.stderr)
        return 1
    text = TARGET.read_text(encoding="utf-8")

    if _check_already_patched(text):
        print(
            f"SKIP — {TARGET} already patched (S-05 T02 markers present). "
            f"To re-apply, restore from {BACKUP} first.",
        )
        return 0

    print(f"=== Pre-patch verify (ER-R2 LAW) on {TARGET} ===")
    _verify_anchor_unique(text, ANCHOR_1_OLD, "Patch 1 (entry_intent extract)")
    _verify_anchor_unique(text, ANCHOR_2_OLD, "Patch 2 (initial_state field)")
    _verify_anchor_unique(text, ANCHOR_3_OLD, "Patch 3 (drive_async dispatch)")
    _verify_anchor_unique(text, ANCHOR_4_OLD, "Patch 4 (drive_resume dispatch)")

    print(f"=== Writing backup to {BACKUP} ===")
    shutil.copy(TARGET, BACKUP)

    print(f"=== Applying 4 patches in sequence ===")
    new_text = text
    for i, (old, new, name) in enumerate(
        [
            (ANCHOR_1_OLD, ANCHOR_1_NEW, "Patch 1"),
            (ANCHOR_2_OLD, ANCHOR_2_NEW, "Patch 2"),
            (ANCHOR_3_OLD, ANCHOR_3_NEW, "Patch 3"),
            (ANCHOR_4_OLD, ANCHOR_4_NEW, "Patch 4"),
        ],
        start=1,
    ):
        if old not in new_text:
            print(
                f"  FAIL — {name}: anchor disappeared after earlier patches "
                f"(should not happen; aborting + restore backup)",
                file=sys.stderr,
            )
            shutil.copy(BACKUP, TARGET)
            return 1
        new_text = new_text.replace(old, new, 1)
        print(f"  OK   — {name} applied")

    TARGET.write_text(new_text, encoding="utf-8")
    print(f"=== Post-patch verify ===")
    written = TARGET.read_text(encoding="utf-8")
    expected_markers = [
        ("S-05 T02 NEW (Phiên Sx05-2 per C-S05-F Path α + D-S05-01 LAW)", 1),
        ("compile_cart_by_text_graph(saver, publisher)", 2),
        ('"entry_intent": entry_intent,', 1),
        ("saver.aget_tuple(config)", 1),
    ]
    all_ok = True
    for marker, expected_count in expected_markers:
        actual = written.count(marker)
        status = "OK" if actual >= expected_count else "FAIL"
        if status == "FAIL":
            all_ok = False
        print(
            f"  {status} — marker {marker[:60]!r}: expected ≥{expected_count}, got {actual}"
        )
    if not all_ok:
        print(f"FAIL — post-patch verify failed. Restore from {BACKUP}.", file=sys.stderr)
        return 1
    print(f"=== apply-Sx05-2-batch-1.py: 4 patches applied + verified ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
