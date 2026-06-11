/**
 * apps/gateway/src/public/public.module.ts
 *
 * S-P0-01 T02 — public bootstrap endpoints (no auth, no tenant context).
 * Hiện chỉ GET /api/v1/public/tenant-by-slug/:slug (ADR-046 amendment b).
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database';
import { PublicController } from './public.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [PublicController],
})
export class PublicModule {}
