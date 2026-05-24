"""Prompt loader utility for LLM prompts.

S-04 T02 (Phiên Sx04-5): 4 prompt template files live in this directory as
.txt files (separate from .py to allow non-engineers to iterate without
Python knowledge):

    detect_typo.txt            — Variant B typo detection (mockup
                                 intent-03B-state-F-typo.html target)
    generate_understanding.txt — Variant B semantic interpretation
                                 (mockup intent-03B-state-0-happy.html L158)
    parse_filters.txt          — Both modes cross-language category detection
                                 (Q-Sx04-3-1 LAW)
    generate_reasons.txt       — Variant B per-product reason chip
                                 (mockup L196 target ≤60 chars Vietnamese)

`load_prompt(name)` reads the file ONCE at first call and caches the text
in process memory. Format placeholders use Python str.format syntax:
    e.g. detect_typo.txt contains "{query}" → caller does
         load_prompt("detect_typo").format(query=state["content"])

Reference:
    - slices/S-04_decisions-log.md D-S04-14 LAW Q-Sx04-4-2 (Gemini prompt design)
    - docs/04_INTENT_SPECS.md Intent 03 LLM node specs
    - Mockup HTMLs lines listed in module docstrings of each .txt
"""

from __future__ import annotations

from pathlib import Path

_PROMPTS_DIR = Path(__file__).parent
_CACHE: dict[str, str] = {}


def load_prompt(name: str) -> str:
    """Load a prompt template by name (sans extension).

    Args:
        name: Bare filename without .txt extension (e.g. "detect_typo").

    Returns:
        Prompt template text. First call reads file from disk; subsequent
        calls return cached value.

    Raises:
        FileNotFoundError: when {name}.txt doesn't exist in this directory.
    """
    if name in _CACHE:
        return _CACHE[name]

    path = _PROMPTS_DIR / f"{name}.txt"
    if not path.exists():
        raise FileNotFoundError(f"Prompt template not found: {path}")

    text = path.read_text(encoding="utf-8")
    _CACHE[name] = text
    return text


__all__ = ["load_prompt"]
