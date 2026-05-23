'use client';

import { PhoneFrame, MainScroll, TopBar } from '@/components/icp/layout';
import { MicButton } from '@/components/icp/molecules';

export default function MicButtonSmokePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-pink-50 via-orange-50 to-rose-50">
      <PhoneFrame mode="app">
        <TopBar title="MicButton" />
        <MainScroll noBottomPadding>
          <div className="px-4 py-3 space-y-6">
            <div>
              <h2 className="text-xs font-bold uppercase text-pink-700 mb-3">size=&quot;compact&quot; (4 states)</h2>
              <div className="grid grid-cols-2 gap-4 place-items-center bg-white/50 rounded-2xl p-4 border border-pink-200">
                <div className="flex flex-col items-center gap-2">
                  <MicButton state="idle" size="compact" onTap={() => console.log('tap idle compact')} />
                  <span className="text-[10px] font-bold text-pink-700 uppercase">idle</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <MicButton state="listening" size="compact" onTap={() => console.log('tap listening compact')} />
                  <span className="text-[10px] font-bold text-pink-700 uppercase">listening</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <MicButton state="processing" size="compact" />
                  <span className="text-[10px] font-bold text-pink-700 uppercase">processing</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <MicButton state="error" size="compact" onTap={() => console.log('tap error compact')} />
                  <span className="text-[10px] font-bold text-pink-700 uppercase">error</span>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xs font-bold uppercase text-pink-700 mb-3">size=&quot;voice-stage&quot; (4 states)</h2>
              <div className="grid grid-cols-2 gap-4 place-items-center bg-white/50 rounded-2xl p-4 border border-pink-200">
                <div className="flex flex-col items-center gap-2">
                  <MicButton state="idle" size="voice-stage" onTap={() => console.log('tap idle stage')} />
                  <span className="text-[10px] font-bold text-pink-700 uppercase">idle</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <MicButton state="listening" size="voice-stage" onTap={() => console.log('tap listening stage')} />
                  <span className="text-[10px] font-bold text-pink-700 uppercase">listening</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <MicButton state="processing" size="voice-stage" />
                  <span className="text-[10px] font-bold text-pink-700 uppercase">processing</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <MicButton state="error" size="voice-stage" onTap={() => console.log('tap error stage')} />
                  <span className="text-[10px] font-bold text-pink-700 uppercase">error</span>
                </div>
              </div>
            </div>
          </div>
        </MainScroll>
      </PhoneFrame>
    </main>
  );
}
