'use client';

/**
 * apps/web/app/dev/atom-smoke/page.tsx
 *
 * Dev-only acceptance page — renders all 10 atoms with 2-3 variant samples each.
 *
 * Slice:    S-01 UI Foundation
 * Task:     T02 AC-16, AC-22 visual smoke
 *
 * Visit:    http://localhost:3000/__dev__/atom-smoke
 *
 * Goal:     Visual sanity that every atom renders without console errors.
 *           NOT inside <PhoneFrame> (that's T03's job — atoms tested on flat grid).
 *
 * Note:     `__dev__` prefix marks dev-only routes that V-SLICE pages won't link to.
 *           Future tooling may use this convention to exclude from prod builds.
 */

import * as React from 'react';
import {
  StatusBar,
  BrainIcon,
  Icon,
  Button,
  ChipPill,
  StatPill,
  MiniSparkline,
  Avatar,
  OrbPulse,
  Spinner,
} from '@/components/icp/atoms';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-icp-border-pink bg-icp-bg-surface p-5 shadow-icp-card">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-icp-pink-700">
        {title}
      </h2>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wider text-icp-text-muted">
      {children}
    </span>
  );
}

const sampleSparklineData = [3, 5, 4, 7, 6, 8, 7, 9, 8, 10, 11, 9, 12, 10, 13];

