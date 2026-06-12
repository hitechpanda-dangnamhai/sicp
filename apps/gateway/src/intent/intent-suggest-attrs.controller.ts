/**
 * apps/gateway/src/intent/intent-suggest-attrs.controller.ts
 *
 * S-07 T02 NEW (Phiên Sx07-F per C-S07-O option iii-a Sx07-G hotfix):
 * POST /api/v1/intent/{rid}/suggest-attrs — proxy to MCP `vision.suggest_attributes`.
 *
 * **Flow** (per `03_API_CONTRACTS.md §1.4` Sx07-G hotfix amendment):
 *   1. JwtAuthGuard validates `icp_session` cookie
 *   2. Base IdempotencyMiddleware (S-02) covers this endpoint via
 *      `idempotency.module.ts` registration (NO composite key needed —
 *      this is NOT a resume-graph action; simple POST-once semantics).
 *      Composite key namespace `intent:action:{rid}:{n}` is for the
 *      `/action` endpoint ONLY.
 *   3. Controller forwards `{category, existing_attrs}` to MCP
 *      `vision.suggest_attributes` (no graph state mutation)
 *   4. Returns `{ suggested_attributes: [...] }` synchronously (~7s)
 *
 * **Why JwtAuthGuard:** Same as /action — mutates analytics events
 * (suggest-attrs call counts as merchant engagement signal); auth needed
 * for user_id attribution + Gemini cost tracking per-merchant.
 *
 * **Idempotency note:** Repeated POST with same Idempotency-Key returns
 * the cached suggestion list (avoids paying Gemini ~$0.001/call twice
 * for the same logical user intent). Base S-02 middleware handles this.
 *
 * **rid param is passed for traceability** — does NOT need to be a valid
 * active graph rid; if `ai:checkpoint:{rid}` expired or never existed,
 * suggest_attributes still works (no graph state lookup performed).
 *
 * @see slices/S-07_decisions-log.md C-S07-O (option iii-a chosen Phiên Sx07-F)
 * @see apps/mcp/src/tools/vision.py `suggest_attributes()` — MCP impl
 * @see apps/gateway/src/cards/cards.controller.ts — MCP-proxy precedent pattern
 *
 * Phiên Sx07-F emit.
 */

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger as NestLogger,
  Param,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { trace, context, SpanStatusCode, type Tracer } from '@opentelemetry/api';

import { JwtAuthGuard, type AuthedRequest } from '../auth/jwt-auth.guard';
import { McpClient } from '../clients/mcp.client';
import { TenantResolverService } from '../tenant/tenant-resolver.service';
import { TenantMembershipGuard } from '../tenant/tenant-membership.guard';

/** Lazy tracer per C-28 LOCK (same pattern intent-action.controller uses). */
function getTracer(): Tracer {
  return trace.getTracer('gateway.intent.suggest_attrs_controller');
}

/**
 * Body shape — mirrors `@icp/shared-types/dto/intent-suggest-attrs.dto`
 * IntentSuggestAttrsRequestSchema. Declared inline rather than imported
 * because Gateway NestJS uses runtime decorators (not Zod resolver) — DTO
 * file in shared-types is consumed by FE only. Per C-S07-P (deferred):
 * Gateway will eventually adopt ZodValidationPipe for full FE-BE Zod parity.
 */
interface SuggestAttrsBody {
  category: string;
  existing_attrs?: Record<string, string>;
}

/**
 * Response shape — mirrors IntentSuggestAttrsResponseSchema.
 */
interface SuggestAttrsResponse {
  suggested_attributes: Array<{
    key: string;
    label_vn: string;
    example_values: string[];
  }>;
}

@ApiTags('intent')
@Controller('api/v1/intent')
export class IntentSuggestAttrsController {
  private readonly nestLogger = new NestLogger(IntentSuggestAttrsController.name);

  constructor(
    private readonly mcp: McpClient,
    private readonly tenant: TenantResolverService,
  ) {}

