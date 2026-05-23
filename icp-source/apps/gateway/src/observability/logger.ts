/**
 * apps/gateway/src/observability/logger.ts
 *
 * Structured JSON logger using pino with 6 LOCKED schema fields per
 * docs/06_OBSERVABILITY.md §4.
 *
 * LOCKED fields (every log entry MUST contain):
 *   - timestamp  ISO 8601 UTC
 *   - level      'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
 *   - service    'gateway' | 'ai' | 'mcp' | ...
 *   - trace_id   hex (OTel auto-inject via context)
 *   - span_id    hex (OTel auto-inject)
 *   - message    snake_case event name from LOG_CATALOG.md (NOT free-form)
 *
 * OPTIONAL fields (only when relevant):
 *   request_id, user_id, intent, phase, duration_ms, ok,
 *   error_code, error_message, extras
 *
 * CRITICAL anti-patterns (per 06_OBS §4 forbidden):
 *   - logger.info(`User ${u.email} did X`)  ← free-form interpolation
 *   - Mỗi service tự define schema riêng    ← must use createLogger()
 *
 * Source-of-truth: docs/06_OBSERVABILITY.md §4 + §5 + §6
 * LOG_CATALOG.md = registry for `message` field values (append-only).
 */

import pino, { Logger, LoggerOptions } from 'pino';
import { trace, context } from '@opentelemetry/api';

/**
 * Resolve current trace context from OTel API.
 * Returns empty strings if no active span (e.g. logs emitted during bootstrap
 * before first HTTP request) — schema fields still present, just blank.
 */
const traceContextMixin = (): Record<string, string> => {
  const span = trace.getSpan(context.active());
  if (!span) {
    return { trace_id: '', span_id: '' };
  }
  const ctx = span.spanContext();
  return {
    trace_id: ctx.traceId,
    span_id: ctx.spanId,
  };
};

export interface CreateLoggerOptions {
  /** Service name — populated into `service` field (LOCKED). */
  service: string;
  /** Service version — populated into `version` field (OPTIONAL but recommended). */
  version: string;
  /** Deployment env — populated into `env` field. */
  env?: string;
  /** Log level. Default: 'info' (prod), 'debug' (dev). */
  level?: pino.LevelWithSilent;
}

/**
 * Create a pino logger pre-configured with ICP schema.
 *
 * Usage:
 *   const logger = createLogger({ service: 'gateway', version: '0.0.1' });
 *   logger.info({ message: 'service.started', extras: { port: 3001 } });
 *
 * NEVER do:
 *   logger.info('service started on port 3001')  ← free-form, no `message` field
 */
export function createLogger(opts: CreateLoggerOptions): Logger {
  const level =
    opts.level ?? (opts.env === 'production' ? 'info' : 'debug');

  const baseConfig: LoggerOptions = {
    level,
    // pino default field name swaps: `time` → `timestamp` (LOCKED schema)
    // ISO 8601 UTC string format (NOT epoch ms).
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    formatters: {
      // pino default emits `level` as numeric (30=info, 50=error). Force string.
      level: (label) => ({ level: label }),
      // Pass through `service`/`version`/`env` from `base`; strip pino default
      // `pid` and `hostname` (not in LOCKED schema). C-08 fix Phiên 22:
      // returning `() => ({})` here wipes ALL base fields including `service`,
      // producing `service: null` in output — violates LOCKED schema rule.
      bindings: (b) => ({
        service: b['service'],
        version: b['version'],
        env: b['env'],
      }),
    },
    base: {
      service: opts.service,
      version: opts.version,
      env: opts.env ?? process.env.NODE_ENV ?? 'dev',
    },
    // Inject OTel trace context on every log call.
    mixin: traceContextMixin,
    // Redact sensitive fields per 06_OBS §7. Hackathon scope: minimal list.
    redact: {
      paths: [
        'password',
        '*.password',
        'authorization',
        '*.authorization',
        'token',
        '*.token',
        'access_token',
        'refresh_token',
        'jwt',
        // Don't redact `jti` — that's safe to log per 06_OBS §7
      ],
      censor: '[REDACTED]',
    },
  };

  // In dev mode (no NODE_ENV=production), optionally use pino-pretty for
  // human-readable stdout. In production / container, raw JSON to stdout
  // → collected by docker logging driver → OTel collector (via pino-opentelemetry-transport
  // optional; for Hackathon scope, container stdout → Loki via promtail / OTel filelog
  // receiver is simpler and equivalent).
  if (process.env.NODE_ENV !== 'production' && process.stdout.isTTY) {
    return pino({
      ...baseConfig,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  return pino(baseConfig);
}

/**
 * Type guard: assert that a structured log object has the LOCKED `message`
 * field (snake_case event name). Use in critical log call sites where
 * compile-time type checking is desired.
 *
 * Phase 06 linter rule will grep code for `logger.info(...)` calls and verify
 * every one has a `message` field matching LOG_CATALOG.md entries.
 */
export interface IcpLogPayload {
  /** REQUIRED. snake_case event name from LOG_CATALOG.md */
  message: string;
  /** OPTIONAL. Set on entry to authenticated request. */
  user_id?: string;
  /** OPTIONAL. HTTP request correlation id. */
  request_id?: string;
  /** OPTIONAL. Intent name when inside intent flow. */
  intent?: string;
  /** OPTIONAL. Multi-stage flow phase. */
  phase?: string;
  /** OPTIONAL. Operation duration in milliseconds. */
  duration_ms?: number;
  /** OPTIONAL. Operation success flag. */
  ok?: boolean;
  /** OPTIONAL. Error code (when ok=false). */
  error_code?: string;
  /** OPTIONAL. Error message (when ok=false). */
  error_message?: string;
  /** OPTIONAL. Domain-specific nested object. */
  extras?: Record<string, unknown>;
}
