/**
 * apps/workers/src/observability/otel.ts
 *
 * OpenTelemetry SDK bootstrap cho ICP workers service — mirror
 * apps/gateway/src/observability/otel.ts (ADR-011 OTel-first).
 *
 * CRITICAL: import FILE NÀY Ở DÒNG ĐẦU `housekeeper.ts` TRƯỚC mọi import khác,
 * nếu không auto-instrumentation (pg/ioredis) không patch được module trước khi
 * load (Node module cache final sau require đầu).
 *
 * Exporter = OTLP gRPC tới otel-collector:4317 (D-01). Versions @opentelemetry/*
 * pin theo root pnpm.overrides (1.25.1 / 0.52.1) — build trong pnpm workspace.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes as A } from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

if (process.env.OTEL_LOG_LEVEL === 'debug') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

const otlpEndpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4317';
const serviceName = process.env.OTEL_SERVICE_NAME ?? 'workers';
const serviceVersion = process.env.APP_VERSION ?? '0.0.1';
const deploymentEnv = process.env.NODE_ENV ?? 'dev';

export const sdk = new NodeSDK({
  resource: new Resource({
    [A.SERVICE_NAME]: serviceName,
    [A.SERVICE_VERSION]: serviceVersion,
    [A.DEPLOYMENT_ENVIRONMENT]: deploymentEnv,
  }),
  traceExporter: new OTLPTraceExporter({ url: otlpEndpoint }),
  logRecordProcessor: new BatchLogRecordProcessor(
    new OTLPLogExporter({ url: otlpEndpoint }),
  ),
  // Worker không phải HTTP server → bỏ metrics reader (ít noise; trace + log đủ).
  // Auto-instrument pg + ioredis (fs off — noisy, vô giá trị chẩn đoán).
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();

// KHÔNG đăng ký signal handler ở đây — housekeeper.ts sở hữu shutdown có thứ tự
// (stop cron → release Redis lock → close pg/redis → sdk.shutdown flush spans).
// Tránh double process.exit race giữa 2 handler.
