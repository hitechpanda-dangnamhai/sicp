/**
 * apps/gateway/src/common/zod-validation.pipe.ts
 *
 * S-P0-02/T03 W-58 — global ZodValidationPipe (nestjs-zod) đăng ký APP-level.
 * TRƯỚC: mọi createZodDto ở Gateway là TRANG TRÍ (no pipe → body bypass runtime
 * validate; INVENTORY insight #1). SAU: body sai schema → 400.
 *
 * Error envelope = HIỆN HÀNH `{ error: { code, message } }` (auth/idempotency
 * controller). KHÔNG redesign envelope (= W-44/C3). Field-level chi tiết vào
 * `error.details` (additive trong envelope, không đổi shape ngoài).
 */

import { BadRequestException } from '@nestjs/common';
import { createZodValidationPipe } from 'nestjs-zod';
import type { ZodError } from 'zod';

/** Gộp issue Zod thành message ngắn + details có cấu trúc. */
function toEnvelope(error: ZodError): BadRequestException {
  const details = error.issues.map((i) => ({
    path: i.path.join('.'),
    code: i.code,
    message: i.message,
  }));
  const first = details[0];
  const message = first
    ? `Validation failed: ${first.path || '(root)'} — ${first.message}`
    : 'Validation failed';
  return new BadRequestException({
    error: { code: 'VALIDATION_FAILED', message, details },
  });
}

/**
 * ZodValidationPipe map ZodError → BadRequestException envelope hiện hành.
 * Đăng ký global qua APP_PIPE (app.module). Pipe CHỈ validate khi metatype là
 * ZodDto (createZodDto); body/param không phải ZodDto → pass-through (an toàn
 * cho route nhận type thường).
 */
export const ZodValidationPipe = createZodValidationPipe({
  createValidationException: toEnvelope,
});

// Export riêng cho unit test (kiểm shape envelope không cần dựng pipe).
export { toEnvelope as zodErrorToEnvelope };
