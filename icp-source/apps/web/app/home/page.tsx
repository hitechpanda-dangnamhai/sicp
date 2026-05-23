/**
 * apps/web/app/home/page.tsx — Home Dashboard hub.
 *
 * Slice:    S-03 T03b — Home Dashboard hub
 * Mockup:   golden-reference-mockup.html (full page composition)
 *
 * Page composition: pageWrap > phoneFrame > [Header + Hero + StatBar + Tiles + Input + Nav]
 * Scoped styles in `./home.module.css` (CSS Module, no T01 conflict).
 *
 * Dynamic wiring (8 points):
 *   1. Avatar initials — useMe() (D-06)
 *   2-4. StatBar 3 KPIs — useStats() (D-10)
 *   5-10. 6 tile onClick — nav.tile_clicked + router.push (D-11 + C-23 R1)
 */

'use client';

import { useRouter } from 'next/navigation';
import { useStats } from '@/lib/dashboard/use-stats';
import { useMe } from '@/lib/dashboard/use-me';
import { getTracker } from '@/lib/tracker';
import {
  DashboardHeader,
  HeroInsightCard,
  HomeInputBar,
} from '@/components/icp/organisms';
import { HomeBottomNav } from '@/components/icp/layout';
import { StatBar, HeroTile, ListTile } from '@/components/icp/molecules';
import { Icon } from '@/components/icp/atoms';
import type { PropertiesFor } from '@/lib/types/behavior';
import styles from './home.module.css';

type TileId = PropertiesFor<'nav.tile_clicked'>['tile_id'];
type IntentId = PropertiesFor<'nav.tile_clicked'>['intent_id'];
type TileSource = PropertiesFor<'nav.tile_clicked'>['source'];

const TILE_MAPPING: Record<TileId, { tile_id: TileId; intent_id: IntentId; source: TileSource; route: string }> = {
  nhap_hang: { tile_id: 'nhap_hang', intent_id: 'intent-01', source: 'hero_tile', route: '/intent-01' },
  phan_tich: { tile_id: 'phan_tich', intent_id: 'intent-07', source: 'hero_tile', route: '/intent-07' },
  tim_san_pham: { tile_id: 'tim_san_pham', intent_id: 'intent-03', source: 'list_tile', route: '/intent-03' },
  mua_hang: { tile_id: 'mua_hang', intent_id: 'intent-02', source: 'list_tile', route: '/intent-02' },
  goi_y_san_pham: { tile_id: 'goi_y_san_pham', intent_id: 'intent-04', source: 'list_tile', route: '/intent-04' },
  gio_hang: { tile_id: 'gio_hang', intent_id: 'intent-05', source: 'list_tile', route: '/intent-05' },
};

