/**
 * `@icp/shared-types/behavior/nav-events.ts`
 *
 * **Behavior Event Properties Schemas — Navigation subset (07_BEHAVIOR §3.7).**
 *
 * Navigation events emitted FE-side by tracker SDK:
 * - **`nav.settings_section_opened`** (S-03 T03 Phiên 33) — settings menu row taps
 *   per V-SLICE S-03 T05 stub settings routes (state-F profile page Bell/Shield/Help).
 * - **`nav.tile_clicked`** (S-03 T03b Phiên 36) — Dashboard hub tile click → emit
 *   event + navigate to placeholder intent route per S-03 D-11 + R1 mapping (C-23
 *   LOCKED). 6 tiles (2 Hero + 4 List) map to 6 V-SLICE intent routes:
 *   `/intent-01` (S-07 Nhập hàng), `/intent-02` (S-08 Mua hàng), `/intent-03`
 *   (S-04 Tìm sản phẩm), `/intent-04` (S-09 Gợi ý), `/intent-05` (S-05 Giỏ hàng),
 *   `/intent-07` (S-10 Phân tích). Captures funnel "which Dashboard tile drives
 *   most intent navigation?" analytics.
 *
 * **§3.7 added Phiên 30 C-07 + extended Phiên 36 C-24/D-11/C-23** — Rule 6 session
 * LAW "mockup features đầy đủ" coverage for settings menu + Dashboard tiles.
 *
 * @see docs/07_BEHAVIOR_LOGS.md §3.7 (Navigation)
 * @see docs/LOG_CATALOG.md Section B "Navigation" (per C-15)
 * @see slices/S-03_decisions-log.md D-11 (MAR-1 Q6 RESOLVED) + C-23 (R1 mapping)
 *
 * S-03 T03 emit (Phiên 33). Extended S-03 T03b emit (Phiên 36 Batch 2 — `nav.tile_clicked`).
 */

import { z } from 'zod';

/**
 * `nav.settings_section_opened` — emitted FE-side when user taps settings
 * menu row in profile page state-F (one of 3 stub routes per S-03 T05).
 *
 * Closed enum `section` matches 3 stub routes:
 *   - `notifications` → `/me/notifications`
 *   - `security`      → `/me/security`
 *   - `help`          → `/me/help`
 */
export const NavSettingsSectionOpenedPropertiesSchema = z
  .object({
    section: z.enum(['notifications', 'security', 'help']),
  })
  .strict();

/**
 * `nav.tile_clicked` — emitted FE-side when user taps any Dashboard tile
 * (2 Hero + 4 List per `golden-reference-mockup.html`).
 *
 * **R1 mapping LOCKED Phiên 35 per S-03 C-23** — `tile_id` (VN snake_case)
 * maps 1:1 to `intent_id` (placeholder route, future V-SLICE owner):
 *
 *   | tile_id          | intent_id   | mockup label    | future slice |
 *   |------------------|-------------|-----------------|--------------|
 *   | nhap_hang        | intent-01   | "Nhập hàng"     | S-07 (Image AI) |
 *   | phan_tich        | intent-07   | "Phân tích"     | S-10 (Analytics) |
 *   | tim_san_pham     | intent-03   | "Tìm sản phẩm"  | S-04 (Discovery) |
 *   | mua_hang         | intent-02   | "Mua hàng"      | S-08 (Voice Buy) |
 *   | goi_y_san_pham   | intent-04   | "Gợi ý"         | S-09 (Recommend) |
 *   | gio_hang         | intent-05   | "Giỏ hàng"      | S-05 (Cart) |
 *
 * `source: 'hero_tile' | 'list_tile'` — disambiguates visual position
 * (2 large Hero tiles top vs 4 compact List tiles below) for funnel analytics
 * "do users prefer Hero CTA vs List browse?".
 *
 * **Skipped intents**: NO `intent-06` (Payment reached via Cart→checkout sub-flow,
 * not Dashboard tile) + NO `intent-08` (Auth via `/auth/*` flow). Hence enums
 * cover 6 values, not 8.
 *
 * Per S-03 D-11 (MAR-1 Q6 RESOLVED Phiên 34) + C-23 (R1 mapping LOCKED Phiên 35).
 */
export const NavTileClickedPropertiesSchema = z
  .object({
    tile_id: z.enum([
      'nhap_hang',
      'phan_tich',
      'tim_san_pham',
      'mua_hang',
      'goi_y_san_pham',
      'gio_hang',
    ]),
    intent_id: z.enum([
      'intent-01',
      'intent-02',
      'intent-03',
      'intent-04',
      'intent-05',
      'intent-07',
    ]),
    source: z.enum(['hero_tile', 'list_tile']),
  })
  .strict();
