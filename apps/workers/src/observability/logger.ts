/**
 * apps/workers/src/observability/logger.ts
 *
 * Structured JSON logger (pino) với 6 LOCKED schema fields per
 * docs/06_OBSERVABILITY.md §4 — mirror apps/gateway/src/observability/logger.ts
 * (Single Home pattern = code; workers là service Node thứ 2 dùng pino).
 *
 * LOCKED fields mọi entry: timestamp · level · service · trace_id · span_id ·
 * message (snake_case từ LOG_CATALOG.md, KHÔNG free-form).
 * OPTIONAL: request_id, user_id, intent, phase, duration_ms, ok,
 * error_code, error_message, extras.
 */

import pino, { Logger, LoggerOptions } from 'pino';
import { trace, context } from '@opentelemetry/api';

/** Inject OTel trace context vào mọi log (rỗng khi không có active span). */
const traceContextMixin = (): Record<string, string> => {
  const span = trace.getSpan(context.active());
  if (!span) {
    return { trace_id: '', span_id: '' };
  }
  const ctx = span.spanContext();
  return { trace_id: ctx.traceId, span_id: ctx.spanId };
};

export interface CreateLoggerOptions {
  service: string;
  version: string;
  env?: string;
  level?: pino.LevelWithSilent;
}

/**
 * Tạo pino logger chuẩn ICP schema.
 * Usage: logger.info({ message: 'housekeeper.started', extras: { ... } });
 * CẤM: logger.info('housekeeper started')  ← free-form, thiếu `message`.
 */
export function createLogger(opts: CreateLoggerOptions): Logger {
  const level = opts.level ?? (opts.env === 'production' ? 'info' : 'debug');

  const baseConfig: LoggerOptions = {
    level,
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    formatters: {
      level: (label) => ({ level: label }),
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
    mixin: traceContextMixin,
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
      ],
      censor: '[REDACTED]',
    },
  };

  if (process.env.NODE_ENV !== 'production' && process.stdout.isTTY) {
    return pino({
      ...baseConfig,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
      },
    });
  }

  return pino(baseConfig);
}
