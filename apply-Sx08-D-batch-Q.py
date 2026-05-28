#!/usr/bin/env python3
# apply-Sx08-D-batch-Q.py
# ---------------------------------------------------------------------------
# C-S08-Q — Voice resolve score field-read bug + ratio-based clarify routing.
#
# Surfaced: Phiên Sx08-D2 Bück 4 smoke (re-run #2). Graph routed to
#   voice_no_match_alts despite matched_count=4. Root cause: _resolve_one read
#   top.get("score"/"relevance") but Vespa hybrid_search returns "match_score".
#   => score always 0.0 => high_count 0 => no_match.
#
# Resolution (user-confirmed Phiên Sx08-D2, Option 2 + ratio variant):
#   FIX-1: read top["match_score"] (with score/relevance fallback for safety).
#   FIX-2: replace absolute-threshold routing (0.85/0.6 on a 0..1 scale that
#          never matched Vespa's 0..~30 scale) with RATIO logic:
#            - top1 < ICP_VOICE_MIN_SCORE (default 4.0)        -> no_match item
#            - candidates[1].match_score / top1 >= RATIO_AMBIG -> ambiguous (clarify)
#            - else                                            -> confident match
#          Applied in both _node_route_resolution and _route_after_resolution.
#
# Empirical basis (live Vespa probe Phiên Sx08-D2):
#   "mì hảo hảo"            23.2/16.4 ratio .70  -> confident
#   "nước tương Maggi 700ml"30.9/16.1 ratio .52  -> confident
#   "nước tương" (20 brand) 7.2/6.97 ratio .96   -> ambiguous -> clarify
#   "dầu ăn"                9.0/8.8  ratio .98    -> ambiguous -> clarify
#   "xyz rác"               7.15/6.93 (low+flat) -> caught by MIN_SCORE/ratio
#
# ER-R10 LAW: anchor-based, idempotent, defensive validation, .bak backup.
# ---------------------------------------------------------------------------
import sys
import shutil
from pathlib import Path

TARGET = Path(
    "/home/hai-dang/projects/icpp/sicp/apps/ai/src/graphs/intents/buying_by_voices.py"
)
BAK = TARGET.with_suffix(TARGET.suffix + ".bak-Sx08-D-Q")

# --- Anchors (verbatim from source, verified Phiên Sx08-D2 ER-R2) -----------

# FIX-1: score field read inside _resolve_one (line ~691)
A1_OLD = '        top = hits[0]\n        score = float(top.get("score", top.get("relevance", 0.0)) or 0.0)\n'
A1_NEW = (
    '        top = hits[0]\n'
    '        # C-S08-Q FIX: Vespa hybrid_search returns "match_score" (not\n'
    '        # "score"/"relevance"). Prior code read missing keys => 0.0 =>\n'
    '        # everything routed to no_match. Read match_score first.\n'
    '        score = float(\n'
    '            top.get("match_score", top.get("score", top.get("relevance", 0.0)))\n'
    '            or 0.0\n'
    '        )\n'
)

# FIX-2 prerequisite: new constants + helper after the existing threshold consts.
A2_OLD = (
    'MATCH_THRESHOLD_HIGH = float(os.getenv("ICP_VOICE_MATCH_HIGH", "0.85"))\n'
    'MATCH_THRESHOLD_LOW = float(os.getenv("ICP_VOICE_MATCH_LOW", "0.6"))\n'
)
A2_NEW = (
    'MATCH_THRESHOLD_HIGH = float(os.getenv("ICP_VOICE_MATCH_HIGH", "0.85"))\n'
    'MATCH_THRESHOLD_LOW = float(os.getenv("ICP_VOICE_MATCH_LOW", "0.6"))\n'
    '\n'
    '# C-S08-Q (Phiên Sx08-D2): Vespa hybrid_search scores live on a 0..~30\n'
    '# absolute scale, so the 0..1 HIGH/LOW thresholds above never discriminate\n'
    '# (a junk query top1 ~7 looks identical to a valid ambiguous top1 ~7).\n'
    '# Discrimination signal is SEPARATION between top1 and top2, not absolute\n'
    '# value. Per D-S08-NN-10 LAW (env-tunable):\n'
    '#   - top1 < MIN_SCORE                  -> treat item as no_match\n'
    '#   - top2/top1 >= RATIO_AMBIGUOUS      -> ambiguous (clarify chip-row)\n'
    '#   - else                              -> confident match (commit)\n'
    'VOICE_MIN_SCORE = float(os.getenv("ICP_VOICE_MIN_SCORE", "4.0"))\n'
    'VOICE_RATIO_AMBIGUOUS = float(os.getenv("ICP_VOICE_RATIO_AMBIGUOUS", "0.90"))\n'
    '\n'
    '\n'
    'def _voice_match_class(m: dict) -> str:\n'
    '    """Classify a resolved voice item: "match" | "ambiguous" | "no_match".\n'
    '\n'
    '    Ordinal picks (match_score == 1.0 sentinel, single candidate) are\n'
    '    always confident. Otherwise use top1 absolute floor + top2/top1 ratio.\n'
    '    """\n'
    '    top1 = float(m.get("match_score") or 0.0)\n'
    '    cands = m.get("candidates") or []\n'
    '    # Ordinal reference path sets match_score=1.0 with a single candidate;\n'
    '    # treat as confident (no Vespa scale involved).\n'
    '    if m.get("resolution") == "ordinal":\n'
    '        return "match"\n'
    '    if m.get("matched_product") is None or top1 < VOICE_MIN_SCORE:\n'
    '        return "no_match"\n'
    '    top2 = 0.0\n'
    '    if len(cands) >= 2:\n'
    '        top2 = float((cands[1] or {}).get("match_score") or 0.0)\n'
    '    if top1 > 0.0 and (top2 / top1) >= VOICE_RATIO_AMBIGUOUS:\n'
    '        return "ambiguous"\n'
    '    return "match"\n'
)

