#!/usr/bin/env python3
"""apply-Sx05-2-batch-2.py — ai.client.ts PostIntentBody hint + PostIntentResumeBody choice extend.

S-05 T02 Phiên Sx05-2b — Backend Services Layer.

Target:
    apps/gateway/src/clients/ai.client.ts (425 LOC > 200, change ~5% → patch
    script per ER-R10 LAW; full-file replace would be 30K tokens overhead).

2 anchor patches:

    Patch 1 (anchor: PostIntentBody.hint type literal at line ~109):
        EXTEND hint type union with +2 S-05 values per C-S05-F Path α LAW.
        Keeps type symmetry with Gateway DTO intent-request.dto.ts (S-05
        emit, this batch).

    Patch 2 (anchor: PostIntentResumeBody.choice type literal at line ~119-126):
        EXTEND choice type union with +4 S-05 values per D-S05-01 + D-S05-03
        LAW (confirm_clear / cancel_clear / resolve_remove / resolve_replace).
        Keeps type symmetry with Gateway DTO intent-action.dto.ts (S-05 emit).

Backup: writes apps/gateway/src/clients/ai.client.ts.bak-Sx05-2b before
        any modification.

Reference:
    - apps/gateway/src/clients/ai.client.ts:106-129 (verified Phiên Sx05-2-DISCOVER)
    - slices/S-05_decisions-log.md C-S05-F Path α + D-S05-01/03 LAW
    - TASK_OPERATING_SYSTEM.md v3.2 ER-R10 LAW (>200 LOC + small change → patch script)
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

TARGET = Path("apps/gateway/src/clients/ai.client.ts")
BACKUP = Path("apps/gateway/src/clients/ai.client.ts.bak-Sx05-2b")

# Patch 1: extend PostIntentBody.hint union with +2 S-05 values.
ANCHOR_1_OLD = """export interface PostIntentBody {
  modality: 'text' | 'image' | 'voice';
  content?: string;
  hint?: 'import' | 'buy' | 'search' | 'recommend';
  /** S-04 NEW per D-S04-03 LAW Adaptive Single Endpoint. */
  mode?: 'ai_augmented' | 'basic_fallback';
}"""

ANCHOR_1_NEW = """export interface PostIntentBody {
  modality: 'text' | 'image' | 'voice';
  content?: string;
  /**
   * S-04 ship: classifier-informational hint (import/buy/search/recommend).
   * S-05 T02 NEW per C-S05-F Path α LAW (Phiên Sx05-2): +2 explicit
   * entry-intent override values dispatching AI service to cart_by_text.py
   * (cart_clear_confirm + cart_view_with_stock_check). Mirrors
   * `intent-request.dto.ts` Zod enum (S-05 emit). Backward-compat:
   * `hint` absent → AI uses S-04 classifier path.
   */
  hint?:
    | 'import'
    | 'buy'
    | 'search'
    | 'recommend'
    | 'cart_clear_confirm'
    | 'cart_view_with_stock_check';
  /** S-04 NEW per D-S04-03 LAW Adaptive Single Endpoint. */
  mode?: 'ai_augmented' | 'basic_fallback';
}"""

# Patch 2: extend PostIntentResumeBody.choice union with +4 S-05 values.
ANCHOR_2_OLD = """export interface PostIntentResumeBody {
  choice:
    | 'accept'
    | 'reject'
    | 'retry_ai'
    | 'continue_basic'
    | 'add_to_cart'
    | 'skip';
  value?: Record<string, unknown>;
  _meta?: { attempt_n: number };
}"""

ANCHOR_2_NEW = """export interface PostIntentResumeBody {
  /**
   * Resume choice for Pattern A interrupt+resume per D-S04-13 LAW + S-05 T02
   * extension per D-S05-01/03 LAW (Phiên Sx05-2 — cart_by_text.py
   * clear_action + stock_action interrupts).
   *
   * Mirrors `intent-action.dto.ts` Zod enum (S-05 emit).
   */
  choice:
    | 'accept'
    | 'reject'
    | 'retry_ai'
    | 'continue_basic'
    | 'add_to_cart'
    | 'skip'
    // S-05 T02 NEW per D-S05-01 + D-S05-03 LAW:
    | 'confirm_clear'
    | 'cancel_clear'
    | 'resolve_remove'
    | 'resolve_replace';
  value?: Record<string, unknown>;
  _meta?: { attempt_n: number };
}"""


def _verify_unique(text: str, anchor: str, name: str) -> None:
    count = text.count(anchor)
    if count == 0:
        print(f"  FAIL — {name}: anchor not found", file=sys.stderr)
        print(f"  First 100 chars: {anchor[:100]!r}", file=sys.stderr)
        sys.exit(1)
    if count > 1:
        print(
            f"  FAIL — {name}: anchor appears {count} times (ambiguous)",
            file=sys.stderr,
        )
        sys.exit(1)
    print(f"  OK   — {name}: anchor unique")


def _check_already_patched(text: str) -> bool:
    return "S-05 T02 NEW per C-S05-F Path α LAW (Phiên Sx05-2)" in text


def main() -> int:
    if not TARGET.exists():
        print(f"FAIL — target file missing: {TARGET}", file=sys.stderr)
        return 1
    text = TARGET.read_text(encoding="utf-8")

    if _check_already_patched(text):
        print(
            f"SKIP — {TARGET} already patched. To re-apply, restore from {BACKUP}."
        )
        return 0

    print(f"=== Pre-patch verify (ER-R2 LAW) on {TARGET} ===")
    _verify_unique(text, ANCHOR_1_OLD, "Patch 1 (PostIntentBody.hint)")
    _verify_unique(text, ANCHOR_2_OLD, "Patch 2 (PostIntentResumeBody.choice)")

    print(f"=== Writing backup to {BACKUP} ===")
    shutil.copy(TARGET, BACKUP)

    print(f"=== Applying 2 patches ===")
    new_text = text.replace(ANCHOR_1_OLD, ANCHOR_1_NEW, 1)
    new_text = new_text.replace(ANCHOR_2_OLD, ANCHOR_2_NEW, 1)
    TARGET.write_text(new_text, encoding="utf-8")
    print("  OK — both patches applied")

    print(f"=== Post-patch verify ===")
    written = TARGET.read_text(encoding="utf-8")
    expected = [
        ("'cart_clear_confirm'", 1),
        ("'cart_view_with_stock_check'", 1),
        ("'confirm_clear'", 1),
        ("'resolve_replace'", 1),
    ]
    all_ok = True
    for marker, count in expected:
        actual = written.count(marker)
        status = "OK" if actual >= count else "FAIL"
        if status == "FAIL":
            all_ok = False
        print(f"  {status} — marker {marker!r}: expected ≥{count}, got {actual}")
    if not all_ok:
        print(f"FAIL — restore from {BACKUP}", file=sys.stderr)
        return 1
    print(f"=== apply-Sx05-2-batch-2.py: 2 patches applied + verified ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
