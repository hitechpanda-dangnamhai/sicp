/**
 * apps/gateway/src/intent/image-upload.validator.ts
 *
 * S-P0-02/T03 W-63 (đóng BACKLOG #8) — magic-byte sniff + size cap cho ảnh
 * upload TRƯỚC khi base64-decode toàn bộ / đẩy sang vision (Gemini). TRƯỚC:
 * upload chỉ check size (intent-request.dto.ts:57 `.max(10M)`), KHÔNG MIME →
 * .exe đội lốt .png lọt tới vision (INVENTORY W-63).
 *
 * Whitelist: png/jpeg/webp. Sai magic → 415. Vượt size → 413 (kiểm độ dài
 * base64 TRƯỚC decode để không nạp payload khổng lồ vào RAM).
 */

import { HttpException, HttpStatus } from '@nestjs/common';

export type ImageMime = 'png' | 'jpeg' | 'webp';

/** Strip data-URI prefix `data:image/...;base64,` nếu có. PURE. */
export function stripDataUri(content: string): string {
  const m = /^data:[^;,]*;base64,/.exec(content);
  return m ? content.slice(m[0].length) : content;
}

/** Ước byte sau decode từ độ dài base64 (TRƯỚC khi decode). PURE. */
export function estimateDecodedBytes(base64: string): number {
  const len = base64.length;
  if (len === 0) return 0;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

/** Nhận diện MIME từ magic-byte (decode prefix). null = không khớp whitelist. PURE. */
export function detectImageMime(prefix: Buffer): ImageMime | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    prefix.length >= 8 &&
    prefix[0] === 0x89 &&
    prefix[1] === 0x50 &&
    prefix[2] === 0x4e &&
    prefix[3] === 0x47 &&
    prefix[4] === 0x0d &&
    prefix[5] === 0x0a &&
    prefix[6] === 0x1a &&
    prefix[7] === 0x0a
  ) {
    return 'png';
  }
  // JPEG: FF D8 FF
  if (prefix.length >= 3 && prefix[0] === 0xff && prefix[1] === 0xd8 && prefix[2] === 0xff) {
    return 'jpeg';
  }
  // WEBP: "RIFF" (0..3) + "WEBP" (8..11)
  if (
    prefix.length >= 12 &&
    prefix.toString('ascii', 0, 4) === 'RIFF' &&
    prefix.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

function reject(code: 'PAYLOAD_TOO_LARGE' | 'UNSUPPORTED_MEDIA_TYPE', message: string, status: HttpStatus): never {
  throw new HttpException({ error: { code, message } }, status);
}

/**
 * Validate ảnh base64. Trả MIME nếu hợp lệ; ném 413/415 nếu không.
 * Gọi TRƯỚC khi forward AI (modality='image'). maxBytes = IMAGE_MAX_BYTES env.
 */
export function assertValidImageUpload(content: string, maxBytes: number): ImageMime {
  const base64 = stripDataUri(content);
  if (base64.length === 0) {
    reject('UNSUPPORTED_MEDIA_TYPE', 'Ảnh rỗng', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
  }
  // Size cap TRƯỚC decode (ước từ độ dài base64).
  if (estimateDecodedBytes(base64) > maxBytes) {
    reject(
      'PAYLOAD_TOO_LARGE',
      `Ảnh vượt giới hạn ${maxBytes} bytes`,
      HttpStatus.PAYLOAD_TOO_LARGE,
    );
  }
  // Chỉ decode 16 bytes đầu (24 base64 char) để đọc magic — KHÔNG decode toàn bộ.
  let prefix: Buffer;
  try {
    prefix = Buffer.from(base64.slice(0, 24), 'base64');
  } catch {
    reject('UNSUPPORTED_MEDIA_TYPE', 'base64 không hợp lệ', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
  }
  const mime = detectImageMime(prefix);
  if (!mime) {
    reject(
      'UNSUPPORTED_MEDIA_TYPE',
      'Định dạng ảnh không hỗ trợ (chỉ png/jpeg/webp)',
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    );
  }
  return mime;
}
