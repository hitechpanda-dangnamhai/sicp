/**
 * apps/web/app/api/health/route.ts — Next.js Route Handler GET /api/health
 *
 * Slice:    S-00b Foundation Scaffold (T08)
 *
 * Background — Q-1 Path A LOCKED (Phiên 11 Bước 1 human ack):
 *
 * Compose healthcheck (infra/docker-compose.yml web service) targets URL
 * `http://localhost:3000/api/health`. Next.js standalone production server
 * does not auto-serve any default `/health` path; this Route Handler is
 * required to satisfy the Docker healthcheck, preventing the web container
 * from being marked Unhealthy by Docker Compose.
 *
 * Skeleton execution guide Section 4.8 referenced `/api/health` in two places
 * (compose healthcheck lines 2257 + Dockerfile HEALTHCHECK line 2522) but
 * omitted this route file from the Output expected list (lines 2061-2078).
 * Q-1 Path A reconciles by emitting this 4-line handler.
 *
 * Response shape: minimal `{ status: "ok" }`. S-02 may extend to include
 * upstream readiness probes (DB ping, Redis ping, gateway reachability) per
 * the standard `/health` vs `/ready` distinction; T08 scaffold tier
 * intentionally keeps the surface minimal.
 *
 * Edge runtime not selected — default Node.js runtime allows future
 * server-side service introspection without runtime-swap regressions.
 */

export async function GET() {
  return Response.json({ status: 'ok' });
}
