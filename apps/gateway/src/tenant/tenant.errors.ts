/**
 * apps/gateway/src/tenant/tenant.errors.ts
 *
 * S-P0-01 T02 — lỗi tenant context (ADR-046 amendment b).
 */

import { BadRequestException } from '@nestjs/common';

/**
 * Không resolve được tenant từ JWT lẫn header X-Tenant-Id trên endpoint cần
 * tenant scope → 400. Extend `BadRequestException` để map HTTP 400 tự động
 * (envelope `{error:{code,message}}` đồng nhất repo). CẤM silent drop /
 * persist tenant_id=NULL (ADR-046 amendment b).
 */
export class TenantContextMissingError extends BadRequestException {
  constructor() {
    super({
      error: {
        code: 'TENANT_CONTEXT_MISSING',
        message:
          'Tenant context required: provide an authenticated session (JWT tenant) ' +
          'or X-Tenant-Id header.',
      },
    });
  }
}
