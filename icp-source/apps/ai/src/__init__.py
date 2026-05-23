"""ICP AI orchestration service — Flask + LangGraph router + OTel.

Package layout (per docs/phases/PHASE_01_INFRA.md Day 4):
    src/
      __init__.py
      main.py                       Flask app factory
      state.py                      IcpState TypedDict
      observability/
        setup.py                    OTel SDK bootstrap
        logger.py                   structlog 6-field JSON
      graphs/
        router_graph.py             LangGraph router skeleton
      tools/
        mcp_client.py               JSON-RPC client + traceparent inject
"""

__version__ = "0.0.1"
