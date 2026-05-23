'use client';

/**
 * apps/web/app/dev/organism-smoke/empty-state/page.tsx
 *
 * Dev preview — visual smoke for <EmptyState> organism in 3 scenarios.
 * Slice: S-01 T06 AC-25.
 *
 * Scenarios: empty search (S-04), empty cart (S-05), no products (S-07).
 */

import { EmptyState } from '@/components/icp/organisms';
import { Button, Icon } from '@/components/icp/atoms';

export default function EmptyStateSmokePage() {
  return (
    <main className="min-h-screen bg-icp-bg-page p-6">
      <div className="max-w-5xl mx-auto flex flex-col gap-8">
        <header>
          <h1 className="text-xl font-bold text-icp-pink-900">EmptyState Smoke</h1>
          <p className="text-sm text-icp-pink-700 mt-1">3 scenarios: empty search / empty cart / no products</p>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Scenario 1 — Empty search (S-04) */}
          <section className="bg-white rounded-2xl border-[0.5px] border-icp-pink-200 p-2">
            <h2 className="text-xs font-bold text-icp-pink-700 mb-2 uppercase tracking-wider text-center">
              Empty search (S-04)
            </h2>
            <EmptyState
              icon={<Icon name="search" size={36} className="text-icp-pink-700" />}
              title="Chưa tìm thấy sản phẩm"
              subtitle="Em chưa tìm thấy gì khớp với tìm kiếm này"
              quote='"Thử dùng từ khoá khác hoặc bỏ bớt bộ lọc."'
              actions={
                <>
                  <Button variant="pink-grad" onClick={() => alert('Retry')}>
                    Tìm lại
                  </Button>
                  <Button variant="ghost" onClick={() => alert('Clear filters')}>
                    Xoá bộ lọc
                  </Button>
                </>
              }
            />
          </section>

          {/* Scenario 2 — Empty cart (S-05) */}
          <section className="bg-white rounded-2xl border-[0.5px] border-icp-pink-200 p-2">
            <h2 className="text-xs font-bold text-icp-pink-700 mb-2 uppercase tracking-wider text-center">
              Empty cart (S-05)
            </h2>
            <EmptyState
              icon={<Icon name="shopping-cart" size={36} className="text-icp-pink-700" />}
              title="Giỏ hàng đang trống"
              subtitle="Khám phá hàng nghìn sản phẩm chất lượng"
              actions={
                <Button variant="pink-grad" onClick={() => alert('Go to search')}>
                  Bắt đầu mua sắm
                </Button>
              }
            />
          </section>

          {/* Scenario 3 — No products inbox (S-07) compact density */}
          <section className="bg-white rounded-2xl border-[0.5px] border-icp-pink-200 p-2">
            <h2 className="text-xs font-bold text-icp-pink-700 mb-2 uppercase tracking-wider text-center">
              Compact density (S-07 inline)
            </h2>
            <EmptyState
              density="compact"
              icon={<Icon name="inbox" size={24} className="text-icp-pink-700" />}
              title="Chưa có dữ liệu"
              subtitle="Hệ thống đang tổng hợp"
            />
          </section>
        </div>
      </div>
    </main>
  );
}
