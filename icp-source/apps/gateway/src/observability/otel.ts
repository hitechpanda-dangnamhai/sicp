/**
 * apps/gateway/src/observability/otel.ts
 *
 * OpenTelemetry SDK bootstrap for ICP Gateway service.
 *
 * CRITICAL: This file MUST be imported as the FIRST line of main.ts BEFORE
 * any other import. Otherwise auto-instrumentations cannot patch modules
 * before they are loaded (Node module cache is final after first require).
 *
 * Source-of-truth: docs/06_OBSERVABILITY.md §3.1 (NestJS deps + bootstrap pattern).
 *
 * Decisions applied:
 *   - D-01 (S-02 Phase 1): OTel exporter protocol = OTLP gRPC (see
 *     slices/S-02_decisions-log.md). All 3 exporters (-trace, -logs, -metrics)
 *     use grpc package family. Collector endpoint default
 *     `http://otel-collector:4317`.
 *   - ADR-011: OpenTelemetry-first observability mandate.
 *
 * Env vars (validated by config/env.schema.ts before service mount):
 *   - OTEL_SERVICE_NAME             (e.g. "gateway")
 *   - OTEL_EXPORTER_OTLP_ENDPOINT   (e.g. "http://otel-collector:4317")
 *   - OTEL_EXPORTER_OTLP_PROTOCOL   ("grpc" — fixed by D-01)
 *   - OTEL_RESOURCE_ATTRIBUTES      (e.g. "deployment.environment=dev")
 *   - OTEL_TRACES_SAMPLER           ("parentbased_always_on" Hackathon default)
 *   - APP_VERSION                   (e.g. "0.0.1")
 *   - NODE_ENV                      ("dev" | "production")
 *
 * Graceful shutdown: SIGTERM/SIGINT → sdk.shutdown() to flush buffered spans
 * before process exit (otherwise last batch of spans may be lost).
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import {
  BatchLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import {
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import {
  SemanticResourceAttributes as A,
} from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

// Debug OTel itself (only when explicitly enabled — keep stdout clean by default)
if (process.env.OTEL_LOG_LEVEL === 'debug') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

const otlpEndpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4317';

const serviceName = process.env.OTEL_SERVICE_NAME ?? 'gateway';
const serviceVersion = process.env.APP_VERSION ?? '0.0.1';
const deploymentEnv = process.env.NODE_ENV ?? 'dev';

export const sdk = new NodeSDK({
  resource: new Resource({
    [A.SERVICE_NAME]: serviceName,
    [A.SERVICE_VERSION]: serviceVersion,
    [A.DEPLOYMENT_ENVIRONMENT]: deploymentEnv,
  }),

  // Traces → Tempo via OTel Collector
  traceExporter: new OTLPTraceExporter({
    url: otlpEndpoint,
  }),

  // Logs → Loki via OTel Collector (otlphttp/loki exporter on collector side
  // per S-00b C22.a). The SDK side just emits via OTLP gRPC regardless.
  // NodeSDK v0.52 API: singular `logRecordProcessor` (NOT plural).
  logRecordProcessor: new BatchLogRecordProcessor(
    new OTLPLogExporter({ url: otlpEndpoint }),
  ),

  // Metrics → Prometheus via OTel Collector (collector remote-write to
  // Prometheus per S-00b T07 config).
  //
  // Note (C-03 Phiên 22 resolution): All @opentelemetry/* 1.x core packages
  // are pinned to EXACT `1.25.1` via `pnpm.overrides` in ROOT package.json
  // to match @opentelemetry/sdk-node v0.52.1 transitive expectation.
  // Without overrides, pnpm resolves to latest 1.30.x for some core packages
  // (transitive from @nestjs/swagger or others) → NodeSDK's transitive 1.25.x
  // rejects assignment with TS2322 (private `_shutdown` declarations differ).
  // Affected pins: sdk-metrics, resources, semantic-conventions, core, api-logs.
  // Will bump together when SDK Node releases v0.53+ unified.
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: otlpEndpoint }),
    exportIntervalMillis: 10_000, // 10s, Hackathon scope low volume OK
  }),

  // Auto-instrumentations for http, express, ioredis, pg, etc.
  // Disable `fs` instrumentation per 06_OBS §3.1 — too noisy, no diagnostic value.
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      // Suppress healthcheck noise; HealthController handles its own observability.
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingRequestHook: (req) => {
          const url = req.url ?? '';
          return url.startsWith('/api/v1/health');
        },
      },
    }),
  ],
});

sdk.start();

// ---- Graceful shutdown hooks ----
// Per Rule 8 — flush spans before exit. Without this, k8s rolling restarts
// or local Ctrl-C can lose the last batch of traces (10s export interval).
const shutdown = async (signal: string): Promise<void> => {
  try {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        service: serviceName,
        message: 'service.shutting_down',
        extras: { signal },
      }),
    );
    await sdk.shutdown();
    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        service: serviceName,
        message: 'service.shutdown_failed',
        error_message: err instanceof Error ? err.message : String(err),
      }),
    );
    process.exit(1);
  }
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
