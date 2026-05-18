"""
build_intent_07.py — Builder script cho 9 secondary states của Intent 07
(Analyze Business by Voice).

Hand-crafted: state 0 (mic idle) + state C (chart line / happy path canonical).
Builder generates: A, B, D, E, F, G, H, I, J.

Run: python3 build_intent_07.py
Output: ./*.html files
"""

import os
from pathlib import Path


# ================================================================
# DESIGN TOKENS v3 + Cross-Intent Patterns CSS
# ================================================================

BASE_CSS = """
:root {
  --bg-page-from: #FCE7F0; --bg-page-mid: #FEEEE0; --bg-page-to: #FFF8F0;
  --bg-page-frame: #FDF2F4; --bg-surface: #FFFFFF; --bg-tinted: #FEF3F8;
  --border-subtle: #F9D8E4; --border-pink: #FBCFE8; --border-orange: #FED7AA;
  --border-divider: #FCE7F3;
  --text-primary: #831447; --text-secondary: #9F1239; --text-tertiary: #BE185D;
  --text-muted: #7C7591; --text-on-color: #FFFFFF; --text-on-light: #1F1147;
  --pink-100: #FCE7F3; --pink-200: #FBCFE8; --pink-300: #F9A8D4;
  --pink-400: #F472B6; --pink-500: #EC4899; --pink-600: #E91E63;
  --pink-700: #BE185D; --pink-800: #831447;
  --rose-500: #F43F5E; --rose-600: #E11D48;
  --orange-300: #FDBA74; --orange-400: #FB923C; --orange-500: #F97316;
  --orange-600: #EA580C; --orange-700: #C2410C;
  --amber-100: #FEF3C7; --amber-300: #FCD34D; --amber-500: #F59E0B;
  --amber-700: #B45309; --amber-800: #92400E;
  --green-100: #D1FAE5; --green-300: #6EE7B7; --green-500: #10B981;
  --green-600: #059669; --green-700: #047857;
  --lilac-100: #EDE9FE; --lilac-300: #C4B5FD; --lilac-500: #8B5CF6;
  --lilac-700: #6D28D9;

  --grad-hero: linear-gradient(135deg, #E91E63 0%, #EC4899 40%, #F472B6 75%, #FB923C 100%);
  --grad-mic: linear-gradient(135deg, #E91E63 0%, #F43F5E 50%, #FB923C 100%);
  --grad-input-bg: linear-gradient(135deg, #FFFFFF 0%, #FEF3F8 100%);
  --grad-badge-ai: linear-gradient(135deg, #E91E63 0%, #FB923C 100%);
  --grad-orb: radial-gradient(circle at 30% 30%, #FFF 0%, #FFE4E6 30%, #FB923C 100%);

  --shadow-pink-sm: 0 4px 10px rgba(233,30,99,0.18);
  --shadow-pink-md: 0 6px 14px rgba(233,30,99,0.25);
  --shadow-pink-lg: 0 8px 18px rgba(244,63,94,0.4);
  --shadow-card: 0 8px 22px rgba(233,30,99,0.1);
  --shadow-mic: 0 10px 22px rgba(233,30,99,0.5);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Be Vietnam Pro', -apple-system, sans-serif;
  background: var(--bg-page-frame);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 14px;
  min-height: 100vh;
  color: var(--text-primary);
}

.phone-frame {
  position: relative;
  width: 100%;
  max-width: 414px;
  height: 844px;
  max-height: calc(100vh - 48px);
  background: linear-gradient(180deg, #FCE7F0 0%, #FEEEE0 40%, #FFF8F0 100%);
  border-radius: 44px;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(233,30,99,0.18), 0 0 0 8px #1F1147;
  display: flex;
  flex-direction: column;
}
@media (min-width: 1024px) {
  body { padding: 32px; }
  .phone-frame { max-height: calc(100vh - 64px); box-shadow: 0 32px 80px rgba(233,30,99,0.24), 0 0 0 8px #1F1147; }
}

.status-bar {
  height: 44px; padding: 0 22px;
  display: flex; justify-content: space-between; align-items: center;
  font-size: 14px; font-weight: 600; color: var(--text-on-light);
  flex-shrink: 0;
}
.status-icons { display: flex; gap: 6px; align-items: center; }

.app-header {
  padding: 4px 18px 12px;
  display: flex; align-items: center; justify-content: space-between;
  flex-shrink: 0;
}
.header-left { display: flex; align-items: center; gap: 10px; }
.back-btn {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: rgba(255,255,255,0.8);
  border: 0.5px solid var(--border-pink);
  display: flex; align-items: center; justify-content: center;
}
.header-title { display: flex; flex-direction: column; }
.header-title-main {
  font-size: 15px; font-weight: 700; color: var(--text-primary); line-height: 1.1;
}
.header-title-sub {
  font-size: 10.5px; color: var(--text-muted);
  display: flex; align-items: center; gap: 4px; margin-top: 2px;
}
.live-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--green-500);
  box-shadow: 0 0 0 2px rgba(16,185,129,0.2);
  animation: livePulse 1.6s ease-in-out infinite;
}
@keyframes livePulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }

.header-icon-btn {
  width: 36px; height: 36px;
  border-radius: 12px;
  background: rgba(255,255,255,0.7);
  border: 0.5px solid var(--border-pink);
  display: flex; align-items: center; justify-content: center;
}

.main-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 4px 16px 110px;
}

/* User voice bubble */
.user-bubble-wrap {
  display: flex; justify-content: flex-end; margin-bottom: 14px;
}
.user-bubble {
  max-width: 78%;
  background: var(--grad-mic);
  color: white;
  padding: 12px 14px;
  border-radius: 18px 18px 4px 18px;
  box-shadow: var(--shadow-pink-md);
}
.user-bubble-text { font-size: 14px; font-weight: 500; line-height: 1.4; }
.user-bubble-meta {
  display: flex; align-items: center; gap: 8px;
  margin-top: 6px; font-size: 10px; opacity: 0.92;
}
.user-bubble-meta .mic-mini {
  display: inline-flex; align-items: center; gap: 3px; font-weight: 600;
}
.user-bubble-meta .confidence-badge {
  background: rgba(255,255,255,0.22);
  padding: 2px 6px; border-radius: 4px;
  font-weight: 700; letter-spacing: 0.3px;
}

/* AI bubble */
.ai-bubble-wrap {
  display: flex; align-items: flex-start; gap: 8px; margin-bottom: 14px;
}
.ai-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--grad-hero);
  box-shadow: var(--shadow-pink-md);
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  position: relative;
}
.ai-avatar::after {
  content: ''; position: absolute;
  bottom: -1px; right: -1px;
  width: 10px; height: 10px;
  background: var(--green-500);
  border: 2px solid white; border-radius: 50%;
}
.ai-bubble {
  flex: 1;
  background: var(--bg-surface);
  border: 0.5px solid var(--border-pink);
  border-radius: 4px 18px 18px 18px;
  padding: 12px 14px;
  box-shadow: var(--shadow-card);
}
.ai-bubble-text { font-size: 13.5px; line-height: 1.5; color: var(--text-primary); }
.ai-bubble-text strong { color: var(--pink-700); font-weight: 700; }
.ai-bubble-text .down { color: var(--amber-700); font-weight: 700; }
.ai-bubble-text .up { color: var(--green-700); font-weight: 700; }

/* Bottom bar (LOCKED — Cross-Intent §1) */
.bottom-bar {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  z-index: 10;
  background: #FFF8F0;
  box-shadow: 0 -8px 16px rgba(255,248,240,0.95),
              0 -16px 24px rgba(255,248,240,0.6);
  padding: 14px 18px 18px;
  display: flex;
  gap: 10px;
}
.bb-mic-btn {
  width: 48px; height: 48px;
  border-radius: 50%;
  background: var(--grad-mic);
  border: none;
  box-shadow: var(--shadow-pink-md);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.bb-text-input {
  flex: 1;
  background: var(--grad-input-bg);
  border: 0.5px solid var(--border-pink);
  border-radius: 24px;
  padding: 0 16px;
  display: flex; align-items: center;
  font-size: 13px; color: var(--text-muted);
}

/* Voice wave */
.voice-wave { display: inline-flex; gap: 1.5px; height: 10px; align-items: center; }
.voice-wave span {
  display: block; width: 1.5px; background: white;
  border-radius: 2px; opacity: 0.85;
}

/* Chart card (common pattern) */
.chart-card {
  background: var(--grad-input-bg);
  border: 0.5px solid var(--border-pink);
  border-radius: 18px;
  padding: 14px 12px 12px;
  margin-bottom: 12px;
  box-shadow: var(--shadow-card);
  position: relative;
  overflow: hidden;
}
.chart-card::before {
  content: ''; position: absolute;
  top: -30px; right: -30px;
  width: 100px; height: 100px;
  background: radial-gradient(circle, rgba(233,30,99,0.08) 0%, transparent 70%);
  border-radius: 50%; pointer-events: none;
}
.chart-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 12px; position: relative; z-index: 1;
}
.chart-title-block { flex: 1; min-width: 0; }
.chart-tag {
  font-size: 9.5px; font-weight: 700; letter-spacing: 1.2px;
  color: var(--text-tertiary); text-transform: uppercase;
  display: inline-flex; align-items: center; gap: 5px;
  margin-bottom: 4px;
}
.chart-tag::before {
  content: ''; width: 12px; height: 1px;
  background: var(--text-tertiary); opacity: 0.5;
}
.chart-title-text {
  font-size: 14px; font-weight: 700;
  color: var(--text-primary); line-height: 1.2;
}
.chart-title-meta {
  font-size: 10.5px; color: var(--text-muted); margin-top: 2px;
}
.chart-expand-btn {
  flex-shrink: 0;
  background: rgba(255,255,255,0.7);
  border: 0.5px solid var(--border-pink);
  padding: 5px 10px; border-radius: 9px;
  font-size: 10px; font-weight: 700;
  color: var(--text-tertiary);
  display: inline-flex; align-items: center; gap: 4px;
  text-transform: uppercase; letter-spacing: 0.4px;
}
.chart-svg-wrap { position: relative; z-index: 1; padding: 4px 2px 0; }

.drill-chips {
  display: flex; gap: 6px; margin-top: 10px;
  flex-wrap: wrap; position: relative; z-index: 1;
}
.drill-chip {
  padding: 6px 10px;
  background: rgba(255,255,255,0.8);
  border: 0.5px solid var(--border-pink);
  border-radius: 999px;
  font-size: 11px; font-weight: 600;
  color: var(--text-tertiary);
  display: inline-flex; align-items: center; gap: 5px;
}
.drill-chip.active {
  background: var(--grad-badge-ai);
  color: white; border-color: transparent;
}
"""