# FIX-2a: _node_route_resolution decision block.
A3_OLD = (
    '    matched = state.get("voice_matched_products") or []  # type: ignore[typeddict-item]\n'
    '    if not matched:\n'
    '        return {"voice_clarify_pending": False}\n'
    '    high_count = sum(\n'
    '        1 for m in matched if (m.get("match_score") or 0.0) >= MATCH_THRESHOLD_HIGH\n'
    '    )\n'
    '    low_count = sum(\n'
    '        1 for m in matched if (m.get("match_score") or 0.0) < MATCH_THRESHOLD_LOW\n'
    '    )\n'
    '    ambiguous_count = len(matched) - high_count - low_count\n'
    '    # All matched ≥ HIGH threshold → straight to bulk_cart_commit, no interrupt.\n'
    '    if ambiguous_count == 0 and low_count == 0:\n'
    '        return {"voice_clarify_pending": False}\n'
    '    # Mixed path — interrupt for clarify per MAR-1 Q1 LOCKED.\n'
    '    # We collect ambiguous items + their top-N candidates as chip choices.\n'
    '    ambiguous = [\n'
    '        m for m in matched\n'
    '        if MATCH_THRESHOLD_LOW <= (m.get("match_score") or 0.0) < MATCH_THRESHOLD_HIGH\n'
    '    ]\n'
    '    if not ambiguous:\n'
    '        # All low (no_match path) — let downstream conditional handle.\n'
    '        return {"voice_clarify_pending": False}\n'
)
A3_NEW = (
    '    matched = state.get("voice_matched_products") or []  # type: ignore[typeddict-item]\n'
    '    if not matched:\n'
    '        return {"voice_clarify_pending": False}\n'
    '    # C-S08-Q: classify each item via top1 floor + top2/top1 ratio.\n'
    '    classes = [_voice_match_class(m) for m in matched]\n'
    '    ambiguous = [m for m, c in zip(matched, classes) if c == "ambiguous"]\n'
    '    # No ambiguous items → no clarify interrupt (downstream conditional\n'
    '    # routes to commit if any match, else no_match_alts).\n'
    '    if not ambiguous:\n'
    '        return {"voice_clarify_pending": False}\n'
)

# FIX-2b: _route_after_resolution decision.
A4_OLD = (
    '    matched = state.get("voice_matched_products") or []  # type: ignore[typeddict-item]\n'
    '    if not matched:\n'
    '        return "voice_no_match_alts"\n'
    '    high_count = sum(\n'
    '        1 for m in matched if (m.get("match_score") or 0.0) >= MATCH_THRESHOLD_HIGH\n'
    '    )\n'
    '    if high_count > 0:\n'
    '        return "bulk_cart_commit"\n'
    '    return "voice_no_match_alts"\n'
)
A4_NEW = (
    '    matched = state.get("voice_matched_products") or []  # type: ignore[typeddict-item]\n'
    '    if not matched:\n'
    '        return "voice_no_match_alts"\n'
    '    # C-S08-Q: if at least one item is a confident match, commit (ambiguous\n'
    '    # items were handled by clarify interrupt in route_resolution upstream).\n'
    '    match_count = sum(1 for m in matched if _voice_match_class(m) == "match")\n'
    '    if match_count > 0:\n'
    '        return "bulk_cart_commit"\n'
    '    return "voice_no_match_alts"\n'
)

PATCHES = [
    ("FIX-1 score field read", A1_OLD, A1_NEW),
    ("FIX-2 constants + _voice_match_class helper", A2_OLD, A2_NEW),
    ("FIX-2a _node_route_resolution ratio", A3_OLD, A3_NEW),
    ("FIX-2b _route_after_resolution ratio", A4_OLD, A4_NEW),
]

# Idempotency markers — if these already present, patch was applied.
DONE_MARKERS = [
    "C-S08-Q FIX: Vespa hybrid_search returns",
    "def _voice_match_class(m: dict) -> str:",
]


def main() -> int:
    if not TARGET.exists():
        print(f"ERROR: target not found: {TARGET}")
        return 2
    text = TARGET.read_text(encoding="utf-8")

    # Idempotent re-run check.
    if all(mk in text for mk in DONE_MARKERS):
        print("IDEMPOTENT: C-S08-Q markers already present; nothing to do.")
        return 0

    # Anchor uniqueness validation (must appear EXACTLY once each).
    for name, old, _new in PATCHES:
        n = text.count(old)
        if n != 1:
            print(f"ABORT: anchor for [{name}] appears {n}× (need exactly 1).")
            print("       File state differs from expected. No changes written.")
            return 3

    # Backup then apply.
    shutil.copy2(TARGET, BAK)
    print(f"backup: {BAK}")
    for name, old, new in PATCHES:
        text = text.replace(old, new, 1)
        print(f"applied: {name}")

    # Post-apply sanity: markers present, helper defined once, no leftover
    # absolute-threshold routing in the two route sites.
    assert all(mk in text for mk in DONE_MARKERS), "post-apply marker missing"
    assert text.count("def _voice_match_class(m: dict) -> str:") == 1

    TARGET.write_text(text, encoding="utf-8")

    # AST validation.
    import ast
    try:
        ast.parse(text)
    except SyntaxError as e:
        print(f"ERROR: post-patch AST FAILED: {e}. Restoring backup.")
        shutil.copy2(BAK, TARGET)
        return 4

    print("OK: 4 patches applied + AST valid.")
    print(f"new LOC: {len(text.splitlines())}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
