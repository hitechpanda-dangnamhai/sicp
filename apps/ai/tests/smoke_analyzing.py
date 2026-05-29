#!/usr/bin/env python3
"""S-10 Phần D compile-smoke — structural only (no DB, no LLM, no Redis).

Proves analyzing_by_voices.py imports cleanly and compiles into an 8-node
Pattern A graph with the expected topology. Runtime behaviour is covered by
the live full-chain smoke in Phần K (after main.py dispatch wiring).

Run from apps/ai/:
    PYTHONPATH=. python3 tests/smoke_analyzing.py
"""
from __future__ import annotations

import sys


class _DummyPublisher:
    async def publish_sse(self, *_a, **_k):  # never called at compile time
        return 0


def main() -> int:
    from langgraph.checkpoint.memory import MemorySaver

    from src.graphs.intents.analyzing_by_voices import (
        compile_analyzing_by_voices_graph,
    )

    graph = compile_analyzing_by_voices_graph(MemorySaver(), _DummyPublisher())
    nodes = set(graph.get_graph().nodes)
    expected = {
        "load_context", "speech_transcribe", "classify_analyze",
        "execute_queries", "build_insights", "narrate",
        "save_voice_context", "final",
    }
    missing = expected - nodes
    assert not missing, f"missing nodes: {missing} (got {sorted(nodes)})"
    print(f"nodes OK ({len(expected)}): {sorted(expected)}")
    print("✅ PHẦN D COMPILE SMOKE PASS — analyzing_by_voices 8-node graph compiles")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # noqa: BLE001
        print(f"❌ COMPILE SMOKE FAIL: {type(e).__name__}: {e}")
        sys.exit(1)
