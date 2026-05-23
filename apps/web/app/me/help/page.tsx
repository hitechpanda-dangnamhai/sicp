'use client';

/**
 * apps/web/app/me/help/page.tsx
 *
 * Stub route — Trợ giúp (Help) section.
 *
 * Slice:    S-03 T05 — 3 stub settings routes per AC-37 + DM-10(d)
 *
 * Pattern identical to `apps/web/app/me/{notifications,security}/page.tsx` —
 * only `section: 'help'` enum + title/icon/copy differ.
 *
 * S-03 T05 emit (Phiên N+2 Batch 5).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { getTracker } from '@/lib/tracker';
import { Icon } from '@/components/icp/atoms';

export default function MeHelpStubPage() {
  const router = useRouter();

  React.useEffect(() => {
    try {
      getTracker().track('nav.settings_section_opened', { section: 'help' });
    } catch (err) {
      if (typeof console !== 'undefined') {
        console.error('nav.settings_section_opened emit failed', err);
      }
    }
  }, []);

  return (
    <div className="fixed inset-0 overflow-y-auto flex items-start justify-center bg-[#FDF2F4] px-[14px] py-6 lg:p-8 text-[#831447]">
      <div
        className="w-full max-w-[414px] rounded-3xl overflow-hidden flex flex-col relative
                   border-[0.5px] border-[#F9D8E4]
                   shadow-[0_20px_60px_rgba(233,30,99,0.18)] lg:shadow-[0_32px_80px_rgba(233,30,99,0.24)]"
        style={{
          background: 'linear-gradient(180deg, #FCE7F0 0%, #FEEEE0 40%, #FFF8F0 100%)',
          minHeight: 844,
        }}
      >
        <div className="px-[18px] pt-[14px] flex items-center gap-2.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => router.push('/me')}
            aria-label="Quay lại"
            className="bg-white border-[0.5px] border-[#FBCFE8] w-9 h-9 rounded-full
                       flex items-center justify-center text-[#BE185D]
                       shadow-[0_2px_8px_rgba(233,30,99,0.1)]
                       active:scale-[0.95] transition-all
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Icon name="arrow-left" size={16} />
          </button>
          <div className="text-[15px] text-[#831447] font-bold tracking-[-0.2px]">
            Trợ giúp
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4
                       bg-gradient-to-br from-[#FCE7F3] to-[#FBCFE8] text-[#BE185D]"
            aria-hidden="true"
          >
            <Icon name="help" size={28} />
          </div>
          <div className="text-[15px] text-[#831447] font-semibold mb-1.5">
            Tính năng đang phát triển
          </div>
          <div className="text-[12px] text-[#9F1239] leading-[1.5] max-w-[260px]">
            Em sẽ sớm cập nhật trang Trợ giúp để anh xem hướng dẫn và liên hệ đội ngũ hỗ trợ tại đây.
          </div>
        </div>
      </div>
    </div>
  );
}