export default function HomeDashboardPage() {
  const router = useRouter();
  const statsQuery = useStats();
  const meQuery = useMe();

  const handleTileClick = (tileId: TileId) => {
    const m = TILE_MAPPING[tileId];
    try {
      getTracker().track('nav.tile_clicked', {
        tile_id: m.tile_id,
        intent_id: m.intent_id,
        source: m.source,
      });
    } catch {
      // Analytics non-blocking.
    }
    router.push(m.route);
  };

  const initials = meQuery.data?.avatar_initials ?? '?';
  const stats = statsQuery.data;

  return (
    <div className={styles.pageWrap}>
      <div className={styles.phoneFrame}>
        {/* 1. Header */}
        <DashboardHeader initials={initials} />

        {/* 2. Hero AI Insight */}
        <HeroInsightCard />

        {/* 3. StatBar */}
        <div className="px-3.5 pb-3.5">
          <StatBar
            ordersToday={stats?.orders_today ?? 0}
            revenueToday={stats?.revenue_today ?? 0}
            inventoryCount={stats?.inventory_count ?? 0}
          />
        </div>

        {/* 4. Section header */}
        <div className="px-[18px] pb-2 flex justify-between items-center">
          <div className="text-[13px] text-rose-900 font-semibold tracking-[-0.2px]">
            Bắt đầu nhanh
          </div>
          <button
            type="button"
            tabIndex={-1}
            className="bg-transparent border-none text-[11px] text-pink-500 font-semibold flex items-center gap-0.5"
          >
            Tất cả
            <Icon name="chevron-right" size={13} />
          </button>
        </div>

        {/* 5. 2 Hero Tiles */}
        <div className="px-3.5 grid grid-cols-2 gap-2.5 mb-3">
          <HeroTile
            className={styles.tile}
            style={{ animationDelay: '0.05s' }}
            accent="pink"
            iconName="camera-plus"
            title="Nhập hàng"
            subtitle="Chụp ảnh là có ngay"
            badge="hot"
            footerSlot={
              <div className="flex items-center gap-2 pt-2 border-t-[0.5px] border-dashed border-pink-300/40">
                <span className="bg-pink-100 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                  <Icon name="zap" size={11} className="text-pink-700" />
                  <span className="text-[10px] text-rose-900 font-semibold">5 giây</span>
                </span>
                <span className="text-[10px] text-rose-800">/ sản phẩm</span>
              </div>
            }
            onClick={() => handleTileClick('nhap_hang')}
          />
          <HeroTile
            className={styles.tile}
            style={{ animationDelay: '0.1s' }}
            accent="orange"
            iconName="chart-arcs"
            title="Phân tích"
            subtitle="Trend, doanh thu, tồn kho"
            badge="ai"
            footerSlot={
              <svg viewBox="0 0 120 28" width="100%" height="28" className="block">
                <defs>
                  <linearGradient id="hero-sparkline-ga" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EA580C" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#EA580C" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M2,22 L20,18 L38,20 L56,12 L74,15 L92,7 L118,3"
                  stroke="#EA580C"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d="M2,22 L20,18 L38,20 L56,12 L74,15 L92,7 L118,3 L118,28 L2,28 Z"
                  fill="url(#hero-sparkline-ga)"
                />
                <circle cx="118" cy="3" r="3.5" fill="#E91E63" />
                <circle cx="118" cy="3" r="6" fill="#E91E63" opacity="0.25" />
              </svg>
            }
            onClick={() => handleTileClick('phan_tich')}
          />
        </div>

        {/* 6. 4 List Tiles */}
        <div className="px-3.5 pb-1">
          <div className="bg-white border-[0.5px] border-pink-200 rounded-[20px] p-1.5 shadow-[0_8px_24px_rgba(233,30,99,0.08)]">
            <ListTile
              className={styles.tile}
              style={{ animationDelay: '0.15s' }}
              accent="pink"
              iconName="search"
              title="Tìm sản phẩm"
              chips={[{ text: 'Gõ hoặc nói' }]}
              trailingText="50+ mặt hàng"
              onClick={() => handleTileClick('tim_san_pham')}
            />
            <div className="h-[0.5px] bg-pink-100 mx-3.5" />
            <ListTile
              className={styles.tile}
              style={{ animationDelay: '0.2s' }}
              accent="orange"
              iconName="shopping-bag"
              title="Mua hàng"
              chips={[{ text: 'Cho khách', textColor: 'text-orange-700', bgColor: 'bg-orange-100' }]}
              trailingText="Voice + Text"
              onClick={() => handleTileClick('mua_hang')}
            />
            <div className="h-[0.5px] bg-pink-100 mx-3.5" />
            <ListTile
              className={styles.tile}
              style={{ animationDelay: '0.25s' }}
              accent="rose"
              iconName="lightbulb"
              title="Gợi ý sản phẩm"
              badgeInline="ai"
              chips={[{ text: 'Chụp ảnh', textColor: 'text-rose-700', bgColor: 'bg-rose-100' }]}
              trailingText="→ 10 gợi ý"
              onClick={() => handleTileClick('goi_y_san_pham')}
            />
            <div className="h-[0.5px] bg-pink-100 mx-3.5" />
            <ListTile
              className={styles.tile}
              style={{ animationDelay: '0.3s' }}
              accent="fuchsia"
              iconName="shopping-cart"
              title="Giỏ hàng"
              countBadge={3}
              monoValue="100.000 ₫"
              monoSuffix="· 3 món"
              onClick={() => handleTileClick('gio_hang')}
            />
          </div>
        </div>

        {/* 7. Input bar */}
        <HomeInputBar />

        {/* 8. Bottom Nav */}
        <HomeBottomNav />
      </div>
    </div>
  );
}
