/**
 * apps/web/src/features/recommend/image-uploader.ts
 *
 * Pure utility — extract base64 + size validate from File upload.
 *
 * Slice:    S-09 First Image-Based Product Recommendation (Intent 04)
 * Task:     T02 FE + wire (Phiên Sx09-F)
 *
 * Source:   EXTRACTED from S-07 ship `apps/web/components/icp/molecules/ImageDropZone.tsx`
 *           lines 44-71 (internal FileReader + stripDataUrlPrefix logic) per Phiên Sx09-E
 *           reuse-max audit Section 6.B "EXTRACT utility (~50 LOC) from S-07 ImageDropZone
 *           internal logic" + Sx09-F Section 5 Bước 3 Commit 1 step 3.1.
 *
 * Decisions applied:
 * - C-S07-G LAW (Phiên Sx07-B): client-side 8MB hard cap before base64 + POST
 *   (Gateway DTO accepts ~10MB; FE blocks early for UX). Same constant
 *   `MAX_IMAGE_BYTES = 8 * 1024 * 1024` reused verbatim.
 * - ADR-01-NN (S-07 T01): BE expects naked base64 (NO `data:image/...;base64,`
 *   prefix). FileReader.readAsDataURL → strip prefix → emit naked b64.
 * - C-15 NOT required: pure utility, no React hooks/JSX/DOM deps beyond
 *   FileReader (browser API; safe in 'use client' callers).
 *
 * Why extracted (NOT just re-import from ImageDropZone):
 * - S-09 page wire calls `submitImage(image_b64)` directly with already-encoded
 *   base64 string after camera re-upload state-F (see state-machine APPEND_NEW_TURN
 *   reducer per D-S09-NN-B LAW). ImageDropZone owns its own FileReader internal
 *   for state-0 entry; state-F re-upload uses page-level <input type="file" hidden>
 *   bound to camera icon onClick.
 * - Extracting keeps single source of truth + testable in isolation (Vitest
 *   `AC29 image-uploader.ts validates <8MB OK; >8MB throws; base64 encodes
 *   correctly stripping data: prefix`).
 *
 * @see slices/S-09_decisions-log.md (C-S07-G LAW inherited)
 * @see apps/web/components/icp/molecules/ImageDropZone.tsx lines 44-71 (original)
 */

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB per C-S07-G LAW

/** Discriminated error class — caller distinguishes via `kind`. */
export class ImageUploadError extends Error {
  constructor(
    public readonly kind: 'too_large' | 'not_image' | 'read_failed',
    message: string,
  ) {
    super(message);
    this.name = 'ImageUploadError';
  }
}

export interface ImageUploadResult {
  /** Naked base64 string — NO `data:image/...;base64,` prefix. */
  base64: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
}

/**
 * Strip the `data:...;base64,` prefix from `FileReader.readAsDataURL` output
 * to give caller pure base64. BE expects naked b64 (verified vision.py
 * line 218-221 — same logic FE-side).
 */
export function stripDataUrlPrefix(dataUrl: string): string {
  const commaIdx = dataUrl.indexOf(',');
  return commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
}

/**
 * Read a File → naked base64 + meta. Throws `ImageUploadError` on validation
 * fail (too_large / not_image) or FileReader fail (read_failed).
 *
 * @param file Browser File from <input type=file> change event
 * @returns Promise<ImageUploadResult> with naked base64
 * @throws ImageUploadError
 */
export async function readImageAsBase64(file: File): Promise<ImageUploadResult> {
  // Validate MIME — be defensive even though <input accept="image/*"> filters
  if (!file.type.startsWith('image/')) {
    throw new ImageUploadError(
      'not_image',
      'Tệp phải là ảnh (jpg/png/heic).',
    );
  }

  // Validate size (C-S07-G LAW 8MB)
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageUploadError(
      'too_large',
      `Ảnh quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB). Tối đa 8MB.`,
    );
  }

  // Read as data URL → strip prefix → emit naked b64
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new ImageUploadError('read_failed', 'FileReader returned non-string'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () =>
      reject(
        new ImageUploadError(
          'read_failed',
          reader.error?.message ?? 'Đọc ảnh thất bại',
        ),
      );
    reader.readAsDataURL(file);
  });

  return {
    base64: stripDataUrlPrefix(dataUrl),
    fileName: file.name,
    sizeBytes: file.size,
    mimeType: file.type,
  };
}
