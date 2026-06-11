/**
 * apps/gateway/src/main.ts
 *
 * NestJS application bootstrap entry point for ICP Gateway.
 *
 * CRITICAL: Line 1 MUST be the OTel SDK side-effect import per
 * docs/06_OBSERVABILITY.md §3.1: "Trong main.ts: import './observability/otel';
 * — BẮT BUỘC ở dòng đầu, trước mọi import khác". Otherwise Node module cache
 * is sealed before auto-instrumentations can patch http/express/ioredis/etc.
 *
 * S-03 T02 amendment: + `app.use(cookieParser())` global middleware after
 * `enableCors()` per S-03 C-13 RESOLVED Phiên 32. Replaces S-02 T07 inline
 * `readCookie()` helper in intent.controller.ts (S02-C-40 handoff closure).
 * cookie-parser populates `req.cookies` typed dict — JwtAuthGuard reads from
 * there instead of parsing `req.headers.cookie` manually.
 *
 * S-07 T01.E amendment (Phiên Sx07-D per C-S07-G Option ❶): + `useBodyParser`
 * 10mb limit for `application/json` after cookieParser. NestJS default body
 * parser limit is 100KB which is too small for Intent 01 base64 image content
 * (~67KB for 50KB JPEG; up to ~7.5MB for high-res phone camera). Paired with
 * `intent-request.dto.ts` `content: z.string().min(1).max(10_000_000)` so the
 * application-layer Zod validation reflects the transport-layer ceiling.
 * Multipart upload deferred (reuse-max: zero changes to FE EventSource +
 * existing JSON-only intent body handling). See slices/S-07_decisions-log.md
 * C-S07-G Option ❶ rationale + verify command #11 inspection.
 */

// ↓↓↓ MUST BE FIRST. DO NOT MOVE. ↓↓↓
import './observability/otel';
// ↑↑↑ MUST BE FIRST. DO NOT MOVE. ↑↑↑

import { NestFactory } from '@nestjs/core';
import { INestApplication, Logger as NestLogger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { patchNestJsSwagger } from 'nestjs-zod';
import cookieParser from 'cookie-parser';
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
    .addCookieAuth('icp_session', {
      type: 'apiKey',
      in: 'cookie',
      name: 'icp_session',
      description: 'httpOnly session cookie issued by POST /auth/login (per ADR-019 + S-03 C-01).',
    })
    .addServer('http://localhost:3001', 'Local dev')
    .addTag('health', 'Liveness + readiness probes')
    .addTag('auth', 'Authentication (S-03 First Auth Flow)')
    .addTag('intent', 'Universal intent endpoint (S-02 T07 SSE wrapper + AI dispatch)')
    .addTag('products', 'Product CRUD (V-SLICE)')
    .addTag('cart', 'Shopping cart (V-SLICE S-05)')
    .addTag('cards', 'Action cards (V-SLICE S-07)')
    .addTag('orders', 'Order checkout (V-SLICE S-06)')
    .build();

  return SwaggerModule.createDocument(app, config);
}

async function exportOpenApi(app: INestApplication): Promise<void> {
  const doc = buildSwaggerDocument(app);
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
  // S-07 T01.E: Type-narrow to NestExpressApplication so app.useBodyParser()
  // is available (NestJS 10.0+ Express-specific method). Per C-S07-G Option ❶.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn'],
    bufferLogs: false,
  });

  // CORS — dev mode per 03_API §8
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
    // S-P0-01 T02 (ADR-046 amend b): +X-Tenant-Id để FE attach tenant cho
    // request anonymous. Liệt kê tường minh các custom header đang dùng
    // (Idempotency-Key, X-Request-Id) để không vỡ khi set allowedHeaders.
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'X-Request-Id',
      'X-Tenant-Id',
    ],
  });

  // S-03 T02 — Global cookie-parser middleware (replaces S-02 T07 inline
  // readCookie helper per C-13 RESOLVED). JwtAuthGuard reads req.cookies.icp_session.
  // No secret arg → cookies parsed but NOT signed (we use httpOnly + Secure
  // for trust; JWT itself is signed via JWT_SECRET).
  app.use(cookieParser());

  // S-07 T01.E NEW per C-S07-G Option ❶: bump JSON body parser limit
  // 100KB (NestJS default) → 10mb to accept base64 image content for
  // Intent 01 import-by-image flow. Paired with
  // intent-request.dto.ts max(10_000_000) Zod validation.
  // useBodyParser() = NestJS 10.0+ Express-specific overload.
  app.useBodyParser('json', { limit: '10mb' });

  // EXPORT_OPENAPI=true short-circuit
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
