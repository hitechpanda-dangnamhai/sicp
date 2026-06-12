/**
 * apps/gateway/src/cart/cart.service.ts
 *
 * S-05 T02 NEW (Phiên Sx05-2b per D-S05-01 LAW Hybrid Cart Routing topology).
 *
 * Thin MCP JSON-RPC 2.0 client wrapper for 7 cart.* tools per D-S05-02 LAW.
 * Each method maps 1:1 to an MCP tool registered in apps/mcp/src/tools/cart.py.
 *
 * **Auth layer:** This service receives a `userId` arg from the Controller
 * which has already validated via JwtAuthGuard. Service-layer trusts the
 * userId — does NOT re-authenticate (single-source-of-truth: guard).
 *
 * **Trace propagation:** W3C `traceparent` header injected automatically
 * via OpenTelemetry httpx instrumentation when the AI service makes outbound
 * calls. For this NestJS Gateway → MCP path, we use native fetch + manually
 * inject traceparent following the pattern from `ai.client.ts`.
 *
 * **Error mapping:** JSON-RPC errors from MCP are translated to NestJS
 * HttpException with appropriate status:
 *   - JSON-RPC -32602 invalid_params → HTTP 400 BAD_REQUEST
 *   - JSON-RPC -32603 internal_error → HTTP 500 INTERNAL_SERVER_ERROR
 *   - JSON-RPC -32601 method_not_found → HTTP 500 (config bug)
 *   - Network timeout → HTTP 502 BAD_GATEWAY
 *
 * **MCP base URL:** read from `MCP_URL` env var; default `http://mcp:5050/rpc`
 * (per docker-compose.yml service name).
 *
 * @see apps/mcp/src/tools/cart.py (7 tools registered)
 * @see apps/gateway/src/clients/ai.client.ts (W3C trace propagation pattern)
 * @see slices/S-05_decisions-log.md D-S05-01/02 LAW
 */

import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger as NestLogger,
} from '@nestjs/common';
import { trace, context, SpanStatusCode, type Tracer } from '@opentelemetry/api';
import { propagation } from '@opentelemetry/api';
import { randomUUID } from 'node:crypto';
import { buildMcpIdentityHeaders, type McpIdentity } from '../clients/mcp-identity';

const MCP_DEFAULT_URL = 'http://mcp:5050/rpc';
const MCP_TIMEOUT_MS = 10_000;

/** Lazy tracer per C-28 LOCK. */
function getTracer(): Tracer {
  return trace.getTracer('gateway.cart.service');
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params: Record<string, unknown>;
}

interface JsonRpcSuccessResponse {
  jsonrpc: '2.0';
  id: string;
  result: unknown;
}

interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  id: string;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

@Injectable()
export class CartService {
  private readonly nestLogger = new NestLogger(CartService.name);
  private readonly mcpUrl = process.env.MCP_URL || MCP_DEFAULT_URL;

