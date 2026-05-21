/**
 * apps/gateway/src/main.ts
 *
 * NestJS application bootstrap entry point for ICP Gateway.
 *
 * CRITICAL: Line 1 MUST be the OTel SDK side-effect import per
 * docs/06_OBSERVABILITY.md §3.1: "Trong main.ts: import './observability/otel';
 * — BẮT BUỘC ở dòng đầu, trước mọi import khác". Otherwise Node module cache
 * is sealed before auto-instrumentations can patch http/express/ioredis/etc.
 */

// ↓↓↓ MUST BE FIRST. DO NOT MOVE. ↓↓↓
import './observability/otel';
// ↑↑↑ MUST BE FIRST. DO NOT MOVE. ↑↑↑

import { NestFactory } from '@nestjs/core';
import { INestApplication, Logger as NestLogger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { patchNestJsSwagger } from 'nestjs-zod';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { AppModule } from './app.module';
import { createLogger } from './observability';

// Patch NestJS Swagger to understand Zod-derived DTOs (nestjs-zod).
// Must be called BEFORE SwaggerModule.createDocument().
patchNestJsSwagger();

const logger = createLogger({
  service: process.env.OTEL_SERVICE_NAME ?? 'gateway',
  version: process.env.APP_VERSION ?? '0.0.1',
  env: process.env.NODE_ENV ?? 'dev',
});

function buildSwaggerDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('ICP Gateway API')
    .setDescription(
      'Intelligent Commerce Platform — REST API.\n\n' +
        '4 mutating endpoints require `Idempotency-Key` header (UUID v4) ' +
        'per docs/03_API_CONTRACTS.md §1.',
    )
    .setVersion(process.env.APP_VERSION ?? '0.0.1')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'jwt',
    )
    .addServer('http://localhost:3001', 'Local dev')
    .addTag('health', 'Liveness + readiness probes')
    .addTag('auth', 'Authentication (S-03 First Auth Flow)')
    .addTag('intent', 'Universal intent endpoint (S-02 T07 SSE wrapper + AI dispatch)')
    .addTag('products', 'Product CRUD (V-SLICE)')
    .addTag('cart', 'Shopping cart (V-SLICE S-05)')
    .addTag('orders', 'Order checkout (V-SLICE S-06)')
    .build();

  return SwaggerModule.createDocument(app, config);
}

async function exportOpenApi(app: INestApplication): Promise<void> {
  const doc = buildSwaggerDocument(app);
  // Resolve relative to package root (apps/gateway/). At runtime cwd may
  // be /app inside container; resolve relative to this file's compiled dir.
  // From apps/gateway/dist/main.js → ../../packages/shared-types/openapi.json
  const outPath = resolve(
    __dirname,
    '..',
    '..',
    '..',
    'packages',
    'shared-types',
    'openapi.json',
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(doc, null, 2), 'utf8');
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      service: 'gateway',
      message: 'openapi.exported',
      extras: { path: outPath, byteSize: JSON.stringify(doc).length },
    }),
  );
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // NestJS built-in logger is bypassed; we use pino via createLogger() in
    // service classes. Suppress NestJS internal "info: route mapped" noise
    // by setting logger=false; keep 'error' for actual Nest framework errors.
    logger: ['error', 'warn'],
    bufferLogs: false,
  });

  // Global validation: T01 uses `nestjs-zod` per-DTO via `createZodDto()`
  // (see 08_FE_BE_CONTRACT.md §4.2). NO global ValidationPipe needed — that
  // would require `class-validator` + `class-transformer` deps which we don't
  // use. Phase 06: if mixed Zod/class-validator emerges, add ValidationPipe
  // back here AFTER installing both deps.

  // CORS — dev mode per 03_API §8
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  // EXPORT_OPENAPI=true short-circuit: write openapi.json to shared-types
  // package and exit. Used by `pnpm openapi:export` script (T02 will add
  // openapi:generate + openapi:sync to consume this).
  if (process.env.EXPORT_OPENAPI === 'true') {
    await exportOpenApi(app);
    await app.close();
    process.exit(0);
  }

  // Mount Swagger UI at /docs
  const document = buildSwaggerDocument(app);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // Trust proxy header (X-Forwarded-For) for accurate client IP in logs
  // when behind reverse proxy (relevant for prod; dev OK either way).
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');

  logger.info({
    message: 'service.started',
    extras: {
      port,
      env: process.env.NODE_ENV,
      version: process.env.APP_VERSION,
      swagger_url: `http://localhost:${port}/docs`,
    },
  });
}

bootstrap().catch((err) => {
  // Bootstrap-level error: log + exit. OTel SDK shutdown is wired in
  // observability/otel.ts SIGTERM/SIGINT handlers; bootstrap failure won't
  // emit them — instead log directly to stdout in canonical schema shape.
  const nestLogger = new NestLogger('bootstrap');
  nestLogger.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'fatal',
      service: 'gateway',
      message: 'service.bootstrap_failed',
      error_message: err instanceof Error ? err.message : String(err),
      extras: { stack: err instanceof Error ? err.stack : undefined },
    }),
  );
  process.exit(1);
});
