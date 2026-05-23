/**
 * apps/web/app/dev/preview-frame/page.tsx
 *
 * Slice:    S-01 UI Foundation
 * Task:     T03 Layout Primitives — Dev preview page (AC-20)
 *
 * Route:    /dev/preview-frame
 *
 * Purpose:  Side-by-side render of <PhoneFrame mode="chat"> + <PhoneFrame mode="app">
 *           with identical content. Visual verify:
 *           - mode="chat" — internal <MainScroll> scrolls, BottomBar pinned absolute
 *           - mode="app" — page-level scroll within frame
 *           - Both modes inherit T01 .phone-frame Bug 2 fix (max-height clamp)
 *
 * Decisions applied:
 *   - C-14         — Folder `dev/` not `__dev__/` (Next.js private folder convention)
 *   - C-15         — 'use client' defensive (embeds Client components PhoneFrame +
 *                    TopBar + AppHeader; Next.js auto-bubbles but explicit clearer)
 */
'use client';

import { PhoneFrame, MainScroll, BottomBar, TopBar, AppHeader } from '@/components/icp/layout';
import { Button } from '@/components/icp/atoms';

export default function PreviewFramePage() {
  return (
    <main className="min-h-screen w-full p-6 bg-icp-bg-page">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-icp-pink-800 mb-1">
          T03 Layout Primitives — Side-by-side preview
        </h1>
        <p className="text-sm text-icp-text-muted">
          Visual verify <code className="font-mono text-xs">mode=&quot;chat&quot;</code> vs
          <code className="font-mono text-xs ml-1">mode=&quot;app&quot;</code>. Both inherit Bug 2
          max-height clamp (resize viewport &lt; 892px to test).
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-[900px] mx-auto">
        {/* ============================================================
            Mode = chat (Family A — I01, I02, I07)
            ============================================================ */}
        <section>
          <h2 className="text-base font-bold mb-3 text-icp-text-primary">
            mode=&quot;chat&quot; — Family A (internal scroll)
          </h2>
          <PhoneFrame mode="chat">
            <TopBar
              title="Phân tích sản phẩm"
              onBack={() => console.log('chat: back tapped')}
            />
            <MainScroll>
              <div className="space-y-4">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="p-4 bg-white rounded-2xl border border-icp-border-subtle shadow-icp-card"
                  >
                    <p className="text-sm text-icp-text-primary">
                      Demo content card #{i + 1} — scrollable inside MainScroll.
                    </p>
                    <p className="text-xs text-icp-text-muted mt-2">
                      BottomBar pinned absolute below. Scroll mid-position verify
                      content does not leak through (Bug 1 fix locked).
                    </p>
                  </div>
                ))}
              </div>
            </MainScroll>
            <BottomBar>
              <Button variant="default" className="flex-1">
                Lưu sản phẩm
              </Button>
            </BottomBar>
          </PhoneFrame>
        </section>

        {/* ============================================================
            Mode = app (Family B + I07 AppHeader variant)
            Note: I07 actually uses mode="chat" + AppHeader, but for
            visual demo here we showcase AppHeader inside mode="app".
            ============================================================ */}
        <section>
          <h2 className="text-base font-bold mb-3 text-icp-text-primary">
            mode=&quot;app&quot; — Family B (page-level scroll)
          </h2>
          <PhoneFrame mode="app">
            <AppHeader
              title="Phân tích kinh doanh"
              subtitle="Aida đang trợ giúp · cập nhật real-time"
              live
              onBack={() => console.log('app: back tapped')}
              onAction={() => console.log('app: menu tapped')}
              actionIcon="more-vertical"
            />
            <div className="px-4 py-2 space-y-4">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="p-4 bg-white rounded-2xl border border-icp-border-subtle shadow-icp-card"
                >
                  <p className="text-sm text-icp-text-primary">
                    Demo content card #{i + 1} — page-level scroll.
                  </p>
                  <p className="text-xs text-icp-text-muted mt-2">
                    mode=&quot;app&quot; uses overflow-y-auto on phone-frame (Tier 4
                    override). Bug 2 max-height fix still applies — frame shrinks
                    on low viewport.
                  </p>
                </div>
              ))}
            </div>
            <BottomBar>
              <Button variant="default" className="flex-1">
                Hoàn tất
              </Button>
            </BottomBar>
          </PhoneFrame>
        </section>
      </div>

      <footer className="mt-8 pt-6 border-t border-icp-border-subtle max-w-[900px] mx-auto">
        <p className="text-xs text-icp-text-muted">
          Smoke checks: (1) DevTools inspect <code className="font-mono">.phone-frame</code> →
          computed <code className="font-mono">max-height: calc(100vh - 48px)</code> both modes
          (Bug 2). (2) Resize viewport to 700-820px → frame shrinks, stays centered.
          (3) Scroll mid-position in chat mode → BottomBar content stays opaque (Bug 1).
        </p>
      </footer>
    </main>
  );
}