  /**
   * Invoke an MCP cart.* tool via JSON-RPC 2.0 POST /rpc.
   *
   * Wraps in OTel span `gateway.cart.mcp.<method>`. Injects W3C traceparent
   * header so MCP server span chains under this one (verifiable in Tempo).
   */
  private async callMcp<T = unknown>(
    method: string,
    params: Record<string, unknown>,
    identity?: McpIdentity,
  ): Promise<T> {
    const tracer = getTracer();
    const span = tracer.startSpan(`gateway.cart.mcp.${method}`);
    return context.with(trace.setSpan(context.active(), span), async () => {
      const requestId = randomUUID();
      span.setAttribute('mcp.method', method);
      span.setAttribute('mcp.request_id', requestId);
      span.setAttribute('peer.service', 'mcp');

      const body: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: requestId,
        method,
        params,
      };

      // Inject W3C trace context + S-P0-01 T02c identity header (X-User-Id/
      // X-Tenant-Id) into outbound headers.
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        ...buildMcpIdentityHeaders(identity),
      };
      propagation.inject(context.active(), headers);

      try {
        const response = await fetch(this.mcpUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(MCP_TIMEOUT_MS),
        });
        span.setAttribute('http.status_code', response.status);

        if (!response.ok) {
          throw new BadGatewayException({
            error: {
              code: 'MCP_HTTP_ERROR',
              message: `MCP returned HTTP ${response.status}`,
            },
          });
        }

        const parsed = (await response.json()) as JsonRpcResponse;
        if ('error' in parsed && parsed.error) {
          span.setAttribute('mcp.error_code', parsed.error.code);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: parsed.error.message,
          });
          this.nestLogger.warn(
            JSON.stringify({
              message: 'cart.mcp_error',
              extras: {
                method,
                code: parsed.error.code,
                detail: parsed.error.message,
              },
            }),
          );
          // Map JSON-RPC error codes → NestJS HTTP exceptions.
          if (parsed.error.code === -32602) {
            // invalid_params (caller error → 400).
            throw new BadRequestException({
              error: {
                code: 'INVALID_PARAMS',
                message: parsed.error.message,
                data: parsed.error.data,
              },
            });
          }
          // -32603 internal_error OR -32601 method_not_found → 500.
          throw new InternalServerErrorException({
            error: {
              code: 'MCP_INTERNAL_ERROR',
              message: parsed.error.message,
            },
          });
        }
        return (parsed as JsonRpcSuccessResponse).result as T;
      } catch (err) {
        if (
          err instanceof BadRequestException ||
          err instanceof InternalServerErrorException ||
          err instanceof BadGatewayException
        ) {
          throw err;
        }
        const msg = err instanceof Error ? err.message : String(err);
        span.recordException(err instanceof Error ? err : new Error(msg));
        span.setStatus({ code: SpanStatusCode.ERROR, message: msg });
        if (err instanceof Error && err.name === 'AbortError') {
          this.nestLogger.error(
            JSON.stringify({
              message: 'cart.mcp_timeout',
              extras: { method, timeout_ms: MCP_TIMEOUT_MS },
            }),
          );
          throw new BadGatewayException({
            error: { code: 'MCP_TIMEOUT', message: 'MCP call timed out' },
          });
        }
        this.nestLogger.error(
          JSON.stringify({
            message: 'cart.mcp_network_error',
            extras: { method, error: msg },
          }),
        );
        throw new BadGatewayException({
          error: { code: 'MCP_NETWORK_ERROR', message: msg },
        });
      } finally {
        span.end();
      }
    });
  }

  // -----------------------------------------------------------------------
  // 7 tool wrappers (1:1 mapping to MCP cart.* tools)
  // -----------------------------------------------------------------------

  // S-P0-01 T03b — đóng 2-phase: gỡ `user_id` khỏi params; MCP cart đọc identity
  // từ header X-User-Id (current_user) — `{ userId, tenantId }` (identity arg 3)
  // build X-User-Id/X-Tenant-Id qua buildMcpIdentityHeaders. user_id trong params
  // = dead-param đã xoá (ADR-047 2-phase đóng).

  async get(userId: string, tenantId: string): Promise<unknown> {
    return this.callMcp('cart.get', {}, { userId, tenantId });
  }

  async addItem(
    userId: string,
    tenantId: string,
    productId: string,
    qty: number,
    snapshot?: Record<string, unknown>,
  ): Promise<unknown> {
    const params: Record<string, unknown> = {
      product_id: productId,
      qty,
    };
    if (snapshot) {
      params.snapshot = snapshot;
    }
    return this.callMcp('cart.update_qty', params, { userId, tenantId });
  }

  async updateQty(
    userId: string,
    tenantId: string,
    productId: string,
    qty: number,
  ): Promise<unknown> {
    return this.callMcp(
      'cart.update_qty',
      {
        product_id: productId,
        qty,
      },
      { userId, tenantId },
    );
  }

  async remove(userId: string, tenantId: string, productId: string): Promise<unknown> {
    return this.callMcp(
      'cart.remove',
      {
        product_id: productId,
      },
      { userId, tenantId },
    );
  }

  async clear(userId: string, tenantId: string): Promise<unknown> {
    return this.callMcp('cart.clear', {}, { userId, tenantId });
  }

  async applyPromo(userId: string, tenantId: string, code: string): Promise<unknown> {
    return this.callMcp('cart.apply_promo', { code }, { userId, tenantId });
  }

  async removePromo(userId: string, tenantId: string): Promise<unknown> {
    return this.callMcp('cart.remove_promo', {}, { userId, tenantId });
  }
}
