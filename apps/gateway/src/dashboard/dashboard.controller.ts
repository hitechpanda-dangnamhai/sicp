/**
 * apps/gateway/src/dashboard/dashboard.controller.ts
 *
 * S-03 T03b — Dashboard controller exposing 1 REST endpoint per S-03 D-10
 * (MAR-1 Q5 RESOLVED Phiên 34) + DM-14:
 *
 *   GET /api/v1/dashboard/stats — return stub stats JSON (Guard required)
 *
 * **JwtAuthGuard via `@UseGuards`** — same pattern as `auth.controller.ts`
 * `GET /me` endpoint. Requires `icp_session` cookie. Without cookie → 401 per
 * S-03 T02 JwtAuthGuard logic (delegates to AuthModule export). With invalid
 * or expired cookie → 401. With valid cookie → handler executes, returns 200
 * with hardcoded stats per DashboardService.
 *
 * **Manual span wrap per C-28 LOCKED pattern** — each endpoint creates a
 * `gateway.dashboard.{verb}` span for OTel trace continuity. Uses lazy
 * `getTracer()` + explicit `context.with(trace.setSpan(...), cb)` (NOT
 * `startActiveSpan` — defensive against NodeSDK 0.52 + NestJS auto-instrument
 * race per S-02 T05 KI-T05-6 + S-02 C-30). Span attribute `auth.user_id_prefix`
 * for analytics (first 8 chars to avoid PII leakage per `06_OBS §7`).
 *
 * **Idempotency MW: NOT applied** per S-03 C-13 + S-02 T01 per-route opt-in
 * design (idempotency.module.ts forRoutes only registers /intent + /products +
 * /orders/checkout). /dashboard/* not in route filter → MW skipped natively.
 *
 * S-03 T03b emit (Phiên 36 Batch 1) per Task Pack v1.1.
 */

import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { trace, context, SpanStatusCode, type Tracer } from '@opentelemetry/api';
import { JwtAuthGuard, type AuthedRequest } from '../auth/jwt-auth.guard';
import { TenantMembershipGuard } from '../tenant/tenant-membership.guard';
import { TenantResolverService } from '../tenant/tenant-resolver.service';
import { DashboardService } from './dashboard.service';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';
import { DashboardInsightDto } from './dto/dashboard-insight.dto';

function getTracer(): Tracer {
  return trace.getTracer('gateway.dashboard.controller');
}

@ApiTags('dashboard')
@Controller('api/v1/dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly tenant: TenantResolverService,
  ) {}

  // ────────────────────────────────────────────────────────────────────────
  // GET /dashboard/stats
  // ────────────────────────────────────────────────────────────────────────

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, TenantMembershipGuard)
  @ApiCookieAuth('icp_session')
  @ApiOperation({
    summary: 'Get dashboard KPI stats — stub per S-03 D-10',
    description:
      'Returns 200 with hardcoded JSON `{orders_today, revenue_today, ' +
      'inventory_count, currency: "VND"}` matching mockup StatBar text values. ' +
      'Requires icp_session cookie. Real DB aggregations defer to future slice ' +
      'when S-05 Cart/Order ships data. Per S-03 D-10 MAR-1 Q5 RESOLVED + DM-14.',
  })
  @ApiResponse({ status: 200, type: DashboardStatsDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid icp_session cookie' })
  async getStats(@Req() req: AuthedRequest): Promise<DashboardStatsDto> {
    const tracer = getTracer();
    const span = tracer.startSpan('gateway.dashboard.stats');
    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        span.setAttribute('auth.user_id_prefix', req.user.id.slice(0, 8));
        // req.tenant_id do TenantMembershipGuard set (đã validate ∈ tenant_ids).
        const result = await this.dashboardService.getStats(req.user.id, req.tenant_id ?? null);
        return result as DashboardStatsDto;
      } catch (err) {
        span.recordException(err instanceof Error ? err : new Error(String(err)));
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : String(err),
        });
        throw err;
      } finally {
        span.end();
      }
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // GET /dashboard/insight  — hero "AI VỪA PHÁT HIỆN" card (S-10, REAL data)
  // ────────────────────────────────────────────────────────────────────────

  @Get('insight')
  @HttpCode(HttpStatus.OK)
  // S-P0-01 T03d — insight = analytics.detect_anomaly (Postgres tenant-scoped) →
  // tenant strict (400 thiếu header / 403 ∉ tenant_ids). Trước T03d chỉ JwtAuthGuard
  // + resolveOptional (tenant nullable) → MCP có thể thiếu X-Tenant-Id.
  @UseGuards(JwtAuthGuard, TenantMembershipGuard)
  @ApiCookieAuth('icp_session')
  @ApiOperation({
    summary: 'Get home hero AI insight — REAL analytics (S-10 detect_anomaly)',
    description:
      'Returns `{delta_pct, direction, cause_count, has_data}` from ' +
      'analytics.detect_anomaly (merchant-wide 7d-vs-prior-7d + count of ' +
      'flagged categories). Replaces the hard-coded "giảm 12% / 2 nguyên nhân" ' +
      'in HeroInsightCard. Same engine as /intent-07 so numbers agree. Requires ' +
      'icp_session cookie.',
  })
  @ApiResponse({ status: 200, type: DashboardInsightDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid icp_session cookie' })
  async getInsight(@Req() req: AuthedRequest): Promise<DashboardInsightDto> {
    const tracer = getTracer();
    const span = tracer.startSpan('gateway.dashboard.insight');
    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        span.setAttribute('auth.user_id_prefix', req.user.id.slice(0, 8));
        // T03d: TenantMembershipGuard set req.tenant_id (đã validate ∈ tenant_ids);
        // resolve() non-null. Bỏ resolveOptional (T02c) — tenant nay BẮT BUỘC.
        const result = await this.dashboardService.getInsight(
          req.user.id,
          this.tenant.resolve(req).tenantId,
        );
        return result as DashboardInsightDto;
      } catch (err) {
        span.recordException(err instanceof Error ? err : new Error(String(err)));
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : String(err),
        });
        throw err;
      } finally {
        span.end();
      }
    });
  }
}
