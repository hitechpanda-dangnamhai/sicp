/**
 * apps/gateway/src/cart/cart.controller.ts
 *
 * S-05 T02 NEW (Phiên Sx05-2b per D-S05-01 LAW Hybrid Cart Routing topology).
 *
 * 7 REST endpoints map 1:1 to MCP cart.* tools per D-S05-02 LAW:
 *
 *   GET    /api/v1/cart                       → cart.get
 *   POST   /api/v1/cart/items                 → cart.update_qty (upsert path)
 *   PATCH  /api/v1/cart/items/:productId      → cart.update_qty (qty change)
 *   DELETE /api/v1/cart/items/:productId      → cart.remove
 *   DELETE /api/v1/cart                       → cart.clear
 *   POST   /api/v1/cart/promo                 → cart.apply_promo
 *   DELETE /api/v1/cart/promo                 → cart.remove_promo
 *
 * **Auth:** JwtAuthGuard cookie-based (S-03 T02 ship). `req.user.id`
 * propagated to MCP as user_id namespace key for Redis cart:{user_id}.
 *
 * **Idempotency:** Write endpoints (POST/PATCH/DELETE) wrapped by
 * IdempotencyMiddleware (S-02 T01) via cart.module.ts configure(). Header
 * `Idempotency-Key: <UUID v4>` per ADR-004. Read endpoint (GET /cart)
 * bypasses idempotency (no mutation).
 *
 * **Trace propagation:** Service layer auto-injects W3C traceparent so MCP
 * spans chain under Gateway controller span (verifiable in Tempo).
 *
 * **Op log emit:** `cart.<verb>_received` per LOG_CATALOG.md §A.Intent
 * (extension per D-S05 reconcile inline). Paired with MCP-side
 * `cart.<verb>_returned` for end-to-end correlation.
 *
 * @see apps/mcp/src/tools/cart.py (7 tools)
 * @see slices/S-05_decisions-log.md D-S05-01/02 LAW
 * @see apps/gateway/src/intent/intent-action.controller.ts (JwtAuthGuard +
 *      idempotency composition reference)
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger as NestLogger,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { trace, context, SpanStatusCode, type Tracer } from '@opentelemetry/api';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CartService } from './cart.service';
import { CartAddItemDto } from './dto/cart-add-item.dto';
import { CartUpdateQtyDto } from './dto/cart-update-qty.dto';
import { CartPromoDto } from './dto/cart-promo.dto';

function getTracer(): Tracer {
  return trace.getTracer('gateway.cart.controller');
}

@ApiTags('cart')
@Controller('api/v1/cart')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth('icp_session')
export class CartController {
  private readonly nestLogger = new NestLogger(CartController.name);

  constructor(private readonly cartService: CartService) {}

  /**
   * GET /api/v1/cart — fetch current user's cart.
   *
   * Always returns 200 + valid Cart JSON shape per CartSchema (T01 ship).
   * Empty-cart user returns the empty Cart shape (NEVER 404).
   *
   * Inline stock validation per A4 — every read re-checks Postgres
   * products.stock for in_stock + available_stock fields on each item.
   */
  @Get()
  @ApiOperation({
    summary: 'Fetch current user cart with inline stock validation',
  })
  async getCart(@Req() req: Request): Promise<unknown> {
    const tracer = getTracer();
    const span = tracer.startSpan('gateway.cart.get');
    return context.with(trace.setSpan(context.active(), span), async () => {
      const userId = req.user?.id ?? 'anon';
      span.setAttribute('user.id', userId);
      this.nestLogger.log(
        JSON.stringify({
          message: 'cart.get_received',
          extras: { user_id: userId },
        }),
      );
      try {
        return await this.cartService.get(userId);
      } catch (err) {
        this.recordSpanError(span, err);
        throw err;
      } finally {
        span.end();
      }
    });
  }

  /**
   * POST /api/v1/cart/items — add item to cart (upsert).
   *
   * If product_id already in cart: behaves as cart.update_qty (qty replaces
   * existing). For increment-by-1 UX, FE should compute new qty client-side
   * and send full new value.
   *
   * Returns the fresh Cart with totals recomputed.
   */
  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add item to cart or update qty if existing' })
  @ApiBody({ type: CartAddItemDto })
  async addItem(
    @Req() req: Request,
    @Body() body: CartAddItemDto,
  ): Promise<unknown> {
    const tracer = getTracer();
    const span = tracer.startSpan('gateway.cart.add_item');
    return context.with(trace.setSpan(context.active(), span), async () => {
      const userId = req.user?.id ?? 'anon';
      span.setAttribute('user.id', userId);
      span.setAttribute('cart.product_id', body.product_id);
      span.setAttribute('cart.qty', body.qty);
      this.nestLogger.log(
        JSON.stringify({
          message: 'cart.item_add_received',
          extras: {
            user_id: userId,
            product_id: body.product_id,
            qty: body.qty,
            has_snapshot: body.snapshot !== undefined,
          },
        }),
      );
      try {
        return await this.cartService.addItem(
          userId,
          body.product_id,
          body.qty,
          body.snapshot,
        );
      } catch (err) {
        this.recordSpanError(span, err);
        throw err;
      } finally {
        span.end();
      }
    });
  }

  /**
   * PATCH /api/v1/cart/items/:productId — update item qty.
   *
   * qty=0 auto-removes (per D-S05-02 LAW sugar). Cap 99.
   */
  @Patch('items/:productId')
  @ApiOperation({ summary: 'Update item qty (qty=0 auto-removes)' })
  @ApiParam({ name: 'productId', description: 'Product UUID in cart' })
  @ApiBody({ type: CartUpdateQtyDto })
  async updateQty(
    @Req() req: Request,
    @Param('productId') productId: string,
    @Body() body: CartUpdateQtyDto,
  ): Promise<unknown> {
    const tracer = getTracer();
    const span = tracer.startSpan('gateway.cart.update_qty');
    return context.with(trace.setSpan(context.active(), span), async () => {
      const userId = req.user?.id ?? 'anon';
      span.setAttribute('user.id', userId);
      span.setAttribute('cart.product_id', productId);
      span.setAttribute('cart.qty', body.qty);
      this.nestLogger.log(
        JSON.stringify({
          message: 'cart.qty_change_received',
          extras: { user_id: userId, product_id: productId, qty: body.qty },
        }),
      );
      try {
        return await this.cartService.updateQty(userId, productId, body.qty);
      } catch (err) {
        this.recordSpanError(span, err);
        throw err;
      } finally {
        span.end();
      }
    });
  }

  /**
   * DELETE /api/v1/cart/items/:productId — remove single item.
   *
   * Idempotent — removing absent item returns current cart unchanged.
   */
  @Delete('items/:productId')
  @ApiOperation({ summary: 'Remove single item from cart (idempotent)' })
  @ApiParam({ name: 'productId', description: 'Product UUID in cart' })
  async removeItem(
    @Req() req: Request,
    @Param('productId') productId: string,
  ): Promise<unknown> {
    const tracer = getTracer();
    const span = tracer.startSpan('gateway.cart.remove_item');
    return context.with(trace.setSpan(context.active(), span), async () => {
      const userId = req.user?.id ?? 'anon';
      span.setAttribute('user.id', userId);
      span.setAttribute('cart.product_id', productId);
      this.nestLogger.log(
        JSON.stringify({
          message: 'cart.item_remove_received',
          extras: { user_id: userId, product_id: productId },
        }),
      );
      try {
        return await this.cartService.remove(userId, productId);
      } catch (err) {
        this.recordSpanError(span, err);
        throw err;
      } finally {
        span.end();
      }
    });
  }

  /**
   * DELETE /api/v1/cart — wipe entire cart.
   *
   * NOTE: this Direct REST path is the "no-confirm" cart clear. For the
   * Pattern A interrupt UX (state-F-clear-confirm modal with AI advice),
   * FE should POST /api/v1/intent with `hint='cart_clear_confirm'` instead
   * — that path goes through cart_by_text.py graph and emits the
   * clear_confirm SSE for user confirmation.
   *
   * Returns `{cleared: true, user_id: <user_id>}`.
   */
  @Delete()
  @ApiOperation({
    summary:
      'Wipe entire cart (no-confirm path; use POST /intent ' +
      'with hint=cart_clear_confirm for interrupt UX)',
  })
  async clear(@Req() req: Request): Promise<unknown> {
    const tracer = getTracer();
    const span = tracer.startSpan('gateway.cart.clear');
    return context.with(trace.setSpan(context.active(), span), async () => {
      const userId = req.user?.id ?? 'anon';
      span.setAttribute('user.id', userId);
      this.nestLogger.log(
        JSON.stringify({
          message: 'cart.clear_received',
          extras: { user_id: userId },
        }),
      );
      try {
        return await this.cartService.clear(userId);
      } catch (err) {
        this.recordSpanError(span, err);
        throw err;
      } finally {
        span.end();
      }
    });
  }

  /**
   * POST /api/v1/cart/promo — apply promo code.
   *
   * Fixture-based exact-match validate. Returns Cart on success, or 200 with
   * `{error: 'INVALID_CODE'}` body on miss (NOT HTTP 400 — D-S05-05 LAW
   * expects FE to render inline error UX, not exception).
   *
   * LLM typo correction is FE-side retry (out-of-scope this endpoint).
   */
  @Post('promo')
  @ApiOperation({ summary: 'Apply promo code (exact match; LLM typo via FE retry)' })
  @ApiBody({ type: CartPromoDto })
  async applyPromo(
    @Req() req: Request,
    @Body() body: CartPromoDto,
  ): Promise<unknown> {
    const tracer = getTracer();
    const span = tracer.startSpan('gateway.cart.apply_promo');
    return context.with(trace.setSpan(context.active(), span), async () => {
      const userId = req.user?.id ?? 'anon';
      span.setAttribute('user.id', userId);
      span.setAttribute('cart.promo_code', body.code);
      this.nestLogger.log(
        JSON.stringify({
          message: 'cart.promo_apply_received',
          extras: { user_id: userId, code: body.code },
        }),
      );
      try {
        return await this.cartService.applyPromo(userId, body.code);
      } catch (err) {
        this.recordSpanError(span, err);
        throw err;
      } finally {
        span.end();
      }
    });
  }

  /**
   * DELETE /api/v1/cart/promo — remove applied promo.
   *
   * Idempotent — removing absent promo returns current cart unchanged.
   */
  @Delete('promo')
  @ApiOperation({ summary: 'Remove applied promo code (idempotent)' })
  async removePromo(@Req() req: Request): Promise<unknown> {
    const tracer = getTracer();
    const span = tracer.startSpan('gateway.cart.remove_promo');
    return context.with(trace.setSpan(context.active(), span), async () => {
      const userId = req.user?.id ?? 'anon';
      span.setAttribute('user.id', userId);
      this.nestLogger.log(
        JSON.stringify({
          message: 'cart.promo_remove_received',
          extras: { user_id: userId },
        }),
      );
      try {
        return await this.cartService.removePromo(userId);
      } catch (err) {
        this.recordSpanError(span, err);
        throw err;
      } finally {
        span.end();
      }
    });
  }

  // -----------------------------------------------------------------------
  // Helper
  // -----------------------------------------------------------------------

  private recordSpanError(
    span: ReturnType<Tracer['startSpan']>,
    err: unknown,
  ): void {
    const msg = err instanceof Error ? err.message : String(err);
    span.recordException(err instanceof Error ? err : new Error(msg));
    span.setStatus({ code: SpanStatusCode.ERROR, message: msg });
    this.nestLogger.error(
      JSON.stringify({
        message: 'cart.endpoint_error',
        error_message: msg,
      }),
    );
  }
}
