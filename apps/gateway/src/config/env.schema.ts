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
 */

import { z } from 'zod';

export const EnvSchema = z.object({
  // Runtime
  NODE_ENV: z.enum(['dev', 'test', 'production']).default('dev'),
  APP_VERSION: z.string().default('0.0.1'),
  PORT: z.coerce.number().int().positive().default(3001),

  // Database
  DATABASE_URL: z
    .string()
    .url()
    .describe('Postgres connection URL, e.g. postgres://user:pass@postgres:5432/icp'),

  // Cache (idempotency + future session storage)
  REDIS_URL: z
    .string()
    .url()
    .describe('Redis connection URL, e.g. redis://redis:6379'),

  // Auth (validated here; actual JWT verify implementation in S-03)
  JWT_SECRET: z.string().min(32, {
    message: 'JWT_SECRET must be at least 32 characters for HS256 security',
  }),

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

  // CORS (dev only — per 03_API §8)
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
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
