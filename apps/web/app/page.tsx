/**
 * apps/web/app/page.tsx — Root page placeholder
 *
 * Slice:    S-00b T08 (initial) + S-01 T03 PATCH Phiên 15 (per C-20)
 *
 * Status:   Placeholder. Renders <PhoneFrame> wrapper around "ICP loaded"
 *           heading for landing route `/`.
 *
 * Decisions:
 * - C-20 (T03 Phiên 15) — `<PhoneFrame mode>` required prop per C-01 RESOLVED
 *   forced consumer migration. This consumer was emitted S-00b T08 before
 *   C-01 decided 2 modes. Patch: add `mode="chat"` (conservative default —
 *   Family A pattern, internal scroll). Future page.tsx redesign may switch
 *   to `mode="app"` per actual UX.
 *
 * Notes:
 * - This is a placeholder route. Real intent pages will be emitted in
 *   S-03+ V-SLICE work consuming layout primitives via @/components/icp/layout.
 */
import { PhoneFrame } from '@/components/icp/PhoneFrame';

export default function HomePage() {
  return (
    <PhoneFrame mode="chat">
      <main className="flex h-full w-full items-center justify-center">
        <h1 className="text-xl font-bold text-icp-pink-800">ICP loaded</h1>
      </main>
    </PhoneFrame>
  );
}
