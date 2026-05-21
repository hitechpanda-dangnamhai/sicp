/**
 * apps/gateway/src/observability/index.ts
 *
 * Barrel export for the observability module.
 *
 * IMPORTANT: Do NOT re-export from `./otel` here, because that would cause
 * any consumer of this barrel to load the OTel SDK side-effect. The OTel
 * bootstrap is intentionally side-effect-only and must ONLY be imported
 * directly as the FIRST line of main.ts via `import './observability/otel'`.
 *
 * This barrel exports the logger factory and types for use throughout the app.
 */

export { createLogger } from './logger';
export type { CreateLoggerOptions, IcpLogPayload } from './logger';
