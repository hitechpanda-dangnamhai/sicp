/**
 * zod-validation.pipe.spec.ts — S-P0-02/T03 W-58: envelope 400 đúng shape.
 */
import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { zodErrorToEnvelope } from './zod-validation.pipe';

describe('zodErrorToEnvelope', () => {
  const schema = z.object({ modality: z.enum(['text', 'image', 'voice']) });

  it('map ZodError → { error: { code: VALIDATION_FAILED, message, details } }', () => {
    const parsed = schema.safeParse({ modality: 123 });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const ex = zodErrorToEnvelope(parsed.error);
    expect(ex).toBeInstanceOf(BadRequestException);
    expect(ex.getStatus()).toBe(400);
    const body = ex.getResponse() as { error: { code: string; message: string; details: unknown[] } };
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.message).toContain('modality');
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details.length).toBeGreaterThan(0);
  });
});
