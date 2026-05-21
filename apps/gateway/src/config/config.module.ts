/**
 * apps/gateway/src/config/config.module.ts
 *
 * NestJS ConfigModule wrapper with Zod validation via `@nestjs/config`.
 *
 * Pattern (C-05 Phiên 22 fix): `NestConfigModule.forRoot({ isGlobal: true })`
 * registers ConfigService as a global provider — any module can inject
 * ConfigService without re-importing. Therefore THIS wrapper module:
 *   - imports NestConfigModule.forRoot(...) to apply validation
 *   - exports the NestConfigModule (the module itself, NOT its providers)
 *
 * Anti-pattern (the bug that crashed bootstrap before fix):
 *   exports: [ConfigService]  // ❌ ConfigService is NOT a provider of this
 *                             //    module — it lives in NestConfigModule.
 *                             // Nest DI strict validation rejects.
 *
 * Correct pattern:
 *   exports: [NestConfigModule]  // ✅ Re-export the entire wrapped module
 *
 * Reference: NestJS docs "Dynamic Modules" — when wrapping a configured
 * module, export the module class, not its providers.
 */

import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { validateEnv } from './env.schema';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      // No `.env` file loading at runtime — Hackathon containers receive
      // env via docker-compose `environment:` directive. Local dev uses
      // .env loaded by Docker, not by Nest.
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      envFilePath: ['.env.local', '.env'],
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
