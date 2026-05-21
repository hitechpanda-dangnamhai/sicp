"""IcpState — TypedDict describing LangGraph router state.

Per docs/04_INTENT_SPECS.md Common section + Intent 01-08.

T03 Phase 1 scope: 6 minimal fields needed for router skeleton.
Real subgraphs (Intent 01-08) will EXTEND this with intent-specific fields
when V-SLICE S-04..S-10 build their subgraphs. We use `total=False` so
extensions don't break existing nodes.

Fields:
    request_id:   str — UUID per /intent invocation (gateway-issued in
                  production; AI-issued for direct-call dev).
    modality:     'text' | 'image' | 'voice' — per 03_API_CONTRACTS §1.2.
    content:      str — text body for modality=text; base64 / file ref
                  for image/voice (T03 stub uses text only).
    intent:       Optional[str] — classifier output; "unknown" stub Phase 1
                  per S-02 D-03.
    confidence:   Optional[float] — 0.0..1.0; 0.0 stub Phase 1.
    trace_id:     str — W3C trace_id hex (32 chars) for cross-service
                  correlation; populated from active OTel span.
"""

from __future__ import annotations

from typing import Literal, Optional, TypedDict

Modality = Literal["text", "image", "voice"]


class IcpState(TypedDict, total=False):
    """LangGraph router state. `total=False` allows V-SLICE extensions."""

    request_id: str
    modality: Modality
    content: str
    intent: Optional[str]
    confidence: Optional[float]
    trace_id: str
