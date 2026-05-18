/**
 * apps/web/app/page.tsx — Home Page
 *
 * Slice:    S-00b Foundation Scaffold (T08)
 * Source:   slices/S-00b_EXECUTION_GUIDE.md Section 4.8 lines 2447-2461.
 *
 * Renders the placeholder "ICP loaded" headline inside a `<PhoneFrame>`
 * wrapper. Verifies DoD-5 acceptance:
 *   `curl http://localhost:3000` → HTML containing "ICP loaded".
 *
 * S-01 H-UI replaces this scaffold with the actual intent-routing landing
 * surface (brand orb + 8 intent entries + mic button per docs/04_INTENT_SPECS.md).
 */
import { PhoneFrame } from '@/components/icp/PhoneFrame';

export default function HomePage() {
  return (
    <PhoneFrame>
      <main className="p-8 flex items-center justify-center min-h-[640px]">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          ICP loaded
        </h1>
      </main>
    </PhoneFrame>
  );
}
