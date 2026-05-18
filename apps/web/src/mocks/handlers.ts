/**
 * apps/web/src/mocks/handlers.ts — MSW v2 request handlers
 *
 * Slice:    S-00b Foundation Scaffold (T08) — empty stub.
 *
 * MSW (Mock Service Worker) intercepts gateway API calls during local dev
 * (`pnpm dev`) and CI tests so the frontend can develop in parallel with the
 * backend per docs/08_FE_BE_CONTRACT.md Section 8.2 (Mock-first contract
 * pattern).
 *
 * S-00b T08: empty array stub. No handlers — Next.js dev server will fall
 * through to real gateway calls (or fail with network error if gateway not
 * running).
 *
 * S-02 P-CAP populates handlers as gateway OpenAPI codegen lands:
 *   import { http, HttpResponse } from 'msw';
 *   import type { IntentDetectResponse } from '@icp/shared-types';
 *   export const handlers = [
 *     http.post('/api/v1/intent/detect', () => HttpResponse.json<IntentDetectResponse>({...})),
 *     ...
 *   ];
 */

import { http, HttpResponse } from 'msw';

// Reference symbols so the import is not pruned by TS noUnusedLocals at
// scaffold tier. S-02 will consume `http` + `HttpResponse` in actual handler
// declarations and this `void` line is removed.
void http;
void HttpResponse;

export const handlers = [
  // MSW handlers populated by S-02 P-CAP (per docs/08_FE_BE_CONTRACT.md Section 8.2).
  // S-00b T08: empty array stub.
];
