/**
 * apps/gateway/src/intent/intent.controller.spec.ts
 *
 * S-P0-01 T03c — F1 (JwtAuthGuard áp lên /stream) + F2 (ownership-check trước
 * subscribe). Cross-tenant/cross-user rid → 404 đồng nhất cache-miss. Cookie
 * invalid → 401 do JwtAuthGuard (verify ở auth spec; ở đây chứng minh guard ĐÃ
 * wired vào /stream qua metadata).
 */

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { IntentController } from './intent.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

function makeController(assertOwnership: () => Promise<boolean>) {
  const intentSvc = { assertOwnership: vi.fn(assertOwnership) } as any;
  return new IntentController(intentSvc, {} as any, {} as any);
}

const req = { user: { id: 'u-1', tenant_ids: ['t-1'] } } as any;

describe('IntentController.stream ownership (T03c F2)', () => {
  it('404 khi assertOwnership false (rid cross-tenant/cross-user) — không mở SSE', async () => {
    const ctrl = makeController(async () => false);
    // res không bao giờ chạm vì throw TRƯỚC khi mở stream.
    await expect(ctrl.stream('rid-x', req, {} as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('404 khi thiếu query id', async () => {
    const ctrl = makeController(async () => true);
    await expect(ctrl.stream('', req, {} as any)).rejects.toBeInstanceOf(
      NotFoundException,
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
