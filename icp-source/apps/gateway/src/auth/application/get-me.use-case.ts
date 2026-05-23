/**
 * apps/gateway/src/auth/application/get-me.use-case.ts
 *
 * Use-case: build /auth/me response per S-03 BRIEF DM-4 + C-05 + C-07.
 *
 * Flow:
 *   1. UserRepo.findById(userId) — fresh DB read (NOT from JWT payload, since
 *      display_name may have been updated post-issuance Phase 6+)
 *   2. SessionRepo.lastLoginAt(userId) — MAX(issued_at) WHERE revoked_at IS NULL
 *   3. Compute avatar_initials server-side per C-05
 *   4. Return MeResponse shape
 *
 * Guard runs before this — userId is trusted (verified JWT + session live).
 *
 * Edge case: user deleted between login + /auth/me (e.g. admin nuked row) →
 * UserRepo returns null → throw error. Controller maps to 401 (treat as
 * session invalidation).
 *
 * S-03 T02 emit.
 */

import { Injectable } from '@nestjs/common';
import { PostgresUserRepository } from '../infrastructure/postgres-user.repo';
import { PostgresSessionRepository } from '../infrastructure/postgres-session.repo';
import { TokenInvalidError } from '../domain/errors';
import { computeAvatarInitials, type MeResponse } from '../domain/user.entity';

export interface GetMeCommand {
  userId: string;
}

@Injectable()
export class GetMeUseCase {
  constructor(
    private readonly users: PostgresUserRepository,
    private readonly sessions: PostgresSessionRepository,
  ) {}

  async execute(cmd: GetMeCommand): Promise<MeResponse> {
    const user = await this.users.findById(cmd.userId);
    if (!user) {
      // User row gone but Guard accepted JWT — treat as session not found.
      throw new TokenInvalidError('session_not_found');
    }
    const lastLoginAt = await this.sessions.lastLoginAt(cmd.userId);
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      display_name: user.display_name,
      avatar_initials: computeAvatarInitials(user.display_name),
      last_login_at: lastLoginAt ? lastLoginAt.toISOString() : null,
    };
  }
}
