/**
 * apps/gateway/src/cards/cards.controller.ts
 *
 * S-07 T01.E NEW (Phiên Sx07-D per C-S07-A): Action Cards REST endpoints
 * for Intent 01 import-by-image flow. Thin proxy to MCP cards.* tools.
 *
 * Endpoints:
 *   GET    /api/v1/cards                 — list pending cards for current user
 *   POST   /api/v1/cards/:id/accept      — mark card accepted (idempotent)
 *   POST   /api/v1/cards/:id/reject      — mark card rejected (idempotent)
 *
 * Auth: All endpoints require `icp_session` cookie (JwtAuthGuard). Request
 * type is `AuthedRequest` re-exported from jwt-auth.guard.ts — same pattern
 * dashboard.controller.ts uses for strict req.user typing per AuthedUser
 * canonical shape: { id, email, role, display_name, jti }.
 *
 * Idempotency: Mutating routes guarded by IdempotencyMiddleware (per ADR-004).
 *
 * Reference:
 *   - slices/S-07_decisions-log.md C-S07-A (Worker Pattern A + cards formalized)
 *   - apps/gateway/src/auth/jwt-auth.guard.ts (AuthedUser + AuthedRequest types)
 *   - apps/gateway/src/dashboard/dashboard.controller.ts (precedent pattern)
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard, type AuthedRequest } from '../auth/jwt-auth.guard';
import { McpClient } from '../clients/mcp.client';
import type { McpIdentity } from '../clients/mcp-identity';
import { TenantResolverService } from '../tenant/tenant-resolver.service';
import { TenantMembershipGuard } from '../tenant/tenant-membership.guard';

@ApiTags('cards')
@ApiCookieAuth('icp_session')
// S-P0-01 T03d — merchant route: tenant strict. TenantMembershipGuard ném 400
// (thiếu header) / 403 (∉ tenant_ids) TRƯỚC handler → vá lỗ authz customer
// 0-membership gọi endpoint merchant + đảm bảo X-Tenant-Id luôn hiện diện cho MCP.
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
@Controller('api/v1/cards')
export class CardsController {
  constructor(
    private readonly mcp: McpClient,
    private readonly tenant: TenantResolverService,
  ) {}

  /** S-P0-01 T03d — identity header cho MCP (tenant strict: resolve() non-null;
   * guard đã validate ∈ tenant_ids). */
  private identity(req: AuthedRequest): McpIdentity {
    return { userId: req.user.id, tenantId: this.tenant.resolve(req).tenantId };
  }

  @Get()
  @ApiOperation({
    summary: 'List pending action cards for current user',
    description:
      'Returns cards in `pending` status sorted by `created_at` DESC. ' +
      'Per S-07 Intent 01: cards are emitted in-band via SSE during the ' +
      'import flow; this endpoint serves as a refresh/refetch source if ' +
      'the merchant returns to the page later.',
  })
  async list(
    @Req() req: AuthedRequest,
    @Query('limit') limitRaw?: string,
  ): Promise<unknown> {
    const limit = limitRaw ? Math.max(1, Math.min(200, Number(limitRaw) || 50)) : 50;
    return this.mcp.call(
      'cards.list_pending',
      {
        user_id: req.user.id,
        limit,
      },
      this.identity(req),
    );
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark action card as accepted',
    description:
      'Sets card.status = accepted + resolved_at = NOW(). Idempotent: ' +
      'duplicate requests return {updated: false}. Optional applied_value ' +
      'is merged into suggestion JSONB for audit.',
  })
  async accept(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: { applied_value?: Record<string, unknown> } = {},
  ): Promise<unknown> {
    return this.mcp.call(
      'cards.update_status',
      {
        card_id: id,
        status: 'accepted',
        applied_value: body.applied_value ?? null,
      },
      this.identity(req),
    );
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark action card as rejected',
    description:
      'Sets card.status = rejected + resolved_at = NOW(). Idempotent: ' +
      'duplicate requests return {updated: false}.',
  })
  async reject(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<unknown> {
    return this.mcp.call(
      'cards.update_status',
      {
        card_id: id,
        status: 'rejected',
      },
      this.identity(req),
    );
  }
}