# ================================================================
# Common HTML pieces
# ================================================================

STATUS_BAR_HTML = """<div class="status-bar">
    <span>9:41</span>
    <div class="status-icons">
      <svg width="16" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2" width="3" height="10" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
      <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 4.5C3.5 2 5.5 1 8 1s4.5 1 7 3.5"/><path d="M3 7C4.5 5.5 6 5 8 5s3.5 0.5 5 2"/><circle cx="8" cy="10" r="1" fill="currentColor"/></svg>
      <svg width="24" height="12" viewBox="0 0 24 12"><rect x="0.5" y="0.5" width="20" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="0.8"/><rect x="22" y="3.5" width="1.5" height="5" rx="0.5" fill="currentColor"/><rect x="2" y="2" width="17" height="8" rx="1" fill="currentColor"/></svg>
    </div>
  </div>"""


def app_header_html(subtitle="Aida đang trợ giúp · cập nhật real-time", show_live_dot=True):
    dot = '<span class="live-dot"></span>' if show_live_dot else ""
    return f"""<div class="app-header">
    <div class="header-left">
      <div class="back-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#831447" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
      </div>
      <div class="header-title">
        <div class="header-title-main">Phân tích kinh doanh</div>
        <div class="header-title-sub">
          {dot}
          {subtitle}
        </div>
      </div>
    </div>
    <div class="header-icon-btn">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#831447" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
    </div>
  </div>"""


BOTTOM_BAR_HTML = """<div class="bottom-bar">
    <button class="bb-mic-btn">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="2" width="6" height="12" rx="3"/>
        <path d="M5 10v2a7 7 0 0 0 14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="22"/>
      </svg>
    </button>
    <div class="bb-text-input">Nhấn mic hoặc gõ câu hỏi tiếp...</div>
  </div>"""


AI_AVATAR_SVG = """<div class="ai-avatar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M12 3C8 3 5 5.5 5 9c0 1.5 0.5 2.5 1.5 3.5C5.5 13.5 5 14.5 5 16c0 3 2.5 5 5 5h4c2.5 0 5-2 5-5 0-1.5-0.5-2.5-1.5-3.5C18.5 11.5 19 10.5 19 9c0-3.5-3-6-7-6z" fill="white" opacity="0.95"/>
          <circle cx="12" cy="12" r="1.4" fill="#E91E63"/>
        </svg>
      </div>"""


def page_shell(title, extra_css, body_html):
    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
{BASE_CSS}
{extra_css}
</style>
</head>
<body>
<div class="phone-frame">
  {STATUS_BAR_HTML}
{body_html}
</div>
</body>
</html>
"""


# ================================================================
# STATE A — Listening (orb pulse + partial transcript)
# ================================================================

def build_state_A():
    extra_css = """
.listening-stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 22px 110px;
  text-align: center;
}
.listen-label {
  font-size: 10px; font-weight: 800; letter-spacing: 2.5px;
  color: var(--rose-600); text-transform: uppercase;
  display: inline-flex; align-items: center; gap: 8px;
  margin-top: 20px;
}
.recording-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--rose-500);
  animation: recPulse 1s ease-in-out infinite;
  box-shadow: 0 0 0 0 rgba(244,63,94,0.5);
}
@keyframes recPulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(244,63,94,0.4); }
  50% { box-shadow: 0 0 0 8px rgba(244,63,94,0); }
}
.listen-timer {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px; font-weight: 600;
  color: var(--text-tertiary);
  margin-top: 6px;
}

.orb-stage {
  position: relative;
  width: 220px; height: 220px;
  margin: 36px 0 28px;
  display: flex; align-items: center; justify-content: center;
}
.orb-ring {
  position: absolute;
  border-radius: 50%;
  border: 1.5px solid var(--pink-400);
  opacity: 0;
  animation: orbRingExpand 2.8s cubic-bezier(0.4,0,0.2,1) infinite;
}
.orb-ring.r1 { width: 180px; height: 180px; }
.orb-ring.r2 { width: 180px; height: 180px; animation-delay: 0.8s; }
.orb-ring.r3 { width: 180px; height: 180px; animation-delay: 1.6s; }
@keyframes orbRingExpand {
  0% { width: 180px; height: 180px; opacity: 0.7; border-width: 2px; }
  100% { width: 320px; height: 320px; opacity: 0; border-width: 0.5px; }
}
.orb-core {
  width: 180px; height: 180px;
  border-radius: 50%;
  background: var(--grad-orb);
  box-shadow: var(--shadow-mic), inset 0 4px 12px rgba(255,255,255,0.6);
  animation: orbBreathe 2.4s ease-in-out infinite;
  position: relative;
}
@keyframes orbBreathe {
  0%,100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.partial-card {
  width: 100%;
  background: var(--grad-input-bg);
  border: 0.5px solid var(--border-pink);
  border-radius: 18px;
  padding: 14px 16px;
  box-shadow: var(--shadow-card);
  margin-bottom: 14px;
  text-align: left;
  min-height: 86px;
}
.partial-label {
  font-size: 9.5px; font-weight: 700; letter-spacing: 1.4px;
  color: var(--text-tertiary); text-transform: uppercase;
  display: inline-flex; align-items: center; gap: 5px;
  margin-bottom: 8px;
}
.partial-label::before {
  content: ''; width: 12px; height: 1px;
  background: var(--text-tertiary); opacity: 0.5;
}
.partial-text {
  font-size: 15px; font-weight: 500;
  color: var(--text-primary); line-height: 1.45;
}
.partial-text .typed { font-weight: 600; }
.partial-text .blink {
  display: inline-block;
  width: 2px; height: 16px;
  background: var(--pink-600);
  vertical-align: middle;
  margin-left: 2px;
  animation: cursorBlink 0.8s steps(1) infinite;
}
@keyframes cursorBlink { 50% { opacity: 0; } }

.listen-controls {
  display: flex; gap: 14px;
  margin-top: 10px;
}
.ctrl-btn {
  width: 56px; height: 56px;
  border-radius: 50%;
  border: none;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  font-weight: 700;
  position: relative;
}
.ctrl-cancel {
  background: rgba(255,255,255,0.85);
  border: 0.5px solid var(--border-pink);
  box-shadow: var(--shadow-card);
}
.ctrl-stop {
  background: var(--rose-500);
  color: white;
  box-shadow: var(--shadow-pink-lg);
  width: 72px; height: 72px;
}
.ctrl-stop-label {
  position: absolute;
  bottom: -22px; left: 50%; transform: translateX(-50%);
  font-size: 10px; font-weight: 700;
  color: var(--rose-600);
  letter-spacing: 0.6px;
  white-space: nowrap;
}
"""
    body = f"""
  {app_header_html(subtitle="Đang nghe...", show_live_dot=False)}
  <div class="listening-stage">
    <div class="listen-label">
      <span class="recording-dot"></span>
      ĐANG GHI ÂM
    </div>
    <div class="listen-timer">0:02</div>

    <div class="orb-stage">
      <div class="orb-ring r1"></div>
      <div class="orb-ring r2"></div>
      <div class="orb-ring r3"></div>
      <div class="orb-core"></div>
    </div>

    <div class="partial-card">
      <div class="partial-label">Aida đang nghe</div>
      <div class="partial-text">
        <span class="typed">Aida ơi cho anh xem doanh thu</span><span class="blink"></span>
      </div>
    </div>

    <div class="listen-controls">
      <button class="ctrl-btn ctrl-cancel" title="Hủy">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9F1239" stroke-width="2.4" stroke-linecap="round"><path d="M6 6L18 18M18 6L6 18"/></svg>
      </button>
      <button class="ctrl-btn ctrl-stop" title="Dừng">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
        <span class="ctrl-stop-label">DỪNG</span>
      </button>
    </div>
  </div>
"""
    return page_shell("Intent 07 — State A (Listening)", extra_css, body)


# ================================================================
# STATE B — Analyzing (4-phase progress)
# ================================================================

def build_state_B():
    extra_css = """
.analyzing-stage {
  padding: 8px 18px 110px;
  display: flex;
  flex-direction: column;
}

/* User bubble */
.user-bubble-wrap-static {
  display: flex; justify-content: flex-end; margin-bottom: 16px;
}

.phases-card {
  background: var(--grad-input-bg);
  border: 0.5px solid var(--border-pink);
  border-radius: 18px;
  padding: 16px 14px;
  box-shadow: var(--shadow-card);
  margin-bottom: 14px;
}
.phases-header {
  display: flex; align-items: center; gap: 10px;
  padding-bottom: 12px;
  border-bottom: 0.5px solid var(--border-divider);
  margin-bottom: 12px;
}
.phases-icon {
  width: 36px; height: 36px;
  border-radius: 12px;
  background: var(--grad-badge-ai);
  display: flex; align-items: center; justify-content: center;
  box-shadow: var(--shadow-pink-md);
  position: relative;
  animation: phasesPulse 1.6s ease-in-out infinite;
}
@keyframes phasesPulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(233,30,99,0.4); }
  50% { box-shadow: 0 0 0 6px rgba(233,30,99,0); }
}
.phases-text-block { flex: 1; }
.phases-title {
  font-size: 13px; font-weight: 700; color: var(--text-primary);
}
.phases-subtitle {
  font-size: 10.5px; color: var(--text-muted); margin-top: 2px;
}

.phase-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 0;
}
.phase-dot {
  width: 22px; height: 22px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  font-size: 11px; font-weight: 700;
}
.phase-dot.done {
  background: var(--green-500);
  color: white;
}
.phase-dot.active {
  background: var(--grad-badge-ai);
  color: white;
  animation: phaseDotPulse 1.2s ease-in-out infinite;
}
@keyframes phaseDotPulse {
  0%,100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}
.phase-dot.pending {
  background: var(--bg-tinted);
  border: 0.5px solid var(--border-pink);
  color: var(--text-muted);
}

