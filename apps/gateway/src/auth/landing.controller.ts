/**
 * apps/gateway/src/auth/landing.controller.ts
 *
 * S-P0-01 T02 (ADR-046 amendment c) — GET /api/v1/auth/landing.
 *
 * User vào root URL (không có /s/<slug>) → FE gọi endpoint này để biết redirect
 * đi đâu: shop dùng gần nhất (`sessions.last_active_tenant_id` → `/s/<slug>`)
 * hoặc `/onboarding` (chưa từng switch / customer global / tenant đã xoá).
 *
 * Guard JwtAuthGuard (cần session jti). KHÔNG cần tenant context (đây là bước
 * QUYẾT ĐỊNH tenant nào, chưa có URL tenant).
 */

import { Controller, Get, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, type AuthedRequest } from './jwt-auth.guard';
import { PostgresSessionRepository } from './infrastructure/postgres-session.repo';
import { PostgresMembershipRepository } from './infrastructure/postgres-membership.repo';
import { LandingResponseDto, MyTenantsResponseDto } from './dto/landing.dto';
import { createLogger, type IcpLogPayload } from '../observability';

@ApiTags('auth')
@Controller('api/v1/auth')
export class LandingController {
  private readonly log = createLogger({
    service: 'gateway',
    version: process.env.APP_VERSION ?? '0.0.1',
    env: process.env.NODE_ENV ?? 'dev',
  }).child({ component: 'auth.landing' });

  constructor(
    private readonly sessions: PostgresSessionRepository,
    private readonly memberships: PostgresMembershipRepository,
  ) {}

  @Get('landing')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('icp_session')
  @ApiOperation({
    summary: 'Resolve landing redirect (last shop hoặc onboarding)',
    description:
      'ADR-046 amend (c): đọc sessions.last_active_tenant_id → redirect_url ' +
      '`/s/<slug>` (last_active) hoặc `/onboarding` (chưa có hint). Dùng cho root URL.',
  })
  @ApiResponse({ status: 200, type: LandingResponseDto })
  @ApiResponse({ status: 401 })
  async landing(@Req() req: AuthedRequest): Promise<LandingResponseDto> {
    const last = await this.sessions.getLastActiveTenant(req.user.jti);
    const result: LandingResponseDto = last
      ? { redirect_url: `/s/${last.slug}`, source: 'last_active' }
      : { redirect_url: '/onboarding', source: 'onboarding' };

    this.log.info(
      {
        message: 'tenant.landing_resolved',
        user_id: req.user.id,
        extras: { source: result.source },
      } as IcpLogPayload,
      'tenant.landing_resolved',
    );
    return result;
  }

  @Get('tenants')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('icp_session')
  @ApiOperation({
    summary: 'Danh sách shop user là member (onboarding/switcher)',
    description:
      'ADR-046 amend (c): FE không đọc được tenant_ids (httpOnly JWT) → endpoint ' +
      'join slug/name. Dùng cho /onboarding (chọn shop) + tenant-switcher.',
  })
  @ApiResponse({ status: 200, type: MyTenantsResponseDto })
  @ApiResponse({ status: 401 })
  async myTenants(@Req() req: AuthedRequest): Promise<MyTenantsResponseDto> {
    const tenants = await this.memberships.findTenants(req.user.id);
    return { tenants } as MyTenantsResponseDto;
  }
}

