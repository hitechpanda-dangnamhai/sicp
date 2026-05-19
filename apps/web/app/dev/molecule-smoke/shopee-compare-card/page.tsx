'use client';

import { PhoneFrame, MainScroll, TopBar } from '@/components/icp/layout';
import { ShopeeCompareCard } from '@/components/icp/molecules';

export default function ShopeeCompareCardSmokePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-pink-50 via-orange-50 to-rose-50">
      <PhoneFrame mode="chat">
        <TopBar title="ShopeeCompareCard (compact)" />
        <MainScroll noBottomPadding>
          <div className="px-4 py-3 space-y-3">
            <h2 className="text-xs font-bold uppercase text-pink-700">User price ABOVE median</h2>
            <ShopeeCompareCard
              userPrice={45000}
              priceMin={28000}
              priceMax={55000}
              priceMedian={38000}
              onExpand={() => console.log('Expand Shopee')}
            />

            <h2 className="text-xs font-bold uppercase text-pink-700 mt-4">User price BELOW median (good)</h2>
            <ShopeeCompareCard
              userPrice={35000}
              priceMin={28000}
              priceMax={55000}
              priceMedian={42000}
              onExpand={() => console.log('Expand Shopee')}
            />

            <h2 className="text-xs font-bold uppercase text-pink-700 mt-4">User price AT median</h2>
            <ShopeeCompareCard
              userPrice={40000}
              priceMin={30000}
              priceMax={50000}
              priceMedian={40000}
              label="GIÁ THỊ TRƯỜNG"
              subtitle="Khảo sát 8 cửa hàng"
            />
          </div>
        </MainScroll>
      </PhoneFrame>
    </main>
  );
}
