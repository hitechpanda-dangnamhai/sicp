/**
 * apps/gateway/src/config/env.schema.ts
 *
 * Environment variable schema for ICP Gateway service.
 *
 * Validated at boot via @nestjs/config `ConfigModule.forRoot({ validate })`.
 * Service fails-fast (`process.exit(1)`) on validation error — per
 * docs/phases/PHASE_01_INFRA.md Day 3 "Env vars validation ở startup
 * (fail-fast), bao gồm OTEL_EXPORTER_OTLP_ENDPOINT".
 *
 * Source-of-truth for env names: INDEX_PROJECT.md `.env.example` row (S-00b T01)
 * + docs/06_OBSERVABILITY.md §16 OTel env vars.
 *
 * S-03 T02 amendment: +JWT_ACCESS_TTL_HOURS + JWT_REFRESH_TTL_DAYS + COOKIE_SECURE
 * per PHASE_02_AUTH_SEARCH §A "JWT HS256 ... exp 24h" + "Refresh ... exp 30d".
 * COOKIE_SECURE default false for dev (HTTP localhost); production must override
 * via .env to `true` (per ADR-019 + 03_API_CONTRACTS §1.1).
 */

import { z } from 'zod';

export const EnvSchema = z.object({
  // Runtime
  NODE_ENV: z.enum(['dev', 'test', 'production']).default('dev'),
  APP_VERSION: z.string().default('0.0.1'),
  PORT: z.coerce.number().int().positive().default(3001),

  // Database
  // S-P0-01 (ADR-040 amendment ii): runtime creds. Cutover sang role icp_app
  // (NOBYPASSRLS) ở T02/T03 khi withTenant()/SET LOCAL đã wire.
  DATABASE_URL: z
    .string()
    .url()
    .describe('Postgres runtime connection URL (icp_app sau T02/T03 cutover)'),

  // DATABASE_URL_MIGRATE: superuser, CHỈ infra/migrations/apply.sh tiêu thụ —
  // gateway runtime KHÔNG dùng. Optional ở schema này (gateway boot không cần),
  // nhưng nếu set thì validate URL hợp lệ. Tách khỏi DATABASE_URL để CREATE
  // ROLE/RLS/GRANT chạy bằng superuser.
  DATABASE_URL_MIGRATE: z
    .string()
    .url()
    .optional()
    .describe('Superuser URL cho apply.sh; gateway runtime không đọc'),

  // Cache (idempotency + session storage)
  REDIS_URL: z
    .string()
    .url()
    .describe('Redis connection URL, e.g. redis://redis:6379'),

  // Auth (validated here; actual JWT verify implementation in S-03 T02)
  JWT_SECRET: z.string().min(32, {
    message: 'JWT_SECRET must be at least 32 characters for HS256 security',
  }),

  // S-03 T02 — JWT TTLs per PHASE_02 §A. Coerce because env vars arrive as strings.
  JWT_ACCESS_TTL_HOURS: z.coerce
    .number()
    .int()
    .positive()
    .default(24)
    .describe('Access JWT TTL in hours (per PHASE_02 §A "exp 24h")'),
  JWT_REFRESH_TTL_DAYS: z.coerce
    .number()
    .int()
    .positive()
    .default(30)
    .describe('Refresh token TTL in days (per PHASE_02 §A "exp 30d")'),

  // S-03 T02 — Cookie security flag. dev=false (HTTP localhost); prod=true.
  // Parsed as string "true"/"false" → boolean via transform.
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true')
    .describe('Set Secure flag on auth cookies (dev=false for HTTP localhost; prod=true)'),

  // Kafka (broker list for future producer use; T01 doesn't publish yet)
  KAFKA_BROKERS: z
    .string()
    .default('redpanda:9092')
    .describe('Comma-separated Kafka broker addresses'),

  // OTel — per 06_OBS §16
  OTEL_SERVICE_NAME: z.string().default('gateway'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z
    .string()
    .url()
    .default('http://otel-collector:4317'),
  OTEL_EXPORTER_OTLP_PROTOCOL: z.enum(['grpc', 'http/protobuf']).default('grpc'),
  OTEL_RESOURCE_ATTRIBUTES: z.string().default('deployment.environment=dev'),
  OTEL_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  OTEL_TRACES_SAMPLER: z.string().default('parentbased_always_on'),

  // Upstream service URLs (S-02 T05 — Gateway → AI HTTP client)
  AI_SERVICE_URL: z
    .string()
    .url()
    .default('http://ai:5001')
    .describe('Base URL of AI service (apps/ai/), default resolves inside docker-compose network'),

  // CORS (dev only — per 03_API §8)
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // ── S-P0-02/T03 W-62 helmet CSP mode ──────────────────────────────────────
  // CSP rollout an toàn: 'report-only' 2 tuần đầu (header Content-Security-Policy-
  // Report-Only, KHÔNG block) → 'enforce' khi report sạch. 'off' = không gửi CSP.
  // HSTS/X-Frame-Options/nosniff luôn bật (không qua flag này).
  // ⚠️ GATE (ratify Plan KI#3 T03): CẤM đặt CSP_MODE=enforce trong mọi task
  // tương lai mà KHÔNG có phán quyết Plan riêng. Lý do: enforce +
  // upgrade-insecure-requests sẽ vỡ HTTP dev — cần report sạch 2 tuần + quyết
  // định tường minh trước khi enforce.
  CSP_MODE: z.enum(['off', 'report-only', 'enforce']).default('report-only'),

  // ── S-P0-02/T03 W-60 throttle (env-tunable) ───────────────────────────────
  // 2 cửa sổ global: short (per-min) + long (per-hour). Per-route override ở
  // decorator. Per-tenant quota KHÔNG ở đây (W-99/C-tenant).
  THROTTLE_SHORT_LIMIT: z.coerce.number().int().positive().default(100),
  THROTTLE_SHORT_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LONG_LIMIT: z.coerce.number().int().positive().default(1000),
  THROTTLE_LONG_TTL_MS: z.coerce.number().int().positive().default(3_600_000),
  THROTTLE_LOGIN_LIMIT: z.coerce.number().int().positive().default(5),
  THROTTLE_LOGIN_HOURLY_LIMIT: z.coerce.number().int().positive().default(20),
  THROTTLE_FORGOT_HOURLY_LIMIT: z.coerce.number().int().positive().default(3),
  THROTTLE_INTENT_LIMIT: z.coerce.number().int().positive().default(20),

  // ── S-P0-02/T03 W-63 image upload guard ───────────────────────────────────
  // Size cap RAW bytes sau decode-prefix (kiểm độ dài base64 TRƯỚC decode để
  // không nạp payload khổng lồ). Default 8MB raw (~10.7MB base64 — dưới trần
  // transport 10MB của intent-request.dto).
  IMAGE_MAX_BYTES: z.coerce.number().int().positive().default(8_000_000),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Validator function for @nestjs/config ConfigModule.forRoot({ validate }).
 *
 * NestJS calls this with `process.env` at module init. Returns parsed env
 * object (typed) on success; throws on failure → ConfigModule prints
 * structured error + process exits non-zero.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'fatal',
        service: 'gateway',
        message: 'env.validation_failed',
        error_code: 'INVALID_ENV',
        extras: {
          issues: result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            code: issue.code,
            message: issue.message,
          })),
        },
      }),
    );
    throw new Error('Environment variable validation failed. See log above.');
  }
  return result.data;
}
