/**
 * Primitive type aliases + Zod schemas dùng chung cross-package.
 *
 * **Scope:** Branded types (compile-time) + reusable Zod refinements
 * (runtime) cho UUID, ISO date, Money (VND integer non-negative).
 *
 * **Why branded types:** `type UUID = string` không khác `string` runtime,
 * nhưng compile-time TS sẽ catch `userId: UUID = "not-a-uuid"` lỗi nếu
 * developer cố assign raw string. Pair với Zod runtime validate ở boundary
 * (request body, env vars) → end-to-end type safety.
 *
 * @see docs/08_FE_BE_CONTRACT.md §3 — Cấu trúc shared types example
 *
 * S-02 T02 emit.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────
// Zod schemas (runtime validation)
// ─────────────────────────────────────────────────────────────────────

/** UUID v4 schema. Used cho `Idempotency-Key` header, entity IDs. */
export const UuidSchema = z.string().uuid();

/** ISO 8601 date string in UTC (e.g. `2026-05-21T13:04:00.000Z`). */
export const IsoDateSchema = z.string().datetime({ offset: false });

/**
 * Money trong hệ thống ICP = VND integer non-negative.
 * NOT decimal — 1 đơn vị = 1 VND. UI render với separators (1.000 đ).
 */
export const MoneySchema = z.number().int().nonnegative();

// ─────────────────────────────────────────────────────────────────────
// Branded types (compile-time)
// ─────────────────────────────────────────────────────────────────────

/** Branded UUID — compile-time tag để phân biệt với plain `string`. */
export type UUID = z.infer<typeof UuidSchema> & { readonly __brand: 'UUID' };

/** Branded ISO date string. */
export type IsoDate = z.infer<typeof IsoDateSchema> & { readonly __brand: 'IsoDate' };

/** Branded Money — VND integer non-negative. */
export type Money = z.infer<typeof MoneySchema> & { readonly __brand: 'Money' };
