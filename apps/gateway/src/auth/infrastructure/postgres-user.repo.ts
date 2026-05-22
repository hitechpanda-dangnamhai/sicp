/**
 * apps/gateway/src/auth/infrastructure/postgres-user.repo.ts
 *
 * Postgres repository for `users` table per `02_DATA_MODEL §1` (post-V009).
 *
 * Operations:
 *   - findByEmail(email): for /auth/login lookup
 *   - findById(id):       for /auth/me + JwtAuthGuard fallback (unused now,
 *                         reserved for S-04+ when guard might need user row)
 *
 * Index strategy: `users.email` is UNIQUE NOT NULL → has implicit index from
 * UNIQUE constraint. `users.id` is PK. Both lookups O(log n).
 *
 * OTel: pg.query span auto-emitted by T01 setup; manual span NOT needed.
 *
 * S-03 T02 emit.
 */

import { Injectable } from '@nestjs/common';
import { PgPool } from '../../database';
import type { User } from '../domain/user.entity';

@Injectable()
export class PostgresUserRepository {
  constructor(private readonly pg: PgPool) {}

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.pg.query<User>(
      `SELECT id, email, password_hash, role, display_name, created_at
         FROM users
        WHERE email = $1
        LIMIT 1`,
      [email],
    );
    return result.rows[0] ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.pg.query<User>(
      `SELECT id, email, password_hash, role, display_name, created_at
         FROM users
        WHERE id = $1
        LIMIT 1`,
      [id],
    );
    return result.rows[0] ?? null;
  }
}
