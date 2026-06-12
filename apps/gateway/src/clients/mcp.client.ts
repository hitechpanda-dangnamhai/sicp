/**
 * apps/gateway/src/clients/mcp.client.ts
 *
 * NestJS @Injectable() JSON-RPC 2.0 HTTP client for the ICP MCP service.
 *
 * S-07 T01.E.E3 NEW (Phiên Sx07-D per C-S07-A): introduced for cards.* tools
 * (cards.list_pending, cards.update_status). Pattern mirrors ai.client.ts —
 * fetch + manual span wrap + native auto-instrumentation provides traceparent
 * header propagation.
 *
 * Why a separate client (not reuse ai.client.ts):
 *   - AI client targets http://ai:5001 (Flask /intent endpoint with SSE body)
 *   - MCP client targets http://mcp:5050/rpc (JSON-RPC 2.0 single endpoint
 *     for all tools)
 *   - JSON-RPC envelope wrap+unwrap is MCP-specific concern; ai.client.ts
 *     should not grow that responsibility
 *
 * Span naming: gateway.client.mcp.<method> per docs/06_OBSERVABILITY.md §9.2.
 *
 * Reference:
 *   - docs/03_API_CONTRACTS.md §5 (MCP Tool Specs — JSON-RPC 2.0 LOCKED)
 *   - apps/mcp/src/server.py (server-side JSON-RPC dispatch)
 *   - apps/gateway/src/clients/ai.client.ts (precedent pattern + tracing)
 */

import { Injectable, Logger } from '@nestjs/common';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { buildMcpIdentityHeaders, type McpIdentity } from './mcp-identity';

const _tracer = trace.getTracer('gateway.client.mcp');
const _logger = new Logger('McpClient');

/** JSON-RPC 2.0 error response shape per spec §5.1. */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/** Thrown when MCP returns a JSON-RPC error envelope. */
export class McpError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'McpError';
  }
}

@Injectable()
export class McpClient {
  /**
   * MCP service base URL. Resolves from MCP_URL env (default docker-compose
   * service name + port per PHASE_01_INFRA.md Day 5).
   */
  private readonly url: string;
  private readonly timeoutMs: number;

  constructor() {
    this.url = process.env.MCP_URL ?? 'http://mcp:5050/rpc';
    // Default 5s — matches sync HTTP MCP architecture per D-S04-14 LAW
    // Q-Sx04-4-1. Override per-call if a slower tool (e.g. vision.analyze
    // wrapping Gemini multimodal ~3s) needs more headroom.
    this.timeoutMs = Number(process.env.MCP_TIMEOUT_MS ?? '15000');
  }

  /**
   * Invoke a JSON-RPC 2.0 method on the MCP service.
   *
   * @param method - JSON-RPC method name (e.g. "cards.list_pending")
   * @param params - method params object (MCP convention: object, not array)
   * @param identity - S-P0-01 T02c: user_id + tenant_id → forward header
   *                   X-User-Id/X-Tenant-Id (ADR-047 amend). Vắng = không gửi
   *                   (caller chưa wire); MCP chưa enforce nên an toàn.
   * @returns the `result` field of the JSON-RPC response envelope
   * @throws McpError if MCP returns an `error` envelope
   * @throws Error (with span recordException) on transport failure / timeout
   */
  async call<TResult = unknown>(
    method: string,
    params: Record<string, unknown> = {},
    identity?: McpIdentity,
  ): Promise<TResult> {
    const requestId = Math.floor(Math.random() * 1_000_000);
    const body = {
      jsonrpc: '2.0',
      method,
      params,
      id: requestId,
    };

    return _tracer.startActiveSpan(`gateway.client.mcp.${method}`, async (span) => {
      span.setAttribute('mcp.method', method);
      span.setAttribute('mcp.request_id', requestId);
      span.setAttribute('http.url', this.url);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const resp = await fetch(this.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...buildMcpIdentityHeaders(identity) },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!resp.ok) {
          const text = await resp.text();
          const msg = `MCP HTTP ${resp.status}: ${text.slice(0, 200)}`;
          _logger.warn(`mcp.http_error method=${method} status=${resp.status}`);
          span.setStatus({ code: SpanStatusCode.ERROR, message: msg });
          throw new Error(msg);
        }

        const data = (await resp.json()) as {
          jsonrpc?: string;
          result?: TResult;
          error?: JsonRpcError;
          id?: number;
        };

        if (data.error) {
          _logger.warn(
            `mcp.rpc_error method=${method} code=${data.error.code} message=${data.error.message}`,
          );
          span.setAttribute('mcp.error_code', data.error.code);
          span.setStatus({ code: SpanStatusCode.ERROR, message: data.error.message });
          throw new McpError(data.error.message, data.error.code, data.error.data);
        }

        span.setAttribute('mcp.status', 'ok');
        return data.result as TResult;
      } catch (err) {
        if (!(err instanceof McpError)) {
          span.recordException(err as Error);
        }
        throw err;
      } finally {
        clearTimeout(timeout);
        span.end();
      }
    });
  }
}
