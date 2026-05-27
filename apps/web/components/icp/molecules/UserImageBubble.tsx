'use client';

/**
 * apps/web/components/icp/molecules/UserImageBubble.tsx
 *
 * Molecule: <UserImageBubble> — chat-style sent-image bubble with optional
 * "Ảnh thứ N" badge for re-upload state-F per C-S09-AP NEW.
 *
 * Slice:    S-09 First Image-Based Product Recommendation (Intent 04)
 * Task:     T02 FE + wire (Phiên Sx09-F) — AC32
 *
 * Source:   docs/mockups/intent-04/intent-04-state-A-loading.html lines 207-221
 *           (initial state-A: 148x148 image, no badge)
 *           docs/mockups/intent-04/intent-04-state-F-reupload.html lines 224-237
 *           (state-F: same shape + badge "Ảnh thứ 2" + caption + timestamp)
 *
 * Decisions applied:
 * - **C-S09-AP NEW (Phiên Sx09-F)**: `badgeText?` prop is OPTIONAL — turn 1 omits
 *   it; turn ≥2 passes `"Ảnh thứ {N}"` computed from `previousTurns.length + 1`
 *   at page-level (NOT inside this molecule). Pure FE compute, zero schema.
 * - C-07 navigation-agnostic — no router; pure presentational
 * - C-08 + D-05 VN inline — all text content provided by consumer
 * - C-15 NOT required — pure render, no event handlers (image already encoded)
 * - C-18 Tier 4 Tailwind utility inline + style attr (no @layer additions)
 *
 * Public API:
 *   <UserImageBubble
 *     imageB64="iVBORw0KGgo..." // naked base64 (consumer strips prefix)
 *     caption="Còn cái này thì sao?"        // optional text bubble below image
 *     badgeText="Ảnh thứ 2"                 // optional (only when N≥2 per C-S09-AP)
 *     timestamp="vừa xong"                  // optional sub-text
 *   />
 *
 * Reach: S-09 V-SLICE state-A initial + state-F re-upload.
 */

import * as React from 'react';
import { Icon } from '@/components/icp/atoms';
import { cn } from '@/lib/utils';

export interface UserImageBubbleProps {
  /**
   * Naked base64 image string (NO `data:image/...;base64,` prefix). The molecule
   * adds `data:image/jpeg;base64,` for `<img>` src — caller doesn't need to.
   * Mime type defaults to jpeg (browser handles png/heic gracefully via sniff).
   */
  imageB64: string;
  /** Optional text bubble rendered below image (e.g. "Còn cái này thì sao?"). */
  caption?: string;
  /**
   * Optional badge overlaid on top-left of image. S-09 C-S09-AP: render
   * `"Ảnh thứ {N}"` only when N≥2 (caller computes via
   * `previousTurns.length + 1`).
   */
  badgeText?: string;
  /** Optional sub-text below caption (e.g. "vừa xong"). */
  timestamp?: string;
  /** Mime type for data URL reconstruction. Default 'image/jpeg'. */
  mimeType?: string;
  /** Pass-through className for outer wrapper. */
  className?: string;
}

export function UserImageBubble({
  imageB64,
  caption,
  badgeText,
  timestamp,
  mimeType = 'image/jpeg',
  className,
}: UserImageBubbleProps): React.ReactElement {
  const imageSrc = `data:${mimeType};base64,${imageB64}`;
  return (
    <div className={cn('flex justify-end', className)}>
      <div className="max-w-[78%] flex flex-col gap-1.5 items-end">
        {/* Image card — 148x148 per mockup lines 209/227 */}
        <div className="relative w-[148px] h-[148px] rounded-[18px] overflow-hidden shadow-[0_8px_20px_rgba(233,30,99,0.25)] border-2 border-white">
          <img
            src={imageSrc}
            alt={caption ?? 'Ảnh đã gửi'}
            className="w-full h-full object-cover"
          />
          {badgeText ? (
            <div className="absolute top-1.5 left-1.5 inline-flex items-center gap-[3px] bg-black/50 backdrop-blur-sm text-white text-[9px] font-semibold px-[7px] py-[3px] rounded-md">
              <Icon name="image" size={10} />
              {badgeText}
            </div>
          ) : null}
        </div>

        {caption ? (
          <div className="bg-gradient-to-br from-icp-pink-500 to-icp-rose-500 text-white px-3.5 py-2 rounded-[18px] rounded-br-[4px] text-[13px] font-medium">
            {caption}
          </div>
        ) : null}

        {timestamp ? (
          <div className="text-[9px] text-icp-rose-700 px-1.5">{timestamp}</div>
        ) : null}
      </div>
    </div>
  );
}
