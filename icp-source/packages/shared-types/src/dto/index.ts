/**
 * Barrel re-export cho `@icp/shared-types/dto/*`.
 *
 * **Convention:** Mỗi DTO file 1 schema family (`error.dto.ts` cho error
 * envelope, `auth.dto.ts` cho login/me/...). Future DTOs append re-export
 * line này. Import từ FE/BE chỉ qua barrel — KHÔNG deep-import internal
 * file paths.
 *
 * @see docs/08_FE_BE_CONTRACT.md §3
 *
 * S-02 T02 emit.
 */

export * from './error.dto';
