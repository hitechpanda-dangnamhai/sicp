/**
 * apps/gateway/src/intent/intent-suggest-attrs.controller.spec.ts
 *
 * S-P0-01 T03d — merchant route tenant strict: handler suggestAttrs
 * (vision.suggest_attributes) mang CẢ JwtAuthGuard + TenantMembershipGuard
 * (method-level).
 */

import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { IntentSuggestAttrsController } from './intent-suggest-attrs.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantMembershipGuard } from '../tenant/tenant-membership.guard';

describe('IntentSuggestAttrsController guard wiring (T03d)', () => {
  it('handler suggestAttrs mang JwtAuthGuard + TenantMembershipGuard', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      IntentSuggestAttrsController.prototype.suggestAttrs,
    ) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(TenantMembershipGuard);
  });
});
