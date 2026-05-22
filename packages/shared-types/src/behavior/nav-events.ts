/**
 * `@icp/shared-types/behavior/nav-events.ts`
 *
 * **Behavior Event Properties Schemas — Navigation subset (07_BEHAVIOR §3.7).**
 *
 * Navigation events emitted FE-side by tracker SDK per V-SLICE S-03 T05
 * stub settings routes (mockup state-F profile page settings menu Bell/Shield/
 * Help row taps). Captures funnel for "do users explore settings?" analytics
 * without requiring real settings feature implementation Phase 02.
 *
 * **Section 3.7 added Phiên 30 C-07** — extension of stub-routes coverage per
 * Rule 6 session LAW "mockup features đầy đủ" (settings menu visible state-F
 * mockup must be functional even if content placeholder).
 *
 * @see docs/07_BEHAVIOR_LOGS.md §3.7 (Navigation — added S-03 Phiên 30 C-07)
 * @see docs/LOG_CATALOG.md Section B "Navigation" (NEW subsection per C-15)
 *
 * S-03 T03 emit (Phiên 33).
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