  /**
   * POST /api/v1/intent/:rid/suggest-attrs — request 3 AI-suggested chip
   * attributes for the PrefillForm "Thêm" button flow.
   *
   * Idempotent via base S-02 `IdempotencyMiddleware`. Synchronous (~7s p50).
   */
  @Post(':rid/suggest-attrs')
  // S-P0-01 T03d — merchant route (product attr suggest): tenant strict
  // (400 thiếu header / 403 ∉ tenant_ids) + vá lỗ authz customer 0-membership.
  @UseGuards(JwtAuthGuard, TenantMembershipGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request AI-suggested attribute chips for PrefillForm',
    description:
      'On-demand Gemini 2.5 Flash call to suggest 3 additional attribute ' +
      'chips for the merchant to add via PrefillForm "Thêm" button. ' +
      'Synchronous ~7s; idempotent via Idempotency-Key header.',
  })
  @ApiCookieAuth('icp_session')
  @ApiParam({ name: 'rid', description: 'request_id (for traceability; graph state lookup not required)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['category'],
      properties: {
        category: { type: 'string', example: 'nuoc_tuong' },
        existing_attrs: {
          type: 'object',
          additionalProperties: { type: 'string' },
          example: { brand: 'Maggi', size: '200ml' },
        },
      },
    },
  })
  async suggestAttrs(
    @Param('rid') rid: string,
    @Body() body: SuggestAttrsBody,
    @Req() req: AuthedRequest,
  ): Promise<SuggestAttrsResponse> {
    // Defensive validation — C-S07-P means no ZodValidationPipe wired
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Request body required');
    }
    if (typeof body.category !== 'string' || body.category.length === 0) {
      throw new BadRequestException('Field `category` is required (non-empty string)');
    }
    if (body.category.length > 100) {
      throw new BadRequestException('Field `category` exceeds 100 chars');
    }
    const existingAttrs: Record<string, string> = body.existing_attrs ?? {};
    if (typeof existingAttrs !== 'object' || Array.isArray(existingAttrs)) {
      throw new BadRequestException('Field `existing_attrs` must be an object');
    }
    // Coerce all values to strings (chip values are always strings in FE)
    const normalizedExisting: Record<string, string> = {};
    for (const [k, v] of Object.entries(existingAttrs)) {
      normalizedExisting[String(k)] = v == null ? '' : String(v);
    }

    const tracer = getTracer();
    const span = tracer.startSpan('gateway.intent.suggest_attrs');
    return context.with(trace.setSpan(context.active(), span), async () => {
      span.setAttribute('intent.request_id', rid);
      span.setAttribute('intent.suggest_attrs.category', body.category);
      span.setAttribute('intent.suggest_attrs.existing_count', Object.keys(normalizedExisting).length);
      const userId = req.user?.id ?? 'anon';

      this.nestLogger.log(
        JSON.stringify({
          message: 'intent.suggest_attrs_received',
          extras: {
            request_id: rid,
            category: body.category,
            existing_count: Object.keys(normalizedExisting).length,
            user_id: userId,
          },
        }),
      );

      try {
        const mcpResult = (await this.mcp.call(
          'vision.suggest_attributes',
          {
            category: body.category,
            existing_attrs: normalizedExisting,
          },
          // T03d: resolve() non-null (TenantMembershipGuard đã validate ∈ tenant_ids).
          { userId, tenantId: this.tenant.resolve(req).tenantId },
        )) as SuggestAttrsResponse;

        // Defensive — MCP normalization should already guarantee shape, but
        // surface gracefully if Gemini returned 0 items (edge case).
        const items = Array.isArray(mcpResult?.suggested_attributes)
          ? mcpResult.suggested_attributes
          : [];

        span.setAttribute('intent.suggest_attrs.returned_count', items.length);
        this.nestLogger.log(
          JSON.stringify({
            message: 'intent.suggest_attrs_done',
            extras: {
              request_id: rid,
              returned_count: items.length,
              user_id: userId,
            },
          }),
        );

        return { suggested_attributes: items };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        span.recordException(err instanceof Error ? err : new Error(msg));
        span.setStatus({ code: SpanStatusCode.ERROR, message: msg });
        this.nestLogger.error(
          JSON.stringify({
            message: 'intent.suggest_attrs_failed',
            error_message: msg,
            extras: { request_id: rid, category: body.category, user_id: userId },
          }),
        );
        throw err;
      } finally {
        span.end();
      }
    });
  }
}
