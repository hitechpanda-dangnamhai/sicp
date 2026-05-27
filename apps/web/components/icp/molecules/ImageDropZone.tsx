'use client';

/**
 * apps/web/components/icp/molecules/ImageDropZone.tsx
 *
 * Molecule: <ImageDropZone> — state-0 entry surface for Intent 01 import.
 *
 * Slice:    S-07 T02 — Frontend Cluster
 *
 * Source:   `docs/mockups/intent-01/intent-01-state-0-capture.html` lines 180-340
 *           (per D-29 LAW Mockup filename is LAW)
 *
 * Decisions applied:
 * - **ADR-01-02** (S-07 BRIEF): NOT live camera — 2 buttons "Chụp ảnh" (file
 *   input capture="environment") + "Chọn từ thư viện" (file input no capture).
 *   Browser native picker handles both; no MediaStream API needed.
 * - **D-29 LAW**: JSDoc cites mockup filename verbatim
 * - **C-S07-G** (Phiên Sx07-B): client-side 8MB guard before base64 encode +
 *   POST (Gateway DTO accepts up to ~10MB, but FE blocks early for UX).
 * - **ADR-01-NN** (S-07 T01): `image_data` is inline base64 — `FileReader`
 *   readAsDataURL → strip `data:image/...;base64,` prefix → emit naked b64.
 * - **C-07** navigation-agnostic — `onUpload(base64)` callback only
 * - **C-15** 'use client' — uses FileReader (browser API) + useRef + useState
 * - **C-18** Tier 4 Tailwind utility inline
 *
 * **Why 2 buttons, NOT a drop zone (despite filename):**
 * Mockup state-0 shows 2 explicit CTAs targeting mobile-first usage where
 * drag-drop is not native. "DropZone" is the legacy molecule name from S-07
 * BRIEF; actual UI = capture button row.
 *
 * **Why FileReader (NOT URL.createObjectURL):**
 * BE expects inline base64 in POST /intent body (ADR-01-NN). Object URLs
 * would require a second upload step (S3 presigned URL etc) — out of scope
 * S-07 hackathon. Trade-off: larger request body (~33% inflation), acceptable
 * for ≤8MB images.
 *
 * Reach: S-07 V-SLICE state-0 — single use site at /intent-01 page.
 */

import * as React from 'react';
import { Button, Spinner, Icon } from '@/components/icp/atoms';
import { cn } from '@/lib/utils';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB hard cap per C-S07-G

export interface ImageDropZoneProps {
  /**
   * Fired with naked base64 string (NO `data:image/...;base64,` prefix).
   * Caller responsible for downstream POST /intent with `{content: <b64>, modality: 'image'}`.
   */
  onUpload: (base64: string, meta: { fileName: string; sizeBytes: number; mimeType: string }) => void | Promise<void>;
  /** External loading state — disables both buttons + shows spinner. */
  loading?: boolean;
  /** Optional className passthrough. */
  className?: string;
}

interface FileError {
  kind: 'too_large' | 'not_image' | 'read_failed';
  message: string;
}

/**
 * Strip the `data:...;base64,` prefix from `FileReader.readAsDataURL` output
 * to give caller pure base64. BE expects naked b64 (verified via vision.py
 * line 218-221 — same logic FE-side).
 */
function stripDataUrlPrefix(dataUrl: string): string {
  const commaIdx = dataUrl.indexOf(',');
  return commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
}