export default function AtomSmokePage() {
  return (
    <main
      className="min-h-screen w-full max-w-[1200px] p-8 mx-auto grid gap-6"
      style={{ background: 'var(--bg-page)' }}
    >
      <header className="text-center">
        <h1 className="text-2xl font-bold text-icp-text-primary">S-01-T02 Atom Smoke Page</h1>
        <p className="mt-1 text-sm text-icp-text-tertiary">
          Visual sanity: 10 atoms with variants. Inspect DevTools — should see no console errors.
        </p>
      </header>

      {/* 1. StatusBar — looks like iPhone top bar */}
      <Section title="1. StatusBar">
        <div className="w-[414px] rounded-page bg-icp-bg-page-frame overflow-hidden border border-icp-border-pink">
          <StatusBar />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Custom time + battery</Label>
          <div className="w-[200px] rounded-page bg-icp-bg-page-frame overflow-hidden border border-icp-border-pink">
            <StatusBar time="14:23" batteryPct={42} />
          </div>
        </div>
      </Section>

      {/* 2. BrainIcon — 3 size tiers + animated lg */}
      <Section title="2. BrainIcon (resolves C-06)">
        <div className="flex flex-col items-center gap-1">
          <BrainIcon size="sm" />
          <Label>sm 20px (outline)</Label>
        </div>
        <div className="flex flex-col items-center gap-1">
          <BrainIcon size="md" />
          <Label>md 36px (two-tone)</Label>
        </div>
        <div className="flex flex-col items-center gap-1">
          <BrainIcon size="lg" />
          <Label>lg 64px (gradient + animation)</Label>
        </div>
        <div className="flex flex-col items-center gap-1">
          <BrainIcon size={48} />
          <Label>numeric 48 (→ md tier)</Label>
        </div>
      </Section>

      {/* 3. Icon — lucide wrapper */}
      <Section title="3. Icon">
        <Icon name="chevron-left" size={20} />
        <Icon name="mic" size={20} />
        <Icon name="shopping-cart" size={20} />
        <Icon name="sparkles" size={20} className="text-icp-pink-600" />
        <Icon name="trending-up" size={20} className="text-icp-green-600" />
        <Icon name="alert-circle" size={20} className="text-icp-orange-600" />
      </Section>

      {/* 4. Button — variants + sizes + loading */}
      <Section title="4. Button (5 variants + loading)">
        <Button>Mặc định</Button>
        <Button variant="secondary">Hủy bỏ</Button>
        <Button variant="ghost">Bỏ qua</Button>
        <Button variant="pink-grad" leftIcon="zap">Bắt đầu</Button>
        <Button variant="mic-grad" leftIcon="mic">Nói ngay</Button>
        <Button variant="success" leftIcon="check">Hoàn tất</Button>
        <Button variant="destructive" leftIcon="x">Xóa</Button>
        <Button loading>Đang xử lý</Button>
        <Button size="sm" rightIcon="arrow-right">SM</Button>
        <Button size="lg" rightIcon="arrow-right">LG</Button>
      </Section>

      {/* 5. ChipPill — 4 variants × 6 colors */}
      <Section title="5. ChipPill (incl. green C-11)">
        <ChipPill variant="filter" color="pink">Filter Pink</ChipPill>
        <ChipPill variant="filter" color="green">Filter Green</ChipPill>
        <ChipPill variant="filter" color="amber">Filter Amber</ChipPill>
        <ChipPill variant="filter" color="pink" interactive selected>Selected</ChipPill>
        <ChipPill variant="tag" color="pink">Tag Pink</ChipPill>
        <ChipPill variant="tag" color="orange">Tag Orange</ChipPill>
        <ChipPill variant="tag" color="green">Tag Green</ChipPill>
        <ChipPill variant="badge" color="orange">HOT</ChipPill>
        <ChipPill variant="badge" color="pink">AI VISION</ChipPill>
        <ChipPill variant="badge" color="green">RISING</ChipPill>
        <ChipPill variant="status" color="pink" leftIcon="sparkles">
          Aida • Sẵn sàng
        </ChipPill>
        <ChipPill variant="status" color="green" leftIcon="trending-up">
          Tăng 32%
        </ChipPill>
      </Section>

      {/* 6. StatPill — value + label, accent colors */}
      <Section title="6. StatPill">
        <StatPill value="~3s" label="Phân tích" accent="pink" />
        <StatPill value="12" label="Trường tự điền" accent="orange" />
        <StatPill value="98%" label="Độ chính xác" accent="green" />
        <StatPill value="42" label="Đơn hôm nay" accent="amber" />
        <StatPill
          value="↑18%"
          label="Doanh thu"
          accent="green"
          sparkline={<MiniSparkline data={sampleSparklineData} accent="green" height={20} />}
        />
      </Section>

      {/* 7. MiniSparkline — accent colors */}
      <Section title="7. MiniSparkline (unique gradient IDs)">
        <div className="w-32">
          <MiniSparkline data={sampleSparklineData} accent="pink" />
        </div>
        <div className="w-32">
          <MiniSparkline data={sampleSparklineData} accent="green" />
        </div>
        <div className="w-32">
          <MiniSparkline data={[10, 9, 11, 8, 7, 9, 6, 5, 7, 4, 3]} accent="amber" />
        </div>
        <div className="w-32">
          <MiniSparkline data={sampleSparklineData} accent="orange" showFill={false} />
        </div>
      </Section>

      {/* 8. Avatar — AI + user */}
      <Section title="8. Avatar">
        <div className="flex flex-col items-center gap-1">
          <Avatar role="ai" size="sm" />
          <Label>AI sm</Label>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Avatar role="ai" size="md" />
          <Label>AI md</Label>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Avatar role="ai" size="lg" />
          <Label>AI lg</Label>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Avatar role="user" fallback="HD" size="md" />
          <Label>User initials</Label>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Avatar role="user" fallback="AB" size="lg" />
          <Label>User lg</Label>
        </div>
      </Section>

      {/* 9. OrbPulse — 4 states × 3 sizes */}
      <Section title="9. OrbPulse (resolves §0.3 — 23 classes merged)">
        <div className="flex flex-col items-center gap-2">
          <OrbPulse size="sm" state="idle" />
          <Label>sm idle (2 rings)</Label>
        </div>
        <div className="flex flex-col items-center gap-2">
          <OrbPulse size="md" state="idle" />
          <Label>md idle</Label>
        </div>
        <div className="flex flex-col items-center gap-2">
          <OrbPulse size="lg" state="listening" />
          <Label>lg listening (3 rings)</Label>
        </div>
        <div className="flex flex-col items-center gap-2">
          <OrbPulse size="md" state="analyzing" icon={<Icon name="sparkles" size={32} />} />
          <Label>md analyzing + icon</Label>
        </div>
        <div className="flex flex-col items-center gap-2">
          <OrbPulse size="md" state="error" icon={<Icon name="alert-circle" size={32} />} />
          <Label>md error (shake)</Label>
        </div>
      </Section>

      {/* 10. Spinner — 3 sizes × 3 colors */}
      <Section title="10. Spinner">
        <Spinner size="sm" />
        <Spinner size="md" />
        <Spinner size="lg" />
        <div className="rounded-md bg-icp-pink-600 p-2">
          <Spinner size="md" color="white" />
        </div>
        <div className="text-icp-orange-600">
          <Spinner size="md" color="currentColor" />
        </div>
      </Section>
    </main>
  );
}
