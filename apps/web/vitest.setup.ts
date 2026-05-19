/**
 * apps/web/vitest.setup.ts
 *
 * Slice:    S-01 UI Foundation
 * Task:     T03 Layout Primitives — Phiên 15 fix-in-place patch (per C-19)
 *
 * Purpose:  Load @testing-library/jest-dom custom matchers (toHaveClass,
 *           toBeInTheDocument, toHaveAttribute, toHaveTextContent, etc.) into
 *           vitest's `expect()` API + TypeScript types.
 *
 * Decisions:
 * - C-19 (Phiên 15) — T01 vitest.config.ts không có setupFiles reference; T02
 *   atoms.test.tsx không trigger gap vì không dùng jest-dom matchers. T03
 *   layout.test.tsx là test đầu tiên dùng matchers → expose tooling gap.
 *   Fix-in-place: add vitest.setup.ts + reference trong vitest.config.ts.
 *
 * Pattern lock: Tất cả future test files trong S-01 + downstream slices có thể
 *   dùng jest-dom matchers từ T03 trở đi. T02 atoms.test.tsx sẽ continue PASS
 *   với plain assertions (no migration needed).
 */
import '@testing-library/jest-dom/vitest';