.phase-content { flex: 1; }
.phase-title {
  font-size: 12.5px; font-weight: 600;
  color: var(--text-primary);
  display: flex; align-items: center; gap: 6px;
}
.phase-title.pending { color: var(--text-muted); font-weight: 500; }
.phase-meta {
  font-size: 10px; color: var(--text-muted);
  margin-top: 1px;
  font-family: 'JetBrains Mono', monospace;
}

.phase-spinner {
  width: 12px; height: 12px;
  border: 1.5px solid var(--pink-200);
  border-top-color: var(--pink-600);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Peek detected card */
.peek-card {
  background: linear-gradient(135deg, #ECFDF5 0%, #FFFFFF 100%);
  border-left: 3px solid var(--green-500);
  border-radius: 12px;
  padding: 10px 12px;
  margin-top: 10px;
}
.peek-tag {
  font-size: 9.5px; font-weight: 800;
  color: var(--green-700);
  letter-spacing: 1.2px;
  text-transform: uppercase;
  display: inline-flex; align-items: center; gap: 4px;
  margin-bottom: 4px;
}
.peek-tag::before { content: '✓'; }
.peek-text {
  font-size: 11.5px; color: var(--text-primary);
  line-height: 1.4;
}
.peek-text strong { color: var(--green-700); }
"""
    body = f"""
  {app_header_html(subtitle="Đang phân tích...", show_live_dot=False)}
  <div class="main-scroll analyzing-stage">

    <div class="user-bubble-wrap-static">
      <div class="user-bubble">
        <div class="user-bubble-text">"Aida ơi, cho anh xem doanh thu 30 ngày qua"</div>
        <div class="user-bubble-meta">
          <span class="mic-mini">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><rect x="9" y="2" width="6" height="12" rx="3"/></svg>
            0:04
          </span>
          <span class="confidence-badge">✓ 96% rõ</span>
        </div>
      </div>
    </div>

    <div class="ai-bubble-wrap">
      {AI_AVATAR_SVG}
      <div class="ai-bubble">
        <div class="ai-bubble-text">
          Để anh xem... Aida đang truy xuất dữ liệu 30 ngày của shop.
        </div>
      </div>
    </div>

    <div class="phases-card">
      <div class="phases-header">
        <div class="phases-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-9-9 9 9 0 0 1 9-9"/>
            <path d="M21 3v9h-9"/>
          </svg>
        </div>
        <div class="phases-text-block">
          <div class="phases-title">Đang xử lý 4 bước</div>
          <div class="phases-subtitle">Ước lượng còn ~1.2s</div>
        </div>
      </div>

      <div class="phase-item">
        <div class="phase-dot done">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round"><path d="M5 13l4 4L19 7"/></svg>
        </div>
        <div class="phase-content">
          <div class="phase-title">Chuyển giọng nói → văn bản</div>
          <div class="phase-meta">Gemini STT · 320ms · 96% rõ</div>
        </div>
      </div>

      <div class="phase-item">
        <div class="phase-dot done">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round"><path d="M5 13l4 4L19 7"/></svg>
        </div>
        <div class="phase-content">
          <div class="phase-title">Hiểu ý định + chọn loại biểu đồ</div>
          <div class="phase-meta">LLM intent · 410ms · LINE chart</div>
        </div>
      </div>

      <div class="phase-item">
        <div class="phase-dot active">
          <div class="phase-spinner" style="width:11px; height:11px; border-color: rgba(255,255,255,0.3); border-top-color: white;"></div>
        </div>
        <div class="phase-content">
          <div class="phase-title">Truy vấn doanh thu 30 ngày</div>
          <div class="phase-meta">analytics_daily mat view · đang chạy...</div>
        </div>
      </div>

      <div class="phase-item">
        <div class="phase-dot pending">4</div>
        <div class="phase-content">
          <div class="phase-title pending">Aida soạn lời giải thích</div>
          <div class="phase-meta">LLM synthesis · chờ dữ liệu</div>
        </div>
      </div>

      <div class="peek-card">
        <div class="peek-tag">ĐÃ HIỂU CÂU HỎI</div>
        <div class="peek-text">
          Khoảng thời gian: <strong>17/04 → 17/05/2026</strong> · Chỉ số: <strong>Doanh thu</strong> · Loại: <strong>Biểu đồ đường</strong>
        </div>
      </div>
    </div>

  </div>
  {BOTTOM_BAR_HTML}
"""
    return page_shell("Intent 07 — State B (Analyzing)", extra_css, body)


# ================================================================
# STATE D — Chart BAR (compare categories)
# ================================================================

def build_state_D():
    extra_css = """
.stat-cell {
  flex: 1;
  background: rgba(255,255,255,0.85);
  border: 0.5px solid var(--border-pink);
  border-radius: 10px;
  padding: 7px 9px;
}
.stat-label {
  font-size: 9px; font-weight: 600; letter-spacing: 0.6px;
  color: var(--text-muted); text-transform: uppercase;
  margin-bottom: 2px;
}
.stat-value {
  font-size: 14px; font-weight: 800;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
  line-height: 1.1;
}
.stat-delta {
  font-size: 10px; font-weight: 700; margin-top: 1px;
  display: inline-flex; align-items: center; gap: 2px;
}
.stat-delta.up { color: var(--green-600); }
.stat-delta.down { color: var(--amber-700); }
.chart-stats {
  display: flex; gap: 8px; margin-bottom: 10px;
  position: relative; z-index: 1;
}

.insight-card {
  background: linear-gradient(135deg, #FFFFFF 0%, #FEF3F8 100%);
  border-left: 3px solid var(--pink-500);
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(233,30,99,0.06);
  margin-bottom: 14px;
}
.insight-tag {
  font-size: 9.5px; font-weight: 800; letter-spacing: 1.4px;
  color: var(--pink-700); text-transform: uppercase;
  display: inline-flex; align-items: center; gap: 5px;
  margin-bottom: 6px;
}
.insight-tag::before { content: '🏆'; font-size: 11px; }
.insight-body {
  font-size: 12.5px; line-height: 1.45; color: var(--text-primary);
}
.insight-body strong { color: var(--pink-700); }
"""
    body = f"""
  {app_header_html()}
  <div class="main-scroll">

    <div class="user-bubble-wrap">
      <div class="user-bubble">
        <div class="user-bubble-text">"So sánh các danh mục bán chạy tháng này"</div>
        <div class="user-bubble-meta">
          <span class="mic-mini">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><rect x="9" y="2" width="6" height="12" rx="3"/></svg>
            0:03
          </span>
          <span class="confidence-badge">✓ 94% rõ</span>
        </div>
      </div>
    </div>

    <div class="ai-bubble-wrap">
      {AI_AVATAR_SVG}
      <div class="ai-bubble">
        <div class="ai-bubble-text">
          Tháng này (17/04 → 17/05), <strong>nước tương</strong> dẫn đầu với <strong>7.85tr</strong>, theo sau là <strong>mì tôm</strong> và <strong>dầu ăn</strong>. Dầu ăn <span class="down">tụt 18%</span> so với tháng trước.
        </div>
      </div>
    </div>

    <div class="chart-card">
      <div class="chart-header">
        <div class="chart-title-block">
          <div class="chart-tag">Biểu đồ cột</div>
          <div class="chart-title-text">Top 5 danh mục bán chạy</div>
          <div class="chart-title-meta">17/04 → 17/05/2026 · VND</div>
        </div>
        <button class="chart-expand-btn">
          Mở rộng
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke-linecap="round"/></svg>
        </button>
      </div>

      <div class="chart-stats">
        <div class="stat-cell">
          <div class="stat-label">5 cat top</div>
          <div class="stat-value">23,1tr</div>
          <div class="stat-delta up">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 15l6-6 6 6"/></svg>
            +9%
          </div>
        </div>
        <div class="stat-cell">
          <div class="stat-label">Dẫn đầu</div>
          <div class="stat-value">N.Tương</div>
          <div class="stat-delta up">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 15l6-6 6 6"/></svg>
            32%
          </div>
        </div>
        <div class="stat-cell">
          <div class="stat-label">Giảm</div>
          <div class="stat-value">Dầu ăn</div>
          <div class="stat-delta down">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
            -18%
          </div>
        </div>
      </div>

      <div class="chart-svg-wrap">
        <svg viewBox="0 0 360 200" xmlns="http://www.w3.org/2000/svg" style="width:100%; height:auto; display:block;">
          <defs>
            <linearGradient id="bar-grad-1" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#E91E63"/>
              <stop offset="100%" stop-color="#FB923C"/>
            </linearGradient>
            <linearGradient id="bar-grad-2" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#EC4899"/>
              <stop offset="100%" stop-color="#F472B6"/>
            </linearGradient>
            <linearGradient id="bar-grad-3" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#F59E0B"/>
              <stop offset="100%" stop-color="#FCD34D"/>
            </linearGradient>
            <linearGradient id="bar-grad-4" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#8B5CF6"/>
              <stop offset="100%" stop-color="#C4B5FD"/>
            </linearGradient>
            <linearGradient id="bar-grad-5" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#10B981"/>
              <stop offset="100%" stop-color="#6EE7B7"/>
            </linearGradient>
          </defs>

          <!-- Y-axis grid lines + labels -->
          <line x1="42" y1="20" x2="350" y2="20" stroke="#FCE7F3" stroke-width="0.5" stroke-dasharray="2,3"/>
          <line x1="42" y1="55" x2="350" y2="55" stroke="#FCE7F3" stroke-width="0.5" stroke-dasharray="2,3"/>
          <line x1="42" y1="90" x2="350" y2="90" stroke="#FCE7F3" stroke-width="0.5" stroke-dasharray="2,3"/>
          <line x1="42" y1="125" x2="350" y2="125" stroke="#FCE7F3" stroke-width="0.5" stroke-dasharray="2,3"/>
          <line x1="42" y1="160" x2="350" y2="160" stroke="#FBCFE8" stroke-width="0.6"/>

          <text x="38" y="23" text-anchor="end" font-size="8" font-family="JetBrains Mono" fill="#7C7591">10tr</text>
          <text x="38" y="58" text-anchor="end" font-size="8" font-family="JetBrains Mono" fill="#7C7591">7.5tr</text>
          <text x="38" y="93" text-anchor="end" font-size="8" font-family="JetBrains Mono" fill="#7C7591">5tr</text>
          <text x="38" y="128" text-anchor="end" font-size="8" font-family="JetBrains Mono" fill="#7C7591">2.5tr</text>
          <text x="38" y="163" text-anchor="end" font-size="8" font-family="JetBrains Mono" fill="#7C7591">0</text>

          <!-- Bars: nuoc tuong 7.85tr, mi tom 5.9tr, dau an 4.4tr, sua 2.85tr, banh keo 2.0tr -->
          <!-- Each bar 42px wide, gap 14px. Start at x=58 -->
          <!-- Bar 1: NT 7.85tr -> height = (7.85/10) * 140 = 110px, y = 160-110 = 50 -->
          <rect x="58" y="50" width="42" height="110" rx="4" fill="url(#bar-grad-1)"/>
          <text x="79" y="44" text-anchor="middle" font-size="9" font-family="JetBrains Mono" font-weight="700" fill="#831447">7.85</text>

          <!-- Bar 2: MT 5.9tr -> 82px, y=78 -->
          <rect x="114" y="78" width="42" height="82" rx="4" fill="url(#bar-grad-2)"/>
          <text x="135" y="72" text-anchor="middle" font-size="9" font-family="JetBrains Mono" font-weight="700" fill="#831447">5.9</text>

          <!-- Bar 3: Dau an 4.4tr -> 62px, y=98 - HIGHLIGHTED DOWN -->
          <rect x="170" y="98" width="42" height="62" rx="4" fill="url(#bar-grad-3)"/>
          <text x="191" y="92" text-anchor="middle" font-size="9" font-family="JetBrains Mono" font-weight="700" fill="#831447">4.4</text>
          <!-- Down arrow badge -->
          <g transform="translate(178, 102)">
            <rect x="0" y="0" width="26" height="12" rx="6" fill="#92400E"/>
            <text x="13" y="8.5" text-anchor="middle" font-size="7" font-family="JetBrains Mono" font-weight="700" fill="white">-18%</text>
          </g>

          <!-- Bar 4: Sua 2.85tr -> 40px, y=120 -->
          <rect x="226" y="120" width="42" height="40" rx="4" fill="url(#bar-grad-4)"/>
          <text x="247" y="114" text-anchor="middle" font-size="9" font-family="JetBrains Mono" font-weight="700" fill="#831447">2.85</text>

          <!-- Bar 5: Banh keo 2.0tr -> 28px, y=132 -->
          <rect x="282" y="132" width="42" height="28" rx="4" fill="url(#bar-grad-5)"/>
          <text x="303" y="126" text-anchor="middle" font-size="9" font-family="JetBrains Mono" font-weight="700" fill="#831447">2.0</text>

          <!-- X-axis labels (category names) -->
          <text x="79" y="175" text-anchor="middle" font-size="8.5" font-family="Be Vietnam Pro" font-weight="600" fill="#831447">N.tương</text>
          <text x="135" y="175" text-anchor="middle" font-size="8.5" font-family="Be Vietnam Pro" font-weight="600" fill="#831447">Mì tôm</text>
          <text x="191" y="175" text-anchor="middle" font-size="8.5" font-family="Be Vietnam Pro" font-weight="700" fill="#92400E">Dầu ăn</text>
          <text x="247" y="175" text-anchor="middle" font-size="8.5" font-family="Be Vietnam Pro" font-weight="600" fill="#831447">Sữa</text>
          <text x="303" y="175" text-anchor="middle" font-size="8.5" font-family="Be Vietnam Pro" font-weight="600" fill="#831447">Bánh kẹo</text>

          <!-- Sublabel: VND row -->
          <text x="79" y="187" text-anchor="middle" font-size="7.5" font-family="JetBrains Mono" fill="#7C7591">triệu VND</text>
        </svg>
      </div>

      <div class="drill-chips">
        <div class="drill-chip active">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 13l4 4L19 7"/></svg>
          Tháng này
        </div>
        <div class="drill-chip">Tháng trước</div>
        <div class="drill-chip">So với cùng kỳ</div>
        <div class="drill-chip">Top 10</div>
      </div>
    </div>

    <div class="insight-card">
      <div class="insight-tag">DANH MỤC DẪN ĐẦU</div>
      <div class="insight-body">
        <strong>Nước tương</strong> chiếm <strong>32% doanh thu</strong> tháng này — tăng 6% nhờ 2 sản phẩm Maggi và Chinsu cháy hàng. Nên duy trì stock cao.
      </div>
    </div>

  </div>
  {BOTTOM_BAR_HTML}
"""
    return page_shell("Intent 07 — State D (Chart Bar)", extra_css, body)


# ================================================================
# STATE E — Chart DONUT (share)
# ================================================================

def build_state_E():
    extra_css = """
.donut-stage {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 4px 0;
  position: relative; z-index: 1;
}
.donut-svg-block {
  width: 150px; height: 150px;
  flex-shrink: 0;
  position: relative;
}
.donut-center {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}
.donut-center-value {
  font-size: 18px; font-weight: 800;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
  line-height: 1.05;
}
.donut-center-label {
  font-size: 8.5px; font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.6px;
  text-transform: uppercase;
  margin-top: 2px;
}
.donut-legend {
  flex: 1;
  display: flex; flex-direction: column;
  gap: 7px;
}
.legend-item {
  display: flex; align-items: center; gap: 7px;
  font-size: 11.5px;
}
.legend-dot {
  width: 9px; height: 9px;
  border-radius: 2px;
  flex-shrink: 0;
}
.legend-label {
  flex: 1;
  color: var(--text-primary);
  font-weight: 500;
}
.legend-pct {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  color: var(--text-primary);
}

.insight-card {
  background: linear-gradient(135deg, #FFFFFF 0%, #EDE9FE 100%);
  border-left: 3px solid var(--lilac-500);
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(139,92,246,0.08);
  margin-bottom: 14px;
}
.insight-tag {
  font-size: 9.5px; font-weight: 800; letter-spacing: 1.4px;
  color: var(--lilac-700); text-transform: uppercase;
  display: inline-flex; align-items: center; gap: 5px;
  margin-bottom: 6px;
}
.insight-tag::before { content: '◐'; font-size: 12px; }
.insight-body {
  font-size: 12.5px; line-height: 1.45; color: var(--text-primary);
}
.insight-body strong { color: var(--lilac-700); }
"""
    body = f"""
  {app_header_html()}
  <div class="main-scroll">

    <div class="user-bubble-wrap">
      <div class="user-bubble">
        <div class="user-bubble-text">"Tỷ trọng doanh thu theo danh mục thế nào?"</div>
        <div class="user-bubble-meta">
          <span class="mic-mini">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><rect x="9" y="2" width="6" height="12" rx="3"/></svg>
            0:03
          </span>
          <span class="confidence-badge">✓ 95% rõ</span>
        </div>
      </div>
    </div>

    <div class="ai-bubble-wrap">
      {AI_AVATAR_SVG}
      <div class="ai-bubble">
        <div class="ai-bubble-text">
          Cơ cấu doanh thu tập trung vào <strong>3 danh mục chính</strong> (74% tổng). <strong>Nước tương</strong> dẫn đầu rõ rệt. 2 danh mục cuối (sữa + bánh kẹo) chỉ chiếm ~20%.
        </div>
      </div>
    </div>

    <div class="chart-card">
      <div class="chart-header">
        <div class="chart-title-block">
          <div class="chart-tag">Biểu đồ tròn</div>
          <div class="chart-title-text">Tỷ trọng doanh thu</div>
          <div class="chart-title-meta">5 danh mục · 30 ngày · 24,5tr tổng</div>
        </div>
        <button class="chart-expand-btn">
          Mở rộng
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke-linecap="round"/></svg>
        </button>
      </div>

      <div class="donut-stage">
        <div class="donut-svg-block">
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="width:100%; height:100%; transform: rotate(-90deg);">
            <!-- Donut chart with 5 segments
                 NT 32% = 100.5 of 314.16
                 MT 24% = 75.4
                 DA 18% = 56.5
                 Sua 14% = 44.0
                 BK 12% = 37.7
                 Circle r=40, stroke-width=18. circumference = 2*pi*40 = 251.32
                 Use stroke-dasharray to make segments. Gap of 1.5 between.
            -->
            <!-- Background donut ring (subtle) -->
            <circle cx="50" cy="50" r="40" fill="none" stroke="#FCE7F3" stroke-width="18"/>

            <!-- Segment 1: NT 32% -> length = 0.32 * 251.32 = 80.4, dash = 80.4 1.5 + rest -->
            <circle cx="50" cy="50" r="40" fill="none" stroke="#E91E63" stroke-width="18"
                    stroke-dasharray="79 172.32" stroke-dashoffset="0"/>

            <!-- Segment 2: MT 24% -> length = 60.3 -->
            <circle cx="50" cy="50" r="40" fill="none" stroke="#EC4899" stroke-width="18"
                    stroke-dasharray="59 192.32" stroke-dashoffset="-80.4"/>

            <!-- Segment 3: DA 18% -> 45.2 -->
            <circle cx="50" cy="50" r="40" fill="none" stroke="#F59E0B" stroke-width="18"
                    stroke-dasharray="44 207.32" stroke-dashoffset="-140.7"/>

            <!-- Segment 4: Sua 14% -> 35.2 -->
            <circle cx="50" cy="50" r="40" fill="none" stroke="#8B5CF6" stroke-width="18"
                    stroke-dasharray="34 217.32" stroke-dashoffset="-185.9"/>

            <!-- Segment 5: BK 12% -> 30.2 -->
            <circle cx="50" cy="50" r="40" fill="none" stroke="#10B981" stroke-width="18"
                    stroke-dasharray="29 222.32" stroke-dashoffset="-221.1"/>
          </svg>
          <div class="donut-center">
            <div class="donut-center-value">24,5tr</div>
            <div class="donut-center-label">Tổng 30d</div>
          </div>
        </div>

        <div class="donut-legend">
          <div class="legend-item">
            <span class="legend-dot" style="background:#E91E63"></span>
            <span class="legend-label">Nước tương</span>
            <span class="legend-pct">32%</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot" style="background:#EC4899"></span>
            <span class="legend-label">Mì tôm</span>
            <span class="legend-pct">24%</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot" style="background:#F59E0B"></span>
            <span class="legend-label">Dầu ăn</span>
            <span class="legend-pct">18%</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot" style="background:#8B5CF6"></span>
            <span class="legend-label">Sữa</span>
            <span class="legend-pct">14%</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot" style="background:#10B981"></span>
            <span class="legend-label">Bánh kẹo</span>
            <span class="legend-pct">12%</span>
          </div>
        </div>
      </div>

      <div class="drill-chips" style="margin-top: 14px;">
        <div class="drill-chip active">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 13l4 4L19 7"/></svg>
          30 ngày
        </div>
        <div class="drill-chip">7 ngày</div>
        <div class="drill-chip">Theo SP</div>
        <div class="drill-chip">So tháng trước</div>
      </div>
    </div>

    <div class="insight-card">
      <div class="insight-tag">CƠ CẤU DOANH THU</div>
      <div class="insight-body">
        Shop phụ thuộc vào <strong>3 danh mục top</strong> (74%). Nếu 1 trong 3 sụt giảm, tổng doanh thu bị ảnh hưởng mạnh — nên đa dạng hóa sữa + bánh kẹo (hiện chỉ 26%).
      </div>
    </div>

  </div>
  {BOTTOM_BAR_HTML}
"""
    return page_shell("Intent 07 — State E (Chart Donut)", extra_css, body)


# ================================================================
# STATE F — Empty (no data, cold start)
# ================================================================

def build_state_F():
    extra_css = """
.empty-stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 22px 110px;
  text-align: center;
}
.empty-illu {
  width: 140px; height: 140px;
  border-radius: 50%;
  background: linear-gradient(135deg, #FEF3F8 0%, #FFEDD5 100%);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 22px;
  box-shadow: 0 8px 24px rgba(233,30,99,0.1);
  position: relative;
}
.empty-illu::before {
  content: ''; position: absolute;
  inset: -6px; border-radius: 50%;
  border: 0.5px dashed var(--border-pink);
}
.empty-title {
  font-size: 18px; font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 8px;
  line-height: 1.25;
}
.empty-subtitle {
  font-size: 13px; color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 24px;
  max-width: 280px;
}

.empty-actions {
  display: flex; flex-direction: column; gap: 10px;
  width: 100%;
}
.empty-action-btn {
  background: var(--bg-surface);
  border: 0.5px solid var(--border-pink);
  border-radius: 14px;
  padding: 14px;
  display: flex; align-items: center; gap: 12px;
  text-align: left;
  box-shadow: var(--shadow-card);
}
.empty-action-btn.primary {
  background: var(--grad-mic);
  border-color: transparent;
  box-shadow: var(--shadow-pink-md);
}
.empty-action-btn.primary .ea-title { color: white; }
.empty-action-btn.primary .ea-sub { color: rgba(255,255,255,0.85); }
.empty-action-btn.primary .ea-icon { background: rgba(255,255,255,0.22); }

.ea-icon {
  width: 38px; height: 38px;
  border-radius: 12px;
  background: var(--bg-tinted);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.ea-content { flex: 1; min-width: 0; }
.ea-title {
  font-size: 13.5px; font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}
.ea-sub {
  font-size: 11px; color: var(--text-muted);
  margin-top: 2px; line-height: 1.3;
}
.ea-chevron {
  flex-shrink: 0;
  color: var(--text-tertiary);
}
.empty-action-btn.primary .ea-chevron { color: white; }
"""
    body = f"""
  {app_header_html(subtitle="Chưa có dữ liệu", show_live_dot=False)}
  <div class="empty-stage">
    <div class="empty-illu">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#BE185D" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 3v18h18"/>
        <path d="M7 14l3-3 4 4 5-7" opacity="0.4"/>
        <circle cx="10" cy="11" r="1.5" fill="#FB923C" opacity="0.6"/>
        <circle cx="14" cy="15" r="1.5" fill="#E91E63" opacity="0.6"/>
        <circle cx="19" cy="8" r="1.5" fill="#F59E0B" opacity="0.6"/>
        <path d="M2 22h20" stroke-dasharray="2,2"/>
      </svg>
    </div>
    <h2 class="empty-title">Chưa có đơn hàng nào<br>để phân tích</h2>
    <p class="empty-subtitle">
      Aida cần ít nhất <strong>5 đơn hàng</strong> trong 7 ngày qua để tạo biểu đồ doanh thu chính xác.
    </p>

    <div class="empty-actions">
      <button class="empty-action-btn primary">
        <div class="ea-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round">
            <rect x="3" y="3" width="18" height="18" rx="3"/>
            <path d="M9 14l2 2 4-4"/>
          </svg>
        </div>
        <div class="ea-content">
          <div class="ea-title">Thêm đơn hàng demo</div>
          <div class="ea-sub">Aida tạo 20 đơn mẫu để demo</div>
        </div>
        <svg class="ea-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>
      </button>

      <button class="empty-action-btn">
        <div class="ea-icon" style="background: linear-gradient(135deg, #FFEDD5, #FED7AA);">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EA580C" stroke-width="2" stroke-linecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </div>
        <div class="ea-content">
          <div class="ea-title">Nhập sản phẩm mới</div>
          <div class="ea-sub">Quay lại trang chính, dùng tính năng import</div>
        </div>
        <svg class="ea-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>
      </button>

      <button class="empty-action-btn">
        <div class="ea-icon" style="background: linear-gradient(135deg, #EDE9FE, #C4B5FD);">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6D28D9" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 8v4l3 2"/>
          </svg>
        </div>
        <div class="ea-content">
          <div class="ea-title">Xem hướng dẫn</div>
          <div class="ea-sub">Cách Aida học từ dữ liệu shop</div>
        </div>
        <svg class="ea-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>
      </button>
    </div>

  </div>
"""
    return page_shell("Intent 07 — State F (Empty)", extra_css, body)


# ================================================================
# STATE G — Drilldown Expanded (full-screen chart)
# ================================================================

def build_state_G():
    extra_css = """
.expanded-header {
  padding: 4px 18px 12px;
  display: flex; align-items: center; gap: 10px;
  flex-shrink: 0;
}
.expanded-header .back-btn {
  background: var(--bg-surface);
  box-shadow: var(--shadow-card);
}
.expanded-header h2 {
  font-size: 16px; font-weight: 800;
  color: var(--text-primary);
  line-height: 1.15;
}
.expanded-header .expanded-sub {
  font-size: 10.5px; color: var(--text-muted);
  margin-top: 2px;
}

.expanded-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 110px;
}

.expanded-chart-card {
  background: var(--grad-input-bg);
  border: 0.5px solid var(--border-pink);
  border-radius: 22px;
  padding: 18px 16px;
  box-shadow: var(--shadow-card);
  margin-bottom: 14px;
  position: relative;
  overflow: hidden;
}
.expanded-chart-card::before {
  content: ''; position: absolute;
  top: -40px; right: -40px;
  width: 140px; height: 140px;
  background: radial-gradient(circle, rgba(233,30,99,0.1) 0%, transparent 70%);
  border-radius: 50%; pointer-events: none;
}

.expanded-stats {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;
  margin-bottom: 14px;
  position: relative; z-index: 1;
}
.expanded-stat {
  background: rgba(255,255,255,0.9);
  border: 0.5px solid var(--border-pink);
  border-radius: 12px;
  padding: 10px 12px;
}
.expanded-stat-label {
  font-size: 9.5px; font-weight: 700; letter-spacing: 0.8px;
  color: var(--text-muted); text-transform: uppercase;
  margin-bottom: 4px;
}
.expanded-stat-value {
  font-size: 18px; font-weight: 800;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
  line-height: 1.05;
}
.expanded-stat-delta {
  font-size: 10.5px; font-weight: 700;
  margin-top: 2px;
  display: inline-flex; align-items: center; gap: 3px;
}
.expanded-stat-delta.up { color: var(--green-600); }
.expanded-stat-delta.down { color: var(--amber-700); }

.expanded-chart-wrap {
  position: relative; z-index: 1;
  margin-bottom: 12px;
}

.expanded-drill {
  position: relative; z-index: 1;
  margin-top: 8px;
}
.drill-title {
  font-size: 10px; font-weight: 700;
  color: var(--text-muted); letter-spacing: 1px;
  text-transform: uppercase; margin-bottom: 8px;
}
.drill-grid {
  display: flex; flex-wrap: wrap; gap: 6px;
}

/* Day breakdown list */
.day-breakdown-card {
  background: var(--bg-surface);
  border: 0.5px solid var(--border-pink);
  border-radius: 16px;
  padding: 14px;
  box-shadow: var(--shadow-card);
}
.day-breakdown-title {
  font-size: 12px; font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 10px;
  display: flex; align-items: center; gap: 6px;
}
.day-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 0;
  border-bottom: 0.5px solid var(--border-divider);
}
.day-row:last-child { border-bottom: none; }
.day-date {
  font-size: 11px; font-weight: 600;
  color: var(--text-secondary);
  width: 56px;
  font-family: 'JetBrains Mono', monospace;
}
.day-bar-bg {
  flex: 1;
  height: 6px;
  background: var(--bg-tinted);
  border-radius: 3px;
  overflow: hidden;
}
.day-bar-fill {
  height: 100%;
  background: var(--grad-mic);
  border-radius: 3px;
}
.day-amount {
  font-size: 11px; font-weight: 700;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
  width: 52px;
  text-align: right;
}
.day-delta {
  font-size: 9.5px; font-weight: 700;
  width: 38px;
  text-align: right;
}
.day-delta.up { color: var(--green-600); }
.day-delta.down { color: var(--amber-700); }
"""
    body = f"""
  <div class="expanded-header">
    <div class="back-btn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#831447" stroke-width="2.4" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg>
    </div>
    <div>
      <h2>Doanh thu 30 ngày qua</h2>
      <div class="expanded-sub">17/04/2026 → 17/05/2026 · Chế độ chi tiết</div>
    </div>
  </div>

  <div class="expanded-scroll">

    <div class="expanded-chart-card">
      <div class="expanded-stats">
        <div class="expanded-stat">
          <div class="expanded-stat-label">Tổng doanh thu</div>
          <div class="expanded-stat-value">24,5tr</div>
          <div class="expanded-stat-delta up">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 15l6-6 6 6"/></svg>
            +12% vs 30d trước
          </div>
        </div>
        <div class="expanded-stat">
          <div class="expanded-stat-label">Số đơn</div>
          <div class="expanded-stat-value">186</div>
          <div class="expanded-stat-delta up">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 15l6-6 6 6"/></svg>
            +9%
          </div>
        </div>
        <div class="expanded-stat">
          <div class="expanded-stat-label">TB / đơn</div>
          <div class="expanded-stat-value">132K</div>
          <div class="expanded-stat-delta up">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 15l6-6 6 6"/></svg>
            +3%
          </div>
        </div>
        <div class="expanded-stat">
          <div class="expanded-stat-label">Tuần này</div>
          <div class="expanded-stat-value">5,1tr</div>
          <div class="expanded-stat-delta down">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
            -8%
          </div>
        </div>
      </div>

      <div class="expanded-chart-wrap">
        <svg viewBox="0 0 360 200" xmlns="http://www.w3.org/2000/svg" style="width:100%; height:auto;">
          <defs>
            <linearGradient id="exp-area" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#E91E63" stop-opacity="0.32"/>
              <stop offset="100%" stop-color="#FB923C" stop-opacity="0"/>
            </linearGradient>
            <linearGradient id="exp-stroke" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#E91E63"/>
              <stop offset="100%" stop-color="#FB923C"/>
            </linearGradient>
          </defs>

          <line x1="42" y1="20" x2="350" y2="20" stroke="#FCE7F3" stroke-width="0.5" stroke-dasharray="2,3"/>
          <line x1="42" y1="55" x2="350" y2="55" stroke="#FCE7F3" stroke-width="0.5" stroke-dasharray="2,3"/>
          <line x1="42" y1="90" x2="350" y2="90" stroke="#FCE7F3" stroke-width="0.5" stroke-dasharray="2,3"/>
          <line x1="42" y1="125" x2="350" y2="125" stroke="#FCE7F3" stroke-width="0.5" stroke-dasharray="2,3"/>
          <line x1="42" y1="160" x2="350" y2="160" stroke="#FBCFE8" stroke-width="0.6"/>

          <text x="38" y="23" text-anchor="end" font-size="8" font-family="JetBrains Mono" fill="#7C7591">1.5M</text>
          <text x="38" y="58" text-anchor="end" font-size="8" font-family="JetBrains Mono" fill="#7C7591">1.2M</text>
          <text x="38" y="93" text-anchor="end" font-size="8" font-family="JetBrains Mono" fill="#7C7591">900K</text>
          <text x="38" y="128" text-anchor="end" font-size="8" font-family="JetBrains Mono" fill="#7C7591">600K</text>
          <text x="38" y="163" text-anchor="end" font-size="8" font-family="JetBrains Mono" fill="#7C7591">300K</text>

          <path d="M45,140 L55,135 L65,130 L75,122 L85,115 L95,108 L105,95
                   L115,82 L125,72 L135,60 L145,52 L155,48 L165,55 L175,62
                   L185,68 L195,75 L205,82 L215,88 L225,82 L235,75 L245,80
                   L255,92 L265,100 L275,108 L285,105 L295,115 L305,122 L315,118 L325,128 L335,135
                   L335,160 L45,160 Z"
                fill="url(#exp-area)"/>
          <path d="M45,140 L55,135 L65,130 L75,122 L85,115 L95,108 L105,95
                   L115,82 L125,72 L135,60 L145,52 L155,48 L165,55 L175,62
                   L185,68 L195,75 L205,82 L215,88 L225,82 L235,75 L245,80
                   L255,92 L265,100 L275,108 L285,105 L295,115 L305,122 L315,118 L325,128 L335,135"
                fill="none" stroke="url(#exp-stroke)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>

          <!-- All data point dots for "detailed" feel -->
          <g fill="#E91E63">
            <circle cx="45" cy="140" r="2"/><circle cx="65" cy="130" r="2"/>
            <circle cx="85" cy="115" r="2"/><circle cx="105" cy="95" r="2"/>
            <circle cx="125" cy="72" r="2"/>
          </g>
          <g fill="#EC4899">
            <circle cx="145" cy="52" r="2"/><circle cx="165" cy="55" r="2"/>
            <circle cx="185" cy="68" r="2"/><circle cx="205" cy="82" r="2"/>
            <circle cx="225" cy="82" r="2"/>
          </g>
          <g fill="#FB923C">
            <circle cx="245" cy="80" r="2"/><circle cx="265" cy="100" r="2"/>
            <circle cx="285" cy="105" r="2"/><circle cx="305" cy="122" r="2"/>
            <circle cx="325" cy="128" r="2"/>
          </g>

          <!-- Peak annotation -->
          <circle cx="155" cy="48" r="5" fill="white" stroke="#E91E63" stroke-width="2.4"/>
          <circle cx="155" cy="48" r="2" fill="#E91E63"/>
          <g transform="translate(115, 25)">
            <rect x="0" y="0" width="80" height="16" rx="4" fill="#E91E63"/>
            <text x="40" y="11" text-anchor="middle" font-size="9" font-family="JetBrains Mono" font-weight="700" fill="white">1.32M · 28/04</text>
            <path d="M40 16 L40 20 L43.5 16 Z" fill="#E91E63"/>
          </g>

          <!-- Today marker -->
          <line x1="335" y1="20" x2="335" y2="160" stroke="#FB923C" stroke-width="1" stroke-dasharray="3,2" opacity="0.6"/>
          <circle cx="335" cy="135" r="4.5" fill="#FB923C" stroke="white" stroke-width="2"/>

          <text x="45" y="174" text-anchor="middle" font-size="8" font-family="JetBrains Mono" fill="#7C7591">17/4</text>
          <text x="125" y="174" text-anchor="middle" font-size="8" font-family="JetBrains Mono" fill="#7C7591">25/4</text>
          <text x="205" y="174" text-anchor="middle" font-size="8" font-family="JetBrains Mono" fill="#7C7591">3/5</text>
          <text x="285" y="174" text-anchor="middle" font-size="8" font-family="JetBrains Mono" fill="#7C7591">11/5</text>
          <text x="335" y="174" text-anchor="middle" font-size="8" font-family="JetBrains Mono" font-weight="700" fill="#BE185D">17/5</text>
        </svg>
      </div>

      <div class="expanded-drill">
        <div class="drill-title">Bóc tách theo</div>
        <div class="drill-grid">
          <div class="drill-chip active">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 13l4 4L19 7"/></svg>
            Theo ngày
          </div>
          <div class="drill-chip">Theo tuần</div>
          <div class="drill-chip">Theo danh mục</div>
          <div class="drill-chip">Theo sản phẩm</div>
          <div class="drill-chip">Theo khung giờ</div>
          <div class="drill-chip">So cùng kỳ</div>
        </div>
      </div>
    </div>

    <div class="day-breakdown-card">
      <div class="day-breakdown-title">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#831447" stroke-width="2" stroke-linecap="round"><path d="M3 17l5-5 4 4 6-7 3 3"/></svg>
        7 ngày gần nhất
      </div>

      <div class="day-row">
        <div class="day-date">17/05 T7</div>
        <div class="day-bar-bg"><div class="day-bar-fill" style="width: 58%"></div></div>
        <div class="day-amount">735K</div>
        <div class="day-delta down">-12%</div>
      </div>
      <div class="day-row">
        <div class="day-date">16/05 T6</div>
        <div class="day-bar-bg"><div class="day-bar-fill" style="width: 64%"></div></div>
        <div class="day-amount">810K</div>
        <div class="day-delta down">-5%</div>
      </div>
      <div class="day-row">
        <div class="day-date">15/05 T5</div>
        <div class="day-bar-bg"><div class="day-bar-fill" style="width: 72%"></div></div>
        <div class="day-amount">925K</div>
        <div class="day-delta up">+8%</div>
      </div>
      <div class="day-row">
        <div class="day-date">14/05 T4</div>
        <div class="day-bar-bg"><div class="day-bar-fill" style="width: 56%"></div></div>
        <div class="day-amount">710K</div>
        <div class="day-delta down">-14%</div>
      </div>
      <div class="day-row">
        <div class="day-date">13/05 T3</div>
        <div class="day-bar-bg"><div class="day-bar-fill" style="width: 68%"></div></div>
        <div class="day-amount">860K</div>
        <div class="day-delta down">-3%</div>
      </div>
      <div class="day-row">
        <div class="day-date">12/05 T2</div>
        <div class="day-bar-bg"><div class="day-bar-fill" style="width: 78%"></div></div>
        <div class="day-amount">995K</div>
        <div class="day-delta up">+6%</div>
      </div>
      <div class="day-row">
        <div class="day-date">11/05 CN</div>
        <div class="day-bar-bg"><div class="day-bar-fill" style="width: 82%"></div></div>
        <div class="day-amount">1.05M</div>
        <div class="day-delta up">+12%</div>
      </div>
    </div>

  </div>
  {BOTTOM_BAR_HTML}
"""
    return page_shell("Intent 07 — State G (Drilldown Expanded)", extra_css, body)


# ================================================================
# STATE H — Action Suggestion (insight → action card)
# ================================================================

def build_state_H():
    extra_css = """
.action-section-title {
  font-size: 11px; font-weight: 800;
  color: var(--text-muted);
  letter-spacing: 1.4px;
  text-transform: uppercase;
  margin: 6px 4px 10px;
  display: flex; align-items: center; gap: 6px;
}
.action-section-title::after {
  content: ''; flex: 1; height: 0.5px;
  background: var(--border-pink); opacity: 0.6;
}

.action-card {
  background: linear-gradient(135deg, #FFFFFF 0%, #FEF3C7 60%, #FFFFFF 100%);
  border-radius: 16px;
  padding: 14px;
  border-left: 3px solid var(--amber-500);
  box-shadow: 0 4px 14px rgba(245,158,11,0.12);
  margin-bottom: 12px;
}
.ac-header {
  display: flex; align-items: flex-start; gap: 10px;
  margin-bottom: 10px;
}
.ac-icon {
  width: 38px; height: 38px;
  border-radius: 12px;
  background: linear-gradient(135deg, #F59E0B, #FB923C);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(245,158,11,0.4);
}
.ac-title-block { flex: 1; min-width: 0; }
.ac-tag {
  font-size: 9.5px; font-weight: 800;
  letter-spacing: 1.2px;
  color: var(--amber-700);
  display: inline-flex; align-items: center; gap: 5px;
  margin-bottom: 4px;
}
.ac-title {
  font-size: 14.5px; font-weight: 800;
  color: var(--text-primary);
  line-height: 1.2;
}
.ac-body {
  font-size: 12.5px; line-height: 1.5;
  color: var(--text-secondary);
  margin-bottom: 10px;
}
.ac-body strong { color: var(--text-primary); font-weight: 700; }
.ac-highlight {
  background: var(--amber-100);
  color: var(--amber-800);
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
}

.ac-details {
  background: rgba(255,255,255,0.7);
  border: 0.5px solid var(--amber-300);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 12px;
}
.ac-detail-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 4px 0;
  font-size: 11.5px;
}
.ac-detail-label {
  color: var(--text-muted);
  display: flex; align-items: center; gap: 5px;
}
.ac-detail-value {
  font-weight: 700;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
}
.ac-detail-value.down { color: var(--amber-700); }

.ac-actions {
  display: flex; gap: 8px;
}
.ac-btn {
  flex: 1;
  padding: 11px 14px;
  border-radius: 12px;
  font-size: 13px; font-weight: 700;
  border: none;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
}
.ac-btn-apply {
  background: linear-gradient(135deg, #F59E0B 0%, #FB923C 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(245,158,11,0.35);
}
.ac-btn-dismiss {
  background: var(--bg-surface);
  border: 0.5px solid var(--border-pink);
  color: var(--text-tertiary);
}

/* Mini compact chart in body */
.ac-mini-chart {
  background: rgba(255,255,255,0.6);
  border-radius: 10px;
  padding: 8px 10px;
  margin-bottom: 10px;
  display: flex; align-items: center; gap: 10px;
}
.ac-mini-label {
  font-size: 9.5px; font-weight: 700;
  color: var(--amber-700);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  width: 72px;
}
.ac-mini-chart svg {
  flex: 1;
  height: 26px;
}

/* Secondary action card (positive variant) */
.action-card.positive {
  background: linear-gradient(135deg, #FFFFFF 0%, #D1FAE5 60%, #FFFFFF 100%);
  border-left-color: var(--green-500);
  box-shadow: 0 4px 14px rgba(16,185,129,0.12);
}
.action-card.positive .ac-icon {
  background: linear-gradient(135deg, #10B981, #6EE7B7);
  box-shadow: 0 4px 10px rgba(16,185,129,0.4);
}
.action-card.positive .ac-tag { color: var(--green-700); }
.action-card.positive .ac-highlight {
  background: var(--green-100);
  color: var(--green-700);
}
.action-card.positive .ac-btn-apply {
  background: linear-gradient(135deg, #10B981 0%, #059669 100%);
  box-shadow: 0 4px 12px rgba(16,185,129,0.35);
}
.action-card.positive .ac-details {
  border-color: var(--green-300);
}
.action-card.positive .ac-detail-value.down { color: var(--green-700); }
"""
    body = f"""
  {app_header_html(subtitle="3 đề xuất từ phân tích", show_live_dot=True)}
  <div class="main-scroll">

    <div class="ai-bubble-wrap">
      {AI_AVATAR_SVG}
      <div class="ai-bubble">
        <div class="ai-bubble-text">
          Aida có <strong>2 đề xuất</strong> dựa trên xu hướng 7 ngày qua. Mời anh xem và quyết định:
        </div>
      </div>
    </div>

    <div class="action-section-title">Cần chú ý ngay</div>

    <div class="action-card">
      <div class="ac-header">
        <div class="ac-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 22h20L12 2z"/>
            <line x1="12" y1="9" x2="12" y2="14"/>
            <circle cx="12" cy="17" r="0.8" fill="white"/>
          </svg>
        </div>
        <div class="ac-title-block">
          <div class="ac-tag">🏷️ DẦU ĂN GIẢM TREND</div>
          <div class="ac-title">Doanh thu dầu ăn giảm 18%</div>
        </div>
      </div>

      <div class="ac-mini-chart">
        <div class="ac-mini-label">7 ngày<br>qua</div>
        <svg viewBox="0 0 200 26" preserveAspectRatio="none">
          <defs>
            <linearGradient id="spark-amber" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.35"/>
              <stop offset="100%" stop-color="#F59E0B" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <path d="M0,4 L25,6 L50,8 L75,10 L100,12 L125,15 L150,18 L175,21 L200,22 L200,26 L0,26 Z"
                fill="url(#spark-amber)"/>
          <path d="M0,4 L25,6 L50,8 L75,10 L100,12 L125,15 L150,18 L175,21 L200,22"
                stroke="#F59E0B" stroke-width="1.6" fill="none"/>
          <circle cx="200" cy="22" r="2.5" fill="#F59E0B"/>
        </svg>
      </div>

      <div class="ac-body">
        Doanh thu danh mục <strong>dầu ăn</strong> giảm <span class="ac-highlight">-18%</span> trong 7 ngày, chiếm <strong>62%</strong> mức sụt giảm tổng. <strong>3 đối thủ trên Shopee</strong> đang khuyến mãi cùng dòng SP.
      </div>

      <div class="ac-details">
        <div class="ac-detail-row">
          <span class="ac-detail-label">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#7C7591" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            7 ngày qua
          </span>
          <span class="ac-detail-value down">4,4tr ↓18%</span>
        </div>
        <div class="ac-detail-row">
          <span class="ac-detail-label">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#7C7591" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
            Giá đối thủ Shopee
          </span>
          <span class="ac-detail-value">42K · -15%</span>
        </div>
        <div class="ac-detail-row">
          <span class="ac-detail-label">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#7C7591" stroke-width="2"><path d="M16 11V7a4 4 0 0 0-8 0v4M5 9h14l-1 12H6L5 9z"/></svg>
            Tồn kho dầu ăn
          </span>
          <span class="ac-detail-value">38 chai</span>
        </div>
      </div>

      <div class="ac-actions">
        <button class="ac-btn ac-btn-apply">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Tạo khuyến mãi -10%
        </button>
        <button class="ac-btn ac-btn-dismiss">Để sau</button>
      </div>
    </div>

    <div class="action-section-title">Cơ hội nắm bắt</div>

    <div class="action-card positive">
      <div class="ac-header">
        <div class="ac-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 17l5-5 4 4 6-7 3 3"/>
            <circle cx="8" cy="12" r="1.2" fill="white"/>
            <circle cx="18" cy="9" r="1.2" fill="white"/>
          </svg>
        </div>
        <div class="ac-title-block">
          <div class="ac-tag">📈 NƯỚC TƯƠNG ĐANG TRENDING</div>
          <div class="ac-title">Tăng 6% — nên tăng stock</div>
        </div>
      </div>

      <div class="ac-body">
        <strong>Nước tương Maggi 700ml</strong> và <strong>Chinsu cao cấp</strong> bán chạy 7 ngày qua <span class="ac-highlight">+6%</span>. Tồn kho hiện tại chỉ đủ <strong>5 ngày</strong> với rate hiện tại.
      </div>

      <div class="ac-details">
        <div class="ac-detail-row">
          <span class="ac-detail-label">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#7C7591" stroke-width="2"><path d="M3 17l5-5 4 4 6-7 3 3"/></svg>
            Tăng trưởng
          </span>
          <span class="ac-detail-value down" style="color: var(--green-700);">+6% / 7d</span>
        </div>
        <div class="ac-detail-row">
          <span class="ac-detail-label">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#7C7591" stroke-width="2"><path d="M16 11V7a4 4 0 0 0-8 0v4M5 9h14l-1 12H6L5 9z"/></svg>
            Tồn kho hiện tại
          </span>
          <span class="ac-detail-value">52 chai · ~5 ngày</span>
        </div>
      </div>

      <div class="ac-actions">
        <button class="ac-btn ac-btn-apply">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round"><path d="M16 11V7a4 4 0 0 0-8 0v4M5 9h14l-1 12H6L5 9z"/></svg>
          Đặt thêm 100 chai
        </button>
        <button class="ac-btn ac-btn-dismiss">Để sau</button>
      </div>
    </div>

  </div>
  {BOTTOM_BAR_HTML}
"""
    return page_shell("Intent 07 — State H (Action Suggestion)", extra_css, body)


# ================================================================
# STATE I — Clarify (LLM asks back when ambiguous)
# ================================================================

def build_state_I():
    extra_css = """
.clarify-card {
  background: linear-gradient(135deg, #FFFFFF 0%, #FEF3F8 100%);
  border: 0.5px solid var(--border-pink);
  border-left: 3px solid var(--pink-500);
  border-radius: 14px;
  padding: 14px;
  margin-top: 4px;
  box-shadow: var(--shadow-card);
}
.clarify-tag {
  font-size: 9.5px; font-weight: 800;
  letter-spacing: 1.4px;
  color: var(--pink-700);
  text-transform: uppercase;
  display: inline-flex; align-items: center; gap: 5px;
  margin-bottom: 6px;
}
.clarify-tag::before {
  content: '?'; font-size: 12px; font-weight: 900;
}
.clarify-question {
  font-size: 14px; font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 12px;
  line-height: 1.35;
}
.clarify-options {
  display: flex; flex-direction: column; gap: 8px;
}
.clarify-option {
  background: var(--bg-surface);
  border: 0.5px solid var(--border-pink);
  border-radius: 12px;
  padding: 11px 12px;
  display: flex; align-items: center; gap: 10px;
  cursor: pointer;
}
.clarify-option:hover {
  border-color: var(--pink-500);
  background: var(--bg-tinted);
}
.clarify-opt-icon {
  width: 32px; height: 32px;
  border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.clarify-opt-icon.l { background: linear-gradient(135deg, #FCE7F3, #FBCFE8); }
.clarify-opt-icon.b { background: linear-gradient(135deg, #FFEDD5, #FED7AA); }
.clarify-opt-icon.d { background: linear-gradient(135deg, #EDE9FE, #C4B5FD); }

.clarify-opt-content { flex: 1; min-width: 0; }
.clarify-opt-title {
  font-size: 13px; font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}
.clarify-opt-sub {
  font-size: 10.5px; color: var(--text-muted);
  margin-top: 2px;
}
.clarify-opt-arrow {
  flex-shrink: 0;
  color: var(--text-tertiary);
  opacity: 0.7;
}
.clarify-hint {
  margin-top: 10px;
  padding: 8px 10px;
  background: rgba(255,255,255,0.6);
  border: 0.5px dashed var(--border-pink);
  border-radius: 10px;
  font-size: 11px; color: var(--text-secondary);
  display: flex; align-items: center; gap: 6px;
}
.clarify-hint svg { flex-shrink: 0; }
"""
    body = f"""
  {app_header_html(subtitle="Cần làm rõ thêm", show_live_dot=False)}
  <div class="main-scroll">

    <div class="user-bubble-wrap">
      <div class="user-bubble">
        <div class="user-bubble-text">"So sánh tháng này với tháng trước"</div>
        <div class="user-bubble-meta">
          <span class="mic-mini">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><rect x="9" y="2" width="6" height="12" rx="3"/></svg>
            0:02
          </span>
          <span class="confidence-badge">✓ 97% rõ</span>
        </div>
      </div>
    </div>

    <div class="ai-bubble-wrap">
      {AI_AVATAR_SVG}
      <div class="ai-bubble">
        <div class="ai-bubble-text">
          Anh muốn so sánh <strong>theo chỉ số nào</strong>? Aida hỗ trợ 3 góc nhìn khác nhau:
        </div>

        <div class="clarify-card">
          <div class="clarify-tag">Aida hỏi lại</div>
          <div class="clarify-question">Bạn muốn xem so sánh kiểu nào?</div>

          <div class="clarify-options">
            <div class="clarify-option">
              <div class="clarify-opt-icon l">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#BE185D" stroke-width="2" stroke-linecap="round"><path d="M3 17l5-5 4 4 6-7 3 3"/></svg>
              </div>
              <div class="clarify-opt-content">
                <div class="clarify-opt-title">Doanh thu tổng theo ngày</div>
                <div class="clarify-opt-sub">Biểu đồ đường · 2 series chồng nhau</div>
              </div>
              <svg class="clarify-opt-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>
            </div>

            <div class="clarify-option">
              <div class="clarify-opt-icon b">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EA580C" stroke-width="2" stroke-linecap="round"><rect x="3" y="13" width="4" height="8"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="10" width="4" height="11"/></svg>
              </div>
              <div class="clarify-opt-content">
                <div class="clarify-opt-title">Theo danh mục sản phẩm</div>
                <div class="clarify-opt-sub">Biểu đồ cột · nhóm cạnh nhau</div>
              </div>
              <svg class="clarify-opt-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>
            </div>

            <div class="clarify-option">
              <div class="clarify-opt-icon d">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6D28D9" stroke-width="2"><rect x="3" y="6" width="6" height="14"/><rect x="11" y="3" width="6" height="17"/></svg>
              </div>
              <div class="clarify-opt-content">
                <div class="clarify-opt-title">Top 10 sản phẩm bán chạy</div>
                <div class="clarify-opt-sub">Biểu đồ cột · 2 cột song song / SP</div>
              </div>
              <svg class="clarify-opt-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>
            </div>
          </div>

          <div class="clarify-hint">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9F1239" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h0"/></svg>
            <span>Hoặc nói lại rõ hơn — VD: <strong>"so sánh doanh thu mì tôm 2 tháng"</strong></span>
          </div>
        </div>
      </div>
    </div>

  </div>
  {BOTTOM_BAR_HTML}
"""
    return page_shell("Intent 07 — State I (Clarify)", extra_css, body)


# ================================================================
# STATE J — Error (analytics timeout)
# ================================================================

def build_state_J():
    extra_css = """
.error-stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 22px 110px;
  text-align: center;
}
.error-orb {
  position: relative;
  width: 140px; height: 140px;
  margin-bottom: 24px;
  display: flex; align-items: center; justify-content: center;
}
.error-orb-pulse {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(244,63,94,0.18);
  animation: errorPulse 1.6s ease-in-out infinite;
}
@keyframes errorPulse {
  0%,100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.15); opacity: 0.5; }
}
.error-orb-core {
  width: 100px; height: 100px;
  border-radius: 50%;
  background: linear-gradient(135deg, #FECDD3 0%, #F43F5E 70%, #BE123C 100%);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8px 24px rgba(244,63,94,0.45), inset 0 4px 12px rgba(255,255,255,0.3);
  animation: errorShake 0.6s ease-in-out 2;
  position: relative;
  z-index: 1;
}
@keyframes errorShake {
  0%,100% { transform: translateX(0); }
  20%,60% { transform: translateX(-3px); }
  40%,80% { transform: translateX(3px); }
}

.error-label {
  font-size: 10px; font-weight: 800;
  color: var(--rose-600);
  letter-spacing: 2.5px;
  text-transform: uppercase;
  margin-bottom: 6px;
}
.error-title {
  font-size: 19px; font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 8px;
  line-height: 1.25;
  max-width: 280px;
}
.error-subtitle {
  font-size: 13px; color: var(--text-secondary);
  line-height: 1.5;
  max-width: 280px;
  margin-bottom: 14px;
}

.error-code-box {
  background: var(--bg-tinted);
  border: 0.5px solid var(--border-pink);
  border-radius: 10px;
  padding: 8px 12px;
  margin-bottom: 22px;
  display: flex; align-items: center; gap: 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}
.ec-label {
  color: var(--text-muted);
  font-weight: 500;
}
.ec-code {
  color: var(--rose-600);
  font-weight: 700;
}
.ec-divider {
  width: 1px; height: 14px;
  background: var(--border-pink);
}
.ec-trace {
  color: var(--text-muted);
  font-size: 10px;
}

.error-tips {
  width: 100%;
  background: var(--bg-surface);
  border: 0.5px solid var(--border-pink);
  border-radius: 14px;
  padding: 12px 14px;
  margin-bottom: 14px;
  box-shadow: var(--shadow-card);
  text-align: left;
}
.error-tips-title {
  font-size: 11px; font-weight: 800;
  color: var(--text-tertiary);
  letter-spacing: 1.2px;
  text-transform: uppercase;
  margin-bottom: 8px;
  display: flex; align-items: center; gap: 5px;
}
.error-tips-title::before {
  content: '💡'; font-size: 12px;
}
.error-tip-item {
  font-size: 12px; color: var(--text-primary);
  line-height: 1.5;
  padding-left: 18px;
  position: relative;
  margin-bottom: 4px;
}
.error-tip-item::before {
  content: '•';
  position: absolute;
  left: 6px;
  color: var(--pink-500);
  font-weight: 700;
}
.error-tip-item:last-child { margin-bottom: 0; }

.error-actions {
  display: flex; gap: 10px;
  width: 100%;
}
.err-btn {
  flex: 1;
  padding: 13px;
  border-radius: 14px;
  font-size: 13.5px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
}
.err-btn-retry {
  background: var(--grad-mic);
  color: white;
  box-shadow: var(--shadow-pink-md);
}
.err-btn-typing {
  background: var(--bg-surface);
  border: 0.5px solid var(--border-pink);
  color: var(--text-tertiary);
}
"""
    body = f"""
  {app_header_html(subtitle="Phân tích thất bại", show_live_dot=False)}
  <div class="error-stage">

    <div class="error-orb">
      <div class="error-orb-pulse"></div>
      <div class="error-orb-core">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <circle cx="12" cy="16" r="0.8" fill="white"/>
        </svg>
      </div>
    </div>

    <div class="error-label">Đã xảy ra lỗi</div>
    <h2 class="error-title">Phân tích bị quá thời gian</h2>
    <p class="error-subtitle">
      Truy vấn 30 ngày dữ liệu mất hơn 5 giây — có thể do mạng chậm hoặc dữ liệu nhiều bất thường.
    </p>

    <div class="error-code-box">
      <span class="ec-label">code:</span>
      <span class="ec-code">E_ANALYTICS_TIMEOUT</span>
      <span class="ec-divider"></span>
      <span class="ec-trace">trace: 8b4f...a12</span>
    </div>

    <div class="error-tips">
      <div class="error-tips-title">Aida gợi ý</div>
      <div class="error-tip-item">Thử rút ngắn khoảng thời gian (vd: 7 ngày thay vì 30)</div>
      <div class="error-tip-item">Hỏi 1 chỉ số cụ thể: <strong>"doanh thu"</strong> thay vì <strong>"tổng quan"</strong></div>
      <div class="error-tip-item">Kiểm tra kết nối mạng và thử lại sau ít phút</div>
    </div>

    <div class="error-actions">
      <button class="err-btn err-btn-retry">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-9-9 9 9 0 0 1 9-9"/>
          <path d="M21 3v9h-9"/>
        </svg>
        Thử lại
      </button>
      <button class="err-btn err-btn-typing">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#BE185D" stroke-width="2" stroke-linecap="round"><path d="M3 7h18M3 12h18M3 17h12"/></svg>
        Gõ tay thay
      </button>
    </div>

  </div>
"""
    return page_shell("Intent 07 — State J (Error)", extra_css, body)


# ================================================================
# BUILDER REGISTRY + RUN
# ================================================================

builders = {
    "intent-07-state-A-listening.html": build_state_A,
    "intent-07-state-B-analyzing.html": build_state_B,
    "intent-07-state-D-chart-bar.html": build_state_D,
    "intent-07-state-E-chart-donut.html": build_state_E,
    "intent-07-state-F-empty-no-data.html": build_state_F,
    "intent-07-state-G-drilldown-expanded.html": build_state_G,
    "intent-07-state-H-action-suggestion.html": build_state_H,
    "intent-07-state-I-clarify.html": build_state_I,
    "intent-07-state-J-error.html": build_state_J,
}


if __name__ == "__main__":
    out_dir = Path(__file__).parent
    print(f"\nBuilding 9 states to {out_dir}/")
    print("=" * 60)
    for filename, builder_fn in builders.items():
        html = builder_fn()
        out_path = out_dir / filename
        out_path.write_text(html, encoding="utf-8")
        size_kb = len(html) / 1024
        print(f"  ✓ {filename:<48} ({size_kb:.1f} KB)")
    print("=" * 60)
    print(f"Total: {len(builders)} files generated.\n")
