/**
 * apps/gateway/src/public/public.controller.ts
 *
 * S-P0-01 T02 — endpoint PUBLIC bootstrap tenant context (ADR-046 amendment b).
 *
 * GET /api/v1/public/tenant-by-slug/:slug → { tenant_id, name }.
 *
 * **KHÔNG auth, KHÔNG tenant context** — đây là cách FE (storefront /s/<slug>)
 * lấy tenant_id từ slug để rồi attach `X-Tenant-Id` cho mọi request anonymous
 * sau đó. Vì vậy nó KHÔNG được đi qua TenantResolverService (chicken-and-egg).
 *
 * `tenants` là bảng GLOBAL (V011 — KHÔNG RLS, KHÔNG tenant_id) → query trực tiếp
 * bằng PgPool dưới role icp_app (GRANT SELECT) an toàn, không cần withTenant().
 * 404 nếu slug không tồn tại / tenant không active.
 */

import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PgPool } from '../database';
import { TenantBySlugResponseDto } from './dto/tenant-by-slug.dto';
import { createLogger, type IcpLogPayload } from '../observability';

@ApiTags('public')
@Controller('api/v1/public')
export class PublicController {
  private readonly log = createLogger({
    service: 'gateway',
    version: process.env.APP_VERSION ?? '0.0.1',
    env: process.env.NODE_ENV ?? 'dev',
  }).child({ component: 'public.controller' });

  constructor(private readonly pg: PgPool) {}

  @Get('tenant-by-slug/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resolve tenant_id từ slug (public, no auth)',
    description:
      'FE storefront /s/<slug> gọi 1 lần để lấy tenant_id rồi attach X-Tenant-Id ' +
      'cho request anonymous (tracking/public). KHÔNG auth, KHÔNG tenant context ' +
      '(bootstrap). 404 nếu slug không tồn tại hoặc tenant không active. ADR-046 amend (b).',
  })
  @ApiParam({ name: 'slug', description: 'DNS-safe tenant slug (a-z0-9-)' })
  @ApiResponse({ status: 200, type: TenantBySlugResponseDto })
  @ApiResponse({ status: 404, description: 'Tenant not found or not active' })
  async tenantBySlug(@Param('slug') slug: string): Promise<TenantBySlugResponseDto> {
    const result = await this.pg.query<{ id: string; name: string }>(
      `SELECT id, name FROM tenants WHERE slug = $1 AND status = 'active' LIMIT 1`,
      [slug],
    );
    const row = result.rows[0];
    if (!row) {
      this.log.warn(
        { message: 'public.tenant_not_found', extras: { slug } } as IcpLogPayload,
        'public.tenant_not_found',
      );
      throw new NotFoundException({
        error: { code: 'TENANT_NOT_FOUND', message: `No active tenant for slug: ${slug}` },
      });
    }
    return { tenant_id: row.id, name: row.name } as TenantBySlugResponseDto;
  }
}
