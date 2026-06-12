/**
 * apps/gateway/src/intent/intent-action.controller.spec.ts
 *
 * S-P0-01 T03c — F2 ownership-check trên POST /:rid/action: user cầm rid của
 * tenant/user khác → 404 đồng nhất cache-miss; ownership hợp lệ → forward resume.
 */

import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { IntentActionController } from './intent-action.controller';

function makeReq() {
  return { user: { id: 'u-1', tenant_ids: ['t-1'] } } as any;
}

const BODY = { choice: 'accept', _meta: { attempt_n: 1 } } as any;

describe('IntentActionController ownership (T03c F2)', () => {
  it('404 khi assertOwnership false (rid của tenant/user khác) — KHÔNG resume', async () => {
    const ai = { postIntentResume: vi.fn() } as any;
    const intentSvc = { assertOwnership: vi.fn(async () => false) } as any;
    const ctrl = new IntentActionController(ai, intentSvc);

    await expect(ctrl.action('rid-x', BODY, makeReq())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(ai.postIntentResume).not.toHaveBeenCalled();
    expect(intentSvc.assertOwnership).toHaveBeenCalledWith('rid-x', 'u-1', ['t-1']);
  });

  it('forward resume khi ownership hợp lệ', async () => {
    const ai = {
      postIntentResume: vi.fn(async () => ({ request_id: 'rid-1' })),
    } as any;
    const intentSvc = { assertOwnership: vi.fn(async () => true) } as any;
    const ctrl = new IntentActionController(ai, intentSvc);

    const r = await ctrl.action('rid-1', BODY, makeReq());

    expect(r).toEqual({ request_id: 'rid-1', status: 'accepted' });
    expect(ai.postIntentResume).toHaveBeenCalledOnce();
  });
});
