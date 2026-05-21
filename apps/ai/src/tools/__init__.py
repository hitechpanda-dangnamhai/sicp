"""MCP client + LangGraph tools.

T03 Phase 1: HTTP JSON-RPC client only (`mcp_client.py`). V-SLICE will add
typed wrappers for individual MCP tools (`auth.verify_jwt`, `events.append`,
`products.get`, ...) per 03_API_CONTRACTS §5.
"""

from .mcp_client import McpClient, McpError

__all__ = ["McpClient", "McpError"]
