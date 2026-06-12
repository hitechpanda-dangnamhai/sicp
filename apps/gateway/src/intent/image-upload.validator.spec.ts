/**
 * image-upload.validator.spec.ts — S-P0-02/T03 W-63 unit test.
 */
import { describe, it, expect } from 'vitest';
import { HttpException } from '@nestjs/common';
import {
  assertValidImageUpload,
  detectImageMime,
  estimateDecodedBytes,
  stripDataUri,
} from './image-upload.validator';

const b64 = (bytes: number[]): string => Buffer.from(bytes).toString('base64');
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]; // RIFF....WEBP
const EXE = [0x4d, 0x5a, 0x90, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]; // MZ (PE/exe)

describe('detectImageMime', () => {
  it('nhận diện png/jpeg/webp', () => {
    expect(detectImageMime(Buffer.from(PNG))).toBe('png');
    expect(detectImageMime(Buffer.from(JPEG))).toBe('jpeg');
    expect(detectImageMime(Buffer.from(WEBP))).toBe('webp');
  });
  it('null cho .exe đội lốt + buffer rỗng', () => {
    expect(detectImageMime(Buffer.from(EXE))).toBeNull();
    expect(detectImageMime(Buffer.from([]))).toBeNull();
  });
});

describe('stripDataUri', () => {
  it('gỡ prefix data:image/png;base64,', () => {
    expect(stripDataUri('data:image/png;base64,iVBORw0=')).toBe('iVBORw0=');
  });
  it('giữ nguyên khi không có prefix', () => {
    expect(stripDataUri('iVBORw0=')).toBe('iVBORw0=');
  });
});

describe('estimateDecodedBytes', () => {
  it('ước byte từ độ dài base64 (trừ padding)', () => {
    expect(estimateDecodedBytes(b64(PNG))).toBe(12); // 12 byte → 16 char base64
    expect(estimateDecodedBytes('')).toBe(0);
  });
});

describe('assertValidImageUpload', () => {
  it('trả mime cho png/jpeg/webp hợp lệ', () => {
    expect(assertValidImageUpload(b64(PNG), 8_000_000)).toBe('png');
    expect(assertValidImageUpload(b64(JPEG), 8_000_000)).toBe('jpeg');
    expect(assertValidImageUpload(b64(WEBP), 8_000_000)).toBe('webp');
  });

  it('gỡ data-URI rồi validate', () => {
    expect(assertValidImageUpload('data:image/png;base64,' + b64(PNG), 8_000_000)).toBe('png');
  });

  it('415 cho .exe đội lốt .png', () => {
    try {
      assertValidImageUpload(b64(EXE), 8_000_000);
      expect.unreachable('phải ném 415');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(415);
      expect((e as HttpException).getResponse()).toMatchObject({
        error: { code: 'UNSUPPORTED_MEDIA_TYPE' },
      });
    }
  });

  it('413 khi vượt size cap (kiểm TRƯỚC decode)', () => {
    try {
      assertValidImageUpload(b64(PNG), 5); // cap 5 byte < 12 byte
      expect.unreachable('phải ném 413');
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(413);
      expect((e as HttpException).getResponse()).toMatchObject({
        error: { code: 'PAYLOAD_TOO_LARGE' },
      });
    }
  });

  it('415 cho ảnh rỗng', () => {
    try {
      assertValidImageUpload('', 8_000_000);
      expect.unreachable('phải ném 415');
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(415);
    }
  });
});
