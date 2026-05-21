"""MCP JSON-RPC 2.0 client with W3C trace context propagation.

Per:
  - docs/03_API_CONTRACTS.md §5 — MCP tools dùng JSON-RPC 2.0, transport HTTP POST /rpc
  - docs/06_OBSERVABILITY.md §9 — W3C traceparent header propagation cross-service
  - apps/mcp/Dockerfile EXPOSE 5050 + docker-compose service name `mcp`
  - S-02 D-01 — OTLP gRPC for exporter (trace propagation is separate concern, uses
    W3C HTTP headers always — NOT gRPC)

Phase 1 (T03): HTTP client only. T05 will verify Gateway → AI → MCP trace chain
end-to-end via Tempo query. T04 will implement the MCP server side (3 tools).

Usage:
    client = McpClient("http://mcp:5050/rpc")
    result = await client.call("auth.verify_jwt", {"token": "..."})

`call()` automatically:
  - Wraps in OTel span `mcp.client.<method>`.
  - Injects W3C `traceparent` + `tracestate` headers via
    `TraceContextTextMapPropagator.inject()` — this is what binds Gateway's
    trace_id all the way to MCP server span.
  - Raises McpError on JSON-RPC `error` field (per JSON-RPC 2.0 spec).
"""

from __future__ import annotations

import uuid
from typing import Any

import httpx
import structlog
from opentelemetry import trace
from opentelemetry.propagators.textmap import default_setter
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator

_tracer = trace.get_tracer(__name__)
_logger = structlog.get_logger()
_propagator = TraceContextTextMapPropagator()


class McpError(Exception):
    """Raised when MCP server returns a JSON-RPC error object."""

    def __init__(self, code: int, message: str, data: Any | None = None) -> None:
        super().__init__(f"MCP error {code}: {message}")
        self.code = code
        self.message = message
        self.data = data


class McpClient:
    """HTTP JSON-RPC 2.0 client for the MCP tool server (T04 territory).

    Args:
        base_url: Full URL to MCP `/rpc` endpoint (e.g. "http://mcp:5050/rpc").
        timeout_s: HTTP request timeout in seconds (default 10s — Hackathon
                   scope, no streaming).
    """

    def __init__(self, base_url: str, timeout_s: float = 10.0) -> None:
        self._base_url = base_url
        self._timeout = timeout_s
        # httpx auto-instrumentation (from opentelemetry-instrumentation-httpx)
        # also injects traceparent, but we add it explicitly here in _build_headers
        # so the client works correctly even when auto-instrumentation is disabled
        # (e.g. unit tests).
        self._client: httpx.AsyncClient | None = None

    async def _ensure_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self._timeout)
        return self._client

    def _build_headers(self) -> dict[str, str]:
        """Build HTTP headers with W3C trace context injected.

        Returns dict containing at minimum `content-type`; `traceparent` is
        added when an active OTel span exists (else propagator no-ops).
        """
        headers: dict[str, str] = {"content-type": "application/json"}
        # Propagator.inject() reads from current OTel context and writes
        # traceparent + tracestate into the carrier dict.
        _propagator.inject(carrier=headers, setter=default_setter)
        return headers

    async def call(self, method: str, params: dict[str, Any]) -> Any:
        """Invoke an MCP tool via JSON-RPC 2.0.

        Args:
            method: MCP tool name (e.g. "auth.verify_jwt", "events.append").
            params: Tool params dict per docs/03_API_CONTRACTS §5.

        Returns:
            The `result` field of the JSON-RPC response.

        Raises:
            McpError: when response contains `error` field.
            httpx.HTTPStatusError: on non-2xx HTTP status.
            httpx.TimeoutException: on timeout.
        """
        request_id = str(uuid.uuid4())
        payload = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params,
        }

        with _tracer.start_as_current_span(f"mcp.client.{method}") as span:
            span.set_attribute("mcp.method", method)
            span.set_attribute("mcp.request_id", request_id)

            headers = self._build_headers()
            client = await self._ensure_client()

            _logger.debug(
                "mcp.client.request",
                method=method,
                request_id=request_id,
                url=self._base_url,
            )

            response = await client.post(self._base_url, json=payload, headers=headers)
            response.raise_for_status()
            body = response.json()

            if "error" in body and body["error"] is not None:
                err = body["error"]
                _logger.warning(
                    "mcp.client.error",
                    method=method,
                    request_id=request_id,
                    error_code=err.get("code"),
                    error_message=err.get("message"),
                )
                span.set_attribute("mcp.error_code", err.get("code", -1))
                raise McpError(
                    code=err.get("code", -32603),
                    message=err.get("message", "Unknown MCP error"),
                    data=err.get("data"),
                )

            _logger.debug(
                "mcp.client.response",
                method=method,
                request_id=request_id,
                ok=True,
            )
            return body.get("result")

    async def aclose(self) -> None:
        """Close underlying httpx client. Idempotent."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None
