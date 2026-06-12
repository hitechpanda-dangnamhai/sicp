/**
 * apps/gateway/src/intent/intent.controller.spec.ts
 *
 * S-P0-01 T03c — F1 (JwtAuthGuard áp lên /stream) + F2 (ownership-check trước
 * subscribe). Cross-tenant/cross-user rid → 404 đồng nhất cache-miss.
 * S-P0-01 T03e (ADR-050 §4) — membership gate SAU ownership: customer-allowed
 * PASS, membership-required + owner ∉ tenant → 403.
 */

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { IntentController } from './intent.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { IntentCacheEntry } from './intent.service';

const OWNED: IntentCacheEntry = {
  request_id: 'rid-1',
  user_id: 'u-1',
  tenant_id: 't-1',
  membership_required: false,
};

function makeController(opts: {
  assertOwnership: () => Promise<IntentCacheEntry | null>;
  isMembershipSatisfied?: () => boolean;
}) {
  const intentSvc = {
    assertOwnership: vi.fn(opts.assertOwnership),
    isMembershipSatisfied: vi.fn(opts.isMembershipSatisfied ?? (() => true)),
  } as any;
  return new IntentController(intentSvc, {} as any, {} as any);
}

const req = { user: { id: 'u-1', tenant_ids: ['t-1'] } } as any;

describe('IntentController.stream ownership (T03c F2)', () => {
  it('404 khi assertOwnership null (rid cross-tenant/cross-user) — không mở SSE', async () => {
    const ctrl = makeController({ assertOwnership: async () => null });
    await expect(ctrl.stream('rid-x', req, {} as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('404 khi thiếu query id', async () => {
    const ctrl = makeController({ assertOwnership: async () => OWNED });
    await expect(ctrl.stream('', req, {} as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('IntentController.stream membership gate (T03e ADR-050 §4)', () => {
  it('403 khi ownership OK nhưng membership-required + owner ∉ tenant', async () => {
    const ctrl = makeController({
      assertOwnership: async () => ({ ...OWNED, membership_required: true }),
      isMembershipSatisfied: () => false,
    });
    await expect(ctrl.stream('rid-1', req, {} as any)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('IntentController.stream auth wiring (T03c F1)', () => {
  it('JwtAuthGuard áp lên handler stream (cookie invalid → 401 do guard)', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      IntentController.prototype.stream,
    ) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
  });
});
