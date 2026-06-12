/**
 * apps/gateway/src/products/products.controller.ts
 *
 * S-07 T01.E.G NEW (Phiên Sx07-D per C-S07-N Option B): Product update endpoint
 * for merchant lifecycle (post-import price/stock/description changes).
 *
 * Endpoint:
 *   PATCH /api/v1/products/:id — partial update; emits ProductUpdated outbox
 *
 * Flow per C-S07-N + S-07 spec:
 *   1. JwtAuthGuard validates session cookie → req.user.id
 *   2. IdempotencyMiddleware guards retries (composite key request_id+attempt_n
 *      via Idempotency-Key header per ADR-004)
 *   3. Ownership pre-check (defense-in-depth): call MCP products.update with
 *      expected_merchant_id; MCP re-verifies inside same transaction
 *   4. On success: orchestrate vespa.index re-index with returned snapshot
 *      (BEST-EFFORT: PG commit always wins, Vespa fail → log warn, response
 *      reports indexed=false but PG state persisted + ProductUpdated event
 *      already emitted → S-06 outbox-relay-worker will retry downstream)
 *
 * @Controller path literal `api/v1/products` per codebase convention.
 *
 * Reference:
 *   - slices/S-07_decisions-log.md C-S07-N Option B (separate update path)
 *   - slices/S-07_decisions-log.md C-S07-M Option ❸ (outbox precedent)
 *   - apps/mcp/src/tools/products.py update() function (T01.E.G amend)
 *   - apps/gateway/src/cards/cards.controller.ts (precedent MCP-proxy pattern)
 */

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard, type AuthedRequest } from '../auth/jwt-auth.guard';
import { McpClient, McpError } from '../clients/mcp.client';
import type { McpIdentity } from '../clients/mcp-identity';
import { TenantResolverService } from '../tenant/tenant-resolver.service';

/**
 * Whitelisted updatable fields per C-S07-N. Frontend should send any subset;
 * omit a field to keep current value. Immutable fields rejected at MCP level.
 */
interface ProductUpdateBody {
  title?: string;
  description?: string | null;
  attributes?: Record<string, unknown>;
  price?: number;
  stock?: number;
  image_url?: string | null;
  brand?: string | null;
  original_price?: number | null;
  status?: 'active' | 'inactive' | 'archived';
  image_data?: string | null;
  image_gradient?: string | null;
  icon_hint?: string | null;
}

interface ProductUpdateResult {
  product_id: string;
  updated: boolean;
  event_id: string | null;
  indexed: boolean;
  snapshot: Record<string, unknown>;
}

@ApiTags('products')
@ApiCookieAuth('icp_session')
@UseGuards(JwtAuthGuard)
@Controller('api/v1/products')
export class ProductsController {
  constructor(
    private readonly mcp: McpClient,
    private readonly tenant: TenantResolverService,
  ) {}

  /** S-P0-01 T02c — identity header cho MCP (tenant header-only, non-throw). */
  private identity(req: AuthedRequest): McpIdentity {
    return { userId: req.user.id, tenantId: this.tenant.resolveOptional(req) };
  }

  /**
   * PATCH /api/v1/products/:id — partial update for owner-merchant only.
   *
   * Ownership enforced at MCP tool layer (defense-in-depth re-check inside
   * same transaction). Vespa re-index is best-effort post-commit.
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update an existing product (owner-merchant only)',
    description:
      'Partial update — omit any field to keep current value. Immutable: id, ' +
      'merchant_id, category, created_at, vespa_doc_id, rating_*, sold_count, ' +
      'trend_score. After PG commit (+ ProductUpdated outbox event emitted), ' +
      'Gateway orchestrates vespa.index re-index. PG commit always succeeds ' +
      'first; Vespa failure logs warning + response.indexed=false (S-06 ' +
      'outbox-relay-worker will retry downstream).',
  })
  @ApiParam({ name: 'id', description: 'Product UUID (must be owned by current merchant)' })
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: AuthedRequest,
    @Body() body: ProductUpdateBody,
  ): Promise<ProductUpdateResult> {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException({
        error: { code: 'VALIDATION_FAILED', message: 'Request body must be an object' },
      });
    }

    // Build params for MCP products.update — only include keys actually sent.
    const updateParams: Record<string, unknown> = {
      product_id: id,
      expected_merchant_id: req.user.id,
    };
    const allowedFields: (keyof ProductUpdateBody)[] = [
      'title', 'description', 'attributes', 'price', 'stock',
      'image_url', 'brand', 'original_price', 'status',
      'image_data', 'image_gradient', 'icon_hint',
    ];
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        updateParams[field] = body[field];
      }
    }

    // Step 1: PG update + outbox via MCP
    let updateRes: {
      product_id: string;
      updated: boolean;
      event_id: string | null;
      snapshot: Record<string, unknown>;
    };
    try {
      updateRes = await this.mcp.call('products.update', updateParams, this.identity(req));
    } catch (err) {
      // McpError data may contain semantic codes (NOT_FOUND / FORBIDDEN)
      if (err instanceof McpError) {
        // MCP returns JSON-RPC error: { code: -32602, message: 'Invalid params',
        //   data: { detail: 'FORBIDDEN: ...' | 'NOT_FOUND: ...' | other } }.
        // Real semantic code lives in data.detail prefix — peel it out here.
        const data = err.data as { detail?: string } | undefined;
        const detail = (data && typeof data.detail === 'string') ? data.detail : err.message;
        if (detail.startsWith('NOT_FOUND')) {
          throw new NotFoundException({
            error: { code: 'PRODUCT_NOT_FOUND', message: detail, request_id: id },
          });
        }
        if (detail.startsWith('FORBIDDEN')) {
          throw new ForbiddenException({
            error: { code: 'FORBIDDEN', message: 'You do not own this product', request_id: id },
          });
        }
        throw new BadRequestException({
          error: { code: 'VALIDATION_FAILED', message: detail, request_id: id },
        });
      }
      throw new InternalServerErrorException({
        error: { code: 'INTERNAL_ERROR', message: 'Update failed', request_id: id },
      });
    }

    // Step 2: Vespa re-index (best-effort)
    let indexed = false;
    if (updateRes.updated && updateRes.snapshot) {
      try {
        await this.mcp.call('vespa.index', { product: updateRes.snapshot }, this.identity(req));
        indexed = true;
      } catch (err) {
        // Log via console fallback; structured logger is configured app-wide.
        // eslint-disable-next-line no-console
        console.warn(
          JSON.stringify({
            level: 'warn',
            message: 'products.update.vespa_reindex_failed',
            product_id: id,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
        indexed = false;
      }
    } else if (!updateRes.updated) {
      // No-op update (no fields changed) — Vespa already in sync, skip.
      indexed = true;
    }

    return {
      product_id: updateRes.product_id,
      updated: updateRes.updated,
      event_id: updateRes.event_id,
      indexed,
      snapshot: updateRes.snapshot,
    };
  }
}
