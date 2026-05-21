# =============================================================================
# apps/mcp/src/observability/__init__.py — public re-exports
# =============================================================================

from .logger import get_logger, setup_logger
from .setup import init_otel, shutdown_otel

__all__ = ["init_otel", "shutdown_otel", "setup_logger", "get_logger"]