export function ImageDropZone({
  onUpload,
  loading = false,
  className,
}: ImageDropZoneProps) {
  const captureInputRef = React.useRef<HTMLInputElement>(null);
  const libraryInputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<FileError | null>(null);

  const handleFile = React.useCallback(
    async (file: File) => {
      setError(null);

      // Validate MIME (browser allows wildcards via accept attr but be defensive)
      if (!file.type.startsWith('image/')) {
        setError({
          kind: 'not_image',
          message: 'Tệp phải là ảnh (jpg/png/heic).',
        });
        return;
      }

      // Validate size (C-S07-G 8MB)
      if (file.size > MAX_IMAGE_BYTES) {
        setError({
          kind: 'too_large',
          message: `Ảnh quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB). Tối đa 8MB.`,
        });
        return;
      }

      // Read as data URL → strip prefix → emit naked b64
      const reader = new FileReader();
      const dataUrlPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result;
          if (typeof result !== 'string') {
            reject(new Error('FileReader returned non-string'));
            return;
          }
          resolve(result);
        };
        reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
        reader.readAsDataURL(file);
      });

      try {
        const dataUrl = await dataUrlPromise;
        const naked = stripDataUrlPrefix(dataUrl);
        await onUpload(naked, {
          fileName: file.name,
          sizeBytes: file.size,
          mimeType: file.type,
        });
      } catch (err) {
        setError({
          kind: 'read_failed',
          message: err instanceof Error ? err.message : 'Đọc ảnh thất bại',
        });
      }
    },
    [onUpload],
  );

  const handleCaptureChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
      // Reset input so same file can be re-selected (Chrome quirk)
      e.target.value = '';
    },
    [handleFile],
  );

  const handleLibraryChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
      e.target.value = '';
    },
    [handleFile],
  );

  const handleCaptureClick = React.useCallback(() => {
    captureInputRef.current?.click();
  }, []);

  const handleLibraryClick = React.useCallback(() => {
    libraryInputRef.current?.click();
  }, []);

  return (
    <div className={cn('w-full flex flex-col items-center px-5 py-6', className)}>
      {/* Hidden file inputs */}
      <input
        ref={captureInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCaptureChange}
        className="hidden"
        aria-hidden="true"
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        onChange={handleLibraryChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* Hero illustration — placeholder image icon in pink gradient circle */}
      <div className="mb-5 relative">
        <div
          className={cn(
            'w-32 h-32 rounded-full flex items-center justify-center',
            'bg-gradient-to-br from-pink-100 via-pink-50 to-orange-50',
            'shadow-[0_8px_24px_rgba(233,30,99,0.18)]',
            'border-[0.5px] border-icp-pink-200',
          )}
        >
          <Icon name="camera" size={56} className="text-icp-pink-700" />
        </div>
      </div>

      {/* Title + subtitle */}
      <h2 className="text-[18px] font-bold text-icp-pink-900 mb-1.5 text-center">
        Chụp ảnh để nhập sản phẩm
      </h2>
      <p className="text-[13px] text-icp-pink-700 text-center max-w-[280px] mb-6 leading-relaxed">
        Em sẽ tự động nhận diện sản phẩm, gợi ý giá và đối chiếu thị trường giúp anh.
      </p>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="w-full max-w-[320px] mb-3 rounded-xl px-3 py-2.5 bg-rose-50 border-[0.5px] border-rose-200"
        >
          <p className="text-[12px] font-semibold text-rose-700">{error.message}</p>
        </div>
      )}

      {/* 2 buttons — primary Chụp ảnh + secondary Thư viện */}
      <div className="w-full max-w-[320px] flex flex-col gap-2.5">
        <Button
          type="button"
          variant="pink-grad"
          size="lg"
          loading={loading}
          disabled={loading}
          leftIcon="camera"
          onClick={handleCaptureClick}
          className="w-full"
        >
          Chụp ảnh
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          disabled={loading}
          leftIcon="image"
          onClick={handleLibraryClick}
          className="w-full"
        >
          Chọn từ thư viện
        </Button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="mt-4 flex items-center gap-2 text-icp-pink-700">
          <Spinner size="sm" color="pink" />
          <span className="text-[12px] font-medium">Đang tải ảnh...</span>
        </div>
      )}

      {/* Helper text */}
      <p className="mt-5 text-[11px] text-icp-pink-700/70 text-center">
        Tối đa 8MB · JPG, PNG, HEIC
      </p>
    </div>
  );
}
