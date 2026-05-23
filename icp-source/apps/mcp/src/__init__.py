# =============================================================================
# apps/mcp/src/__init__.py — ICP MCP package marker
# =============================================================================
# Maps to package name `mcp` via setuptools.package-dir in pyproject.toml.
# Exposes __version__ for /health endpoint reporting + future build metadata.
#
# KI-T03-8 lesson: pad explicit content (NOT empty file) so save-time corruption
# is visible immediately. Empty __init__.py risks silent truncation on file
# transfer (observed Phiên 24 across multiple smoke iterations).
# =============================================================================

__version__ = "0.0.1"
__service__ = "mcp"
