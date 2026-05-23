"""OTel + structlog bootstrap for ICP AI service.

Re-exports for convenient import:
    from src.observability import init_otel, create_logger
"""

from .logger import create_logger
from .setup import init_otel, shutdown_otel

__all__ = ["init_otel", "shutdown_otel", "create_logger"]
