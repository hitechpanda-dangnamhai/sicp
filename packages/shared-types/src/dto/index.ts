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
 * S-07 T02 amendment (Phiên Sx07-F per C-S07-O option iii-a):
 *   ADD `intent-suggest-attrs.dto.ts` for the NEW POST /intent/{rid}/suggest-attrs
 *   endpoint (Sx07-G hotfix).
 */

export * from './error.dto';
export * from './intent-suggest-attrs.dto';
