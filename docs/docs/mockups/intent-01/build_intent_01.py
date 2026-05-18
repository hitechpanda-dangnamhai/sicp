"""
Intent 01 — Import by Image · Mockup Builder
Generates edge/secondary states from shared template functions.
Run: python3 build_intent_01.py

Outputs:
  intent-01-state-A-analyzing.html              (4-phase loading checklist; Phase 4 = Shopee + Google Trends)
  intent-01-state-C-suggestions-rising.html     (Form + AI bubble cards; market rising scenario)
  intent-01-state-C-suggestions-falling.html    (Form + AI bubble cards; market falling scenario)
  intent-01-state-D-shopee-expanded.html        (Full Shopee panel with 5 similars)
  intent-01-state-E-blur-error.html             (Blur error + retake CTA)
  intent-01-state-F-low-confidence.html         (Form with uncertain fields highlighted)
  intent-01-state-G-success.html                (Brain check badge + product preview)
  intent-01-state-H-trend-expanded.html         (Google Trends panel: hero delta + sparkline + chips + AI reasoning)

Hand-crafted (not built here, copy through):
  intent-01-state-0-capture.html                (Camera capture)
  intent-01-state-B-prefilled.html              (Form prefilled + Shopee compact + Market Trend compact)
"""

from pathlib import Path

OUT = Path(__file__).parent

# ============================================================================
# SHARED PARTIALS
# ============================================================================

FONT_AND_RESET = """
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
"""

BASE_CSS = """
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Be Vietnam Pro', -apple-system, sans-serif;
    background: #FDF2F4;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 14px;
    color: #831447;
  }
  .phone-frame {
    width: 100%;
    max-width: 414px;
    height: 844px;
    max-height: calc(100vh - 48px);
    background: linear-gradient(180deg, #FCE7F0 0%, #FEEEE0 40%, #FFF8F0 100%);
    border-radius: 24px;
    overflow: hidden;
    border: 0.5px solid #F9D8E4;
    box-shadow: 0 20px 60px rgba(233,30,99,0.18);
    position: relative;
    display: flex;
    flex-direction: column;
  }
  @media (min-width: 1024px) {
    body { padding: 32px; }
    .phone-frame { box-shadow: 0 32px 80px rgba(233,30,99,0.24); max-height: calc(100vh - 64px); }
  }
  button { font-family: inherit; cursor: pointer; border: none; }
  input, textarea { font-family: inherit; outline: none; }

  @keyframes pop { 0%{transform:scale(0.96); opacity:0} 100%{transform:scale(1); opacity:1} }
  @keyframes drift { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
  @keyframes glow { 0%,100%{opacity:0.7; transform:scale(1)} 50%{opacity:1; transform:scale(1.05)} }
  @keyframes pulseRing { 0%{transform:scale(1); opacity:0.5} 100%{transform:scale(1.6); opacity:0} }
  @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  @keyframes spin { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }
  @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
  @keyframes elastic-pop { 0%{transform:scale(0); opacity:0} 60%{transform:scale(1.2)} 100%{transform:scale(1); opacity:1} }
  @keyframes slideUp { 0%{transform:translateY(20px); opacity:0} 100%{transform:translateY(0); opacity:1} }
  .orb { animation: drift 4s ease-in-out infinite; }
  .pulse-dot { animation: glow 1.6s ease-in-out infinite; }
  .pulse-ring { animation: pulseRing 2.4s ease-out infinite; }
  .spinner { animation: spin 1s linear infinite; }
  .tile { animation: pop 0.5s ease-out backwards; }

  .status-bar {
    height: 44px;
    padding: 0 22px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #831447;
    font-weight: 600;
    font-size: 14px;
    flex-shrink: 0;
  }
  .status-bar .right { display: flex; gap: 6px; align-items: center; }
"""

STATUS_BAR = """
  <div class="status-bar">
    <span>9:41</span>
    <div class="right">
      <svg width="18" height="11" viewBox="0 0 18 11" fill="none">
        <rect x="0" y="6" width="3" height="5" rx="1" fill="#831447"/>
        <rect x="5" y="4" width="3" height="7" rx="1" fill="#831447"/>
        <rect x="10" y="2" width="3" height="9" rx="1" fill="#831447"/>
        <rect x="15" y="0" width="3" height="11" rx="1" fill="#831447"/>
      </svg>
      <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
        <path d="M7.5 10.5C8.05 10.5 8.5 10.05 8.5 9.5C8.5 8.95 8.05 8.5 7.5 8.5C6.95 8.5 6.5 8.95 6.5 9.5C6.5 10.05 6.95 10.5 7.5 10.5ZM4 6.5L5 7.5C6.4 6.1 8.6 6.1 10 7.5L11 6.5C9 4.5 6 4.5 4 6.5ZM1 3.5L2 4.5C5.05 1.45 9.95 1.45 13 4.5L14 3.5C10.4 -0.1 4.6 -0.1 1 3.5Z" fill="#831447"/>
      </svg>
      <div style="width:24px; height:11px; border:1px solid #831447; border-radius:3px; padding:1px; position:relative;">
        <div style="width:75%; height:100%; background:#831447; border-radius:1px;"></div>
        <div style="position:absolute; right:-3px; top:3px; width:2px; height:5px; background:#831447; border-radius:0 1px 1px 0;"></div>
      </div>
    </div>
  </div>
"""


def brain_svg(size=120, with_check=False):
    """Returns the SVG brain icon, optionally with a green check badge bottom-right."""
    check_badge = ""
    if with_check:
        check_badge = """
        <div style="position:absolute; bottom:6px; right:6px; width:42px; height:42px;
                    background: linear-gradient(135deg, #10B981, #059669); border-radius:50%;
                    display:flex; align-items:center; justify-content:center;
                    border: 3px solid #fff; box-shadow: 0 6px 14px rgba(16,185,129,0.4);
                    animation: elastic-pop 0.6s cubic-bezier(0.34,1.56,0.64,1);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        """
    return f"""
    <div style="position: relative; width: {size}px; height: {size}px; margin: 0 auto;">
      <div style="position: absolute; inset: -20px;
                  background: radial-gradient(circle, rgba(233,30,99,0.25) 0%, rgba(251,146,60,0.15) 50%, transparent 75%);
                  border-radius: 50%; animation: glow 3s ease-in-out infinite;"></div>
      <div style="position:absolute; inset:10px; border: 1.5px solid rgba(233,30,99,0.3); border-radius:50%;" class="pulse-ring"></div>
      <div style="position:absolute; inset:10px; border: 1.5px solid rgba(251,146,60,0.3); border-radius:50%; animation-delay: 1.2s;" class="pulse-ring"></div>
      <svg viewBox="0 0 120 120" width="{size}" height="{size}" class="orb" style="position:relative; z-index:1;">
        <defs>
          <radialGradient id="brainGrad{size}" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#FFE4E6"/>
            <stop offset="55%" stop-color="#F9A8D4"/>
            <stop offset="100%" stop-color="#BE185D"/>
          </radialGradient>
        </defs>
        <path d="M60 18 C42 18, 28 30, 26 46 C20 50, 18 58, 22 66 C20 74, 26 82, 36 84 C40 92, 50 96, 60 94 C70 96, 80 92, 84 84 C94 82, 100 74, 98 66 C102 58, 100 50, 94 46 C92 30, 78 18, 60 18 Z"
              fill="url(#brainGrad{size})" stroke="#BE185D" stroke-width="0.5" stroke-opacity="0.4"/>
        <path d="M60 28 Q55 45, 60 60 Q65 75, 60 88" stroke="#FFFFFF" stroke-width="1" fill="none" opacity="0.7"/>
        <path d="M38 50 Q60 45, 82 50" stroke="#FFFFFF" stroke-width="1" fill="none" opacity="0.5"/>
        <path d="M40 70 Q60 65, 80 70" stroke="#FFFFFF" stroke-width="1" fill="none" opacity="0.5"/>
        <circle cx="60" cy="40" r="2.5" fill="#FFFFFF"/>
        <circle cx="48" cy="58" r="2" fill="#FFFFFF"/>
        <circle cx="72" cy="58" r="2" fill="#FFFFFF"/>
        <circle cx="55" cy="76" r="2" fill="#FFFFFF"/>
        <circle cx="68" cy="76" r="2" fill="#FFFFFF"/>
      </svg>
      {check_badge}
    </div>
    """


def top_bar(title, subtitle=None, action_label=None, with_progress=False, progress_pct=75, progress_text="9 / 12 trường"):
    sub_html = f'<div style="font-size:11px; color:#BE185D; font-weight:500; margin-top:1px;">{subtitle}</div>' if subtitle else ""
    action_html = f'<button style="font-size:12px; color:#BE185D; font-weight:600; padding:6px 10px; background:rgba(255,255,255,0.7); border-radius:10px; border:0.5px solid #FBCFE8;">{action_label}</button>' if action_label else ""
    progress_html = ""
    if with_progress:
        progress_html = f"""
        <div style="height:4px; background:rgba(251,207,232,0.4); border-radius:2px; overflow:hidden;">
          <div style="width:{progress_pct}%; height:100%; background:linear-gradient(90deg, #E91E63 0%, #FB923C 100%); border-radius:2px;"></div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
          <span style="font-size:10px; color:#BE185D; font-weight:600; letter-spacing:0.3px; text-transform:uppercase;">✓ Aida đã điền</span>
          <span style="font-family:'JetBrains Mono', monospace; font-size:11px; color:#E91E63; font-weight:700;">{progress_text}</span>
        </div>
        """
    return f"""
    <div style="padding: 4px 18px 12px; flex-shrink: 0;">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:{'10px' if with_progress else '0'};">
        <button style="width:36px; height:36px; background:#FFFFFF; border:0.5px solid #FBCFE8; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(233,30,99,0.1);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#BE185D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <div style="flex:1;">
          <div style="font-size:16px; font-weight:700; color:#831447; letter-spacing:-0.3px;">{title}</div>
          {sub_html}
        </div>
        {action_html}
      </div>
      {progress_html}
    </div>
    """


def page_shell(title_attr, head_extra, body_inner):
    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>{title_attr}</title>
{FONT_AND_RESET}
<style>{BASE_CSS}
{head_extra}
</style>
</head>
<body>
<div class="phone-frame">
{STATUS_BAR}
{body_inner}
</div>
</body>
</html>
"""


# ============================================================================
# STATE A — Analyzing (4-phase checklist)
# ============================================================================

def build_state_A():
    head = """
  .analyzing-content {
    flex: 1;
    padding: 0 22px;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow-y: auto;
    padding-bottom: 40px;
  }
  .ai-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, #FFE4E6, #FECDD3);
    color: #BE185D;
    padding: 5px 11px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
    margin-top: 20px;
    text-transform: uppercase;
    border: 0.5px solid #FBCFE8;
  }
  .ai-label .dot {
    width: 6px; height: 6px;
    background: linear-gradient(135deg, #E91E63, #FB923C);
    border-radius: 50%;
  }
  .analyzing-title {
    font-size: 22px;
    font-weight: 700;
    color: #831447;
    text-align: center;
    margin-top: 18px;
    letter-spacing: -0.5px;
    line-height: 1.25;
  }
  .analyzing-sub {
    font-size: 12px;
    color: #BE185D;
    text-align: center;
    margin-top: 8px;
    font-weight: 500;
  }
  .phases-list {
    width: 100%;
    margin-top: 24px;
    background: #FFFFFF;
    border: 0.5px solid #FBCFE8;
    border-radius: 18px;
    padding: 6px;
    box-shadow: 0 8px 22px rgba(233,30,99,0.1);
  }
  .phase-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 12px;
    border-radius: 12px;
    transition: all 0.3s;
  }
  .phase-row.active {
    background: linear-gradient(135deg, #FFF1F5 0%, #FEEEE0 100%);
    box-shadow: 0 4px 12px rgba(233,30,99,0.12);
  }
  .phase-icon {
    width: 36px; height: 36px;
    border-radius: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .phase-icon.done {
    background: linear-gradient(135deg, #10B981, #059669);
    color: #fff;
    box-shadow: 0 3px 8px rgba(16,185,129,0.3);
  }
  .phase-icon.active {
    background: linear-gradient(135deg, #E91E63, #FB923C);
    color: #fff;
    box-shadow: 0 3px 10px rgba(233,30,99,0.4);
  }
  .phase-icon.pending {
    background: #FCE7F3;
    color: #F9A8D4;
  }
  .phase-text { flex: 1; }
  .phase-label {
    font-size: 13px;
    font-weight: 600;
    color: #831447;
    margin-bottom: 2px;
  }
  .phase-row.pending .phase-label { color: #BE185D; opacity: 0.5; }
  .phase-meta {
    font-size: 10px;
    color: #BE185D;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
  }
  .phase-status {
    font-size: 10px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 7px;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    flex-shrink: 0;
  }
  .phase-status.done { background: rgba(16,185,129,0.12); color: #15803D; }
  .phase-status.active { background: linear-gradient(135deg, #E91E63, #FB923C); color: #fff; }
  .phase-status.pending { background: #FCE7F3; color: #F9A8D4; }
  .global-progress {
    width: 100%;
    margin-top: 22px;
    background: rgba(255,255,255,0.6);
    border: 0.5px solid #FBCFE8;
    border-radius: 14px;
    padding: 14px 16px;
    backdrop-filter: blur(8px);
  }
  .gp-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .gp-label { font-size: 11px; color: #BE185D; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .gp-percent {
    font-family: 'JetBrains Mono', monospace;
    font-size: 18px;
    font-weight: 700;
    background: linear-gradient(135deg, #E91E63, #FB923C);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .gp-track {
    height: 6px;
    background: #FCE7F3;
    border-radius: 3px;
    overflow: hidden;
  }
  .gp-fill {
    width: 75%;
    height: 100%;
    background: linear-gradient(90deg, #E91E63 0%, #F43F5E 50%, #FB923C 100%);
    border-radius: 3px;
    box-shadow: 0 0 8px rgba(233,30,99,0.5);
  }
  .image-thumb-mini {
    margin-top: 18px;
    width: 110px;
    height: 110px;
    border-radius: 18px;
    background: linear-gradient(135deg, #FFE4E6, #FECDD3 50%, #FED7AA);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 3px solid #fff;
    box-shadow: 0 10px 24px rgba(233,30,99,0.2);
    position: relative;
    overflow: hidden;
  }
  .image-thumb-mini::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%);
    background-size: 200% 100%;
    animation: shimmer 2s ease-in-out infinite;
  }
"""
    body = top_bar("Aida đang phân tích", "Vui lòng chờ vài giây", action_label=None, with_progress=False) + """
  <div class="analyzing-content">

    <div class="image-thumb-mini">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="position:relative; z-index:1;">
        <path d="M14 2v6.343c0 .53.21 1.04.586 1.414L18.414 13.586c.375.375.586.884.586 1.414V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5c0-.53.21-1.04.586-1.414L9.414 9.757A2 2 0 0 0 10 8.343V2"/>
        <line x1="9" y1="2" x2="15" y2="2"/>
        <line x1="8" y1="13" x2="16" y2="13"/>
      </svg>
    </div>

    <div class="ai-label">
      <span class="dot pulse-dot"></span>
      Aida • Đang xử lý
    </div>

    <h1 class="analyzing-title">Đang sinh dấu vân tay<br>sản phẩm của bạn</h1>
    <p class="analyzing-sub">Aida xử lý 4 bước thông minh · ~3 giây nữa</p>

    <div class="phases-list">

      <div class="phase-row">
        <div class="phase-icon done">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div class="phase-text">
          <div class="phase-label">Tải ảnh lên</div>
          <div class="phase-meta">2.4 MB · 0.8s</div>
        </div>
        <span class="phase-status done">XONG</span>
      </div>

      <div class="phase-row">
        <div class="phase-icon done">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div class="phase-text">
          <div class="phase-label">Đọc nhãn sản phẩm</div>
          <div class="phase-meta">Gemini Vision · 1.4s</div>
        </div>
        <span class="phase-status done">XONG</span>
      </div>

      <div class="phase-row active">
        <div class="phase-icon active">
          <svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        </div>
        <div class="phase-text">
          <div class="phase-label">Sinh dấu vân tay sản phẩm</div>
          <div class="phase-meta">Embedding 1024 chiều...</div>
        </div>
        <span class="phase-status active">ĐANG</span>
      </div>

      <div class="phase-row pending">
        <div class="phase-icon pending">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3v18h18"/>
            <path d="M7 16l4-4 4 3 5-6"/>
          </svg>
        </div>
        <div class="phase-text">
          <div class="phase-label">Phân tích thị trường</div>
          <div class="phase-meta">Shopee + Google Trends · Chờ bước trước</div>
        </div>
        <span class="phase-status pending">CHỜ</span>
      </div>

    </div>

    <div class="global-progress">
      <div class="gp-row">
        <span class="gp-label">Tiến độ tổng</span>
        <span class="gp-percent">75%</span>
      </div>
      <div class="gp-track"><div class="gp-fill"></div></div>
    </div>

  </div>
"""
    return page_shell("Intent 01 — State A — Analyzing", head, body)


# ============================================================================
# STATE C — Action card suggestions (inline bubble)
# ============================================================================

def build_state_C(scenario="rising"):
    """
    scenario:
      - 'rising'  → market trend up, show SUGGEST_STOCK_UP card replacing one default
      - 'falling' → market trend down, show SUGGEST_WAIT_OR_REDUCE card
    """
    head = """
  .main-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 8px 18px 160px;
  }
  /* Inline-form compact preview (already-prefilled state) */
  .form-summary {
    background: #FFFFFF;
    border-radius: 16px;
    padding: 14px;
    border: 0.5px solid #FBCFE8;
    box-shadow: 0 4px 12px rgba(233,30,99,0.08);
    margin-bottom: 18px;
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .form-summary-thumb {
    width: 56px; height: 56px;
    border-radius: 12px;
    background: linear-gradient(135deg, #FFE4E6, #FED7AA);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .form-summary-info { flex: 1; min-width: 0; }
  .form-summary-title { font-size: 13px; font-weight: 700; color: #831447; line-height: 1.3; }
  .form-summary-meta {
    font-size: 11px; color: #BE185D; font-weight: 500; margin-top: 3px;
    font-family: 'JetBrains Mono', monospace;
  }
  .form-summary-edit {
    width: 32px; height: 32px;
    background: linear-gradient(135deg, #FEF3F8, #FCE7F3);
    border: 0.5px solid #FBCFE8;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #BE185D;
    flex-shrink: 0;
  }

  /* AI bubble (chat-style) */
  .ai-bubble-row {
    display: flex;
    gap: 8px;
    margin-bottom: 14px;
    animation: slideUp 0.4s ease-out backwards;
  }
  .ai-avatar {
    width: 32px; height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #E91E63, #FB923C);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 3px 8px rgba(233,30,99,0.3);
  }
  .ai-bubble {
    flex: 1;
    background: #FFFFFF;
    border-radius: 4px 16px 16px 16px;
    padding: 14px;
    border: 0.5px solid #FBCFE8;
    box-shadow: 0 4px 12px rgba(233,30,99,0.08);
  }
  .ai-bubble-greet {
    font-size: 12px;
    color: #831447;
    font-weight: 500;
    line-height: 1.5;
  }
  .ai-bubble-greet strong { color: #BE185D; font-weight: 700; }

  /* Action card */
  .action-card {
    background: linear-gradient(135deg, #FFFFFF 0%, #FEF3F8 100%);
    border-radius: 14px;
    padding: 12px;
    margin-top: 10px;
    border-left: 3px solid;
    box-shadow: 0 2px 8px rgba(233,30,99,0.06);
  }
  .ac-price { border-left-color: #FB923C; }
  .ac-attrs { border-left-color: #E91E63; }
  .ac-alt { border-left-color: #F43F5E; }
  .ac-stock-up { border-left-color: #10B981; }
  .ac-wait { border-left-color: #F59E0B; }

  .ac-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .ac-icon {
    width: 28px; height: 28px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .ac-price .ac-icon { background: linear-gradient(135deg, #FB923C, #EA580C); color:#fff; }
  .ac-attrs .ac-icon { background: linear-gradient(135deg, #E91E63, #BE185D); color:#fff; }
  .ac-alt .ac-icon { background: linear-gradient(135deg, #F43F5E, #E11D48); color:#fff; }
  .ac-stock-up .ac-icon { background: linear-gradient(135deg, #10B981, #059669); color:#fff; }
  .ac-wait .ac-icon { background: linear-gradient(135deg, #F59E0B, #D97706); color:#fff; }

  .ac-title-block { flex: 1; }
  .ac-tag {
    display: inline-block;
    font-size: 8px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 5px;
    letter-spacing: 0.5px;
    margin-bottom: 3px;
    text-transform: uppercase;
  }
  .ac-price .ac-tag { background: rgba(251,146,60,0.15); color: #C2410C; }
  .ac-attrs .ac-tag { background: rgba(233,30,99,0.12); color: #BE185D; }
  .ac-alt .ac-tag { background: rgba(244,63,94,0.12); color: #BE123C; }
  .ac-stock-up .ac-tag { background: rgba(16,185,129,0.14); color: #065F46; }
  .ac-wait .ac-tag { background: rgba(245,158,11,0.14); color: #92400E; }

  .ac-title { font-size: 13px; font-weight: 700; color: #831447; line-height: 1.3; }
  .ac-body { font-size: 11.5px; color: #831447; font-weight: 500; line-height: 1.5; margin-bottom: 10px; }
  .ac-body strong { color: #BE185D; font-weight: 700; }
  .ac-highlight {
    font-family: 'JetBrains Mono', monospace;
    background: linear-gradient(135deg, #FB923C, #EA580C);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    font-weight: 700;
  }

  .ac-actions {
    display: flex;
    gap: 6px;
  }
  .ac-btn-apply {
    flex: 1;
    background: linear-gradient(135deg, #E91E63, #F43F5E);
    color: #fff;
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    box-shadow: 0 3px 8px rgba(233,30,99,0.25);
  }
  .ac-btn-dismiss {
    background: rgba(255,255,255,0.7);
    border: 0.5px solid #FBCFE8;
    color: #BE185D;
    padding: 8px 14px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 600;
  }

  /* Stagger animations */
  .ai-bubble-row:nth-child(2) { animation-delay: 0.1s; }
  .ai-bubble-row:nth-child(3) { animation-delay: 0.3s; }
  .ai-bubble-row:nth-child(4) { animation-delay: 0.5s; }

  /* Bottom bar */
  .bottom-bar {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    z-index: 10;
    background: #FFF8F0;
    box-shadow: 0 -8px 16px rgba(255,248,240,0.95), 0 -16px 24px rgba(255,248,240,0.6);
    padding: 16px 18px 20px;
    display: flex;
    gap: 10px;
  }
  .btn-commit {
    flex: 1;
    background: linear-gradient(135deg, #E91E63 0%, #F43F5E 50%, #FB923C 100%);
    color: #fff;
    border-radius: 14px;
    font-size: 14px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 10px 22px rgba(233,30,99,0.35);
    height: 52px;
    letter-spacing: -0.2px;
  }
  .ac-count-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: linear-gradient(135deg, #E91E63, #FB923C);
    color: #fff;
    padding: 3px 9px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.4px;
    margin-left: 6px;
  }
"""
    # Scenario-specific data
    if scenario == "rising":
        greeting_html = 'Sản phẩm này <strong>đang hot</strong> trên thị trường! Tôi có <strong>3 gợi ý</strong> để bạn nắm cơ hội <span class="ac-count-badge">✨ 3 thẻ</span>'
        title_attr = "Intent 01 — State C — AI Suggestions (Rising)"
        card_3_html = """
    <!-- Action card 3: SUGGEST_STOCK_UP (market rising) -->
    <div class="ai-bubble-row">
      <div class="ai-avatar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L9.5 8.5 2 9 7 14 5.5 22 12 18 18.5 22 17 14 22 9 14.5 8.5z"/>
        </svg>
      </div>
      <div style="flex:1;">
        <div class="action-card ac-stock-up">
          <div class="ac-header">
            <div class="ac-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                <polyline points="17 6 23 6 23 12"/>
              </svg>
            </div>
            <div class="ac-title-block">
              <span class="ac-tag">🚀 NHU CẦU TĂNG MẠNH</span>
              <div class="ac-title">Nhập 25 thay vì 10?</div>
            </div>
          </div>
          <div class="ac-body">
            Google Trends báo nhu cầu thị trường <span class="ac-highlight">+34% trong 90 ngày</span>. Từ khoá <strong>"không đường", "ít muối"</strong> đang được tìm nhiều hơn. Nhập thêm để không hết hàng giữa sóng.
          </div>
          <div class="ac-actions">
            <button class="ac-btn-apply">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Tăng lên 25
            </button>
            <button class="ac-btn-dismiss">Giữ 10</button>
          </div>
        </div>
      </div>
    </div>"""
    else:  # scenario == "falling"
        greeting_html = 'Cảnh báo nhẹ: nhu cầu thị trường đang giảm. Tôi có <strong>3 gợi ý</strong> để bạn cân nhắc trước khi nhập <span class="ac-count-badge">⚠️ 3 thẻ</span>'
        title_attr = "Intent 01 — State C — AI Suggestions (Falling)"
        card_3_html = """
    <!-- Action card 3: SUGGEST_WAIT_OR_REDUCE (market falling) -->
    <div class="ai-bubble-row">
      <div class="ai-avatar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L9.5 8.5 2 9 7 14 5.5 22 12 18 18.5 22 17 14 22 9 14.5 8.5z"/>
        </svg>
      </div>
      <div style="flex:1;">
        <div class="action-card ac-wait">
          <div class="ac-header">
            <div class="ac-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
                <polyline points="17 18 23 18 23 12"/>
              </svg>
            </div>
            <div class="ac-title-block">
              <span class="ac-tag">⚠️ NHU CẦU GIẢM</span>
              <div class="ac-title">Giảm xuống 5 thay vì 10?</div>
            </div>
          </div>
          <div class="ac-body">
            Google Trends báo nhu cầu <span class="ac-highlight" style="background:linear-gradient(135deg,#F59E0B,#D97706);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">−22% trong 90 ngày</span>. Khách đang chuyển sang <strong>biến thể "truyền thống"</strong>. Cân nhắc nhập ít hơn hoặc chờ thêm tín hiệu.
          </div>
          <div class="ac-actions">
            <button class="ac-btn-apply" style="background:linear-gradient(135deg,#F59E0B,#D97706);box-shadow:0 3px 8px rgba(245,158,11,0.3);">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Giảm xuống 5
            </button>
            <button class="ac-btn-dismiss">Vẫn nhập 10</button>
          </div>
        </div>
      </div>
    </div>"""

    body = top_bar("Aida gợi ý", "3 đề xuất chờ bạn quyết định", with_progress=True, progress_pct=85, progress_text="11 / 12 trường") + f"""
  <div class="main-scroll">

    <!-- Form summary preview -->
    <div class="form-summary">
      <div class="form-summary-thumb">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2v6.343c0 .53.21 1.04.586 1.414L18.414 13.586c.375.375.586.884.586 1.414V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5c0-.53.21-1.04.586-1.414L9.414 9.757A2 2 0 0 0 10 8.343V2"/>
          <line x1="9" y1="2" x2="15" y2="2"/>
        </svg>
      </div>
      <div class="form-summary-info">
        <div class="form-summary-title">Maggi nước tương 200ml</div>
        <div class="form-summary-meta">25.000₫ · Tồn 50 · Maggi</div>
      </div>
      <button class="form-summary-edit">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
    </div>

    <!-- AI greeting bubble -->
    <div class="ai-bubble-row">
      <div class="ai-avatar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L9.5 8.5 2 9 7 14 5.5 22 12 18 18.5 22 17 14 22 9 14.5 8.5z"/>
        </svg>
      </div>
      <div class="ai-bubble">
        <div class="ai-bubble-greet">
          {greeting_html}
        </div>
      </div>
    </div>

    <!-- Action card 1: PRICE -->
    <div class="ai-bubble-row">
      <div class="ai-avatar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L9.5 8.5 2 9 7 14 5.5 22 12 18 18.5 22 17 14 22 9 14.5 8.5z"/>
        </svg>
      </div>
      <div style="flex:1;">
        <div class="action-card ac-price">
          <div class="ac-header">
            <div class="ac-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <div class="ac-title-block">
              <span class="ac-tag">💡 ĐỀ XUẤT GIÁ</span>
              <div class="ac-title">Tăng giá lên 27.000₫</div>
            </div>
          </div>
          <div class="ac-body">
            Giá thị trường Shopee trung bình <strong>24.500₫</strong>, nhưng 3/5 cửa hàng top đang bán <span class="ac-highlight">26.000-28.000₫</span>. Bạn có thể đặt cao hơn mức trung bình.
          </div>
          <div class="ac-actions">
            <button class="ac-btn-apply">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Áp dụng 27.000₫
            </button>
            <button class="ac-btn-dismiss">Bỏ qua</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Action card 2: ATTRS -->
    <div class="ai-bubble-row">
      <div class="ai-avatar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L9.5 8.5 2 9 7 14 5.5 22 12 18 18.5 22 17 14 22 9 14.5 8.5z"/>
        </svg>
      </div>
      <div style="flex:1;">
        <div class="action-card ac-attrs">
          <div class="ac-header">
            <div class="ac-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </div>
            <div class="ac-title-block">
              <span class="ac-tag">🏷️ THÊM THUỘC TÍNH</span>
              <div class="ac-title">3 thuộc tính giúp tìm thấy dễ hơn</div>
            </div>
          </div>
          <div class="ac-body">
            Khách Shopee thường tìm theo <strong>"vị mặn", "không đường", "đậu nành non"</strong>. Thêm vào để xuất hiện trong tìm kiếm.
          </div>
          <div class="ac-actions">
            <button class="ac-btn-apply">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Thêm 3 thuộc tính
            </button>
            <button class="ac-btn-dismiss">Xem chi tiết</button>
          </div>
        </div>
      </div>
    </div>

    {card_3_html}

  </div>

  <div class="bottom-bar">
    <button class="btn-commit">
      Hoàn tất &amp; Lưu sản phẩm
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"/>
        <polyline points="12 5 19 12 12 19"/>
      </svg>
    </button>
  </div>
"""
    return page_shell(title_attr, head, body)


# ============================================================================
# STATE D — Shopee compare expanded
# ============================================================================

def build_state_D():
    head = """
  .main-scroll { flex: 1; overflow-y: auto; padding: 8px 18px 24px; }

  .market-hero {
    background: linear-gradient(135deg, #FFEDD5 0%, #FED7AA 50%, #FB923C 100%);
    border-radius: 20px;
    padding: 18px;
    margin-bottom: 18px;
    position: relative;
    overflow: hidden;
    box-shadow: 0 8px 22px rgba(251,146,60,0.25);
  }
  .market-hero::before {
    content: '';
    position: absolute;
    top: -40px; right: -40px;
    width: 140px; height: 140px;
    background: radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%);
    border-radius: 50%;
  }
  .mh-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
    position: relative;
    z-index: 1;
  }
  .mh-icon {
    width: 38px; height: 38px;
    background: rgba(255,255,255,0.95);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 10px rgba(154,52,18,0.2);
  }
  .mh-title {
    font-size: 16px;
    font-weight: 700;
    color: #7C2D12;
    letter-spacing: -0.3px;
  }
  .mh-sub {
    font-size: 11px;
    color: #9A3412;
    font-weight: 600;
    margin-top: 1px;
  }
  .mh-stats {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
    position: relative;
    z-index: 1;
  }
  .mh-stat {
    background: rgba(255,255,255,0.85);
    border-radius: 12px;
    padding: 10px;
    text-align: center;
  }
  .mh-stat-label {
    font-size: 9px;
    color: #9A3412;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .mh-stat-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    font-weight: 700;
    color: #C2410C;
  }
  .mh-stat-value.your {
    background: linear-gradient(135deg, #E91E63, #FB923C);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  /* Price range bar bigger */
  .market-range {
    margin-top: 14px;
    background: rgba(255,255,255,0.9);
    border-radius: 14px;
    padding: 14px;
    position: relative;
    z-index: 1;
  }
  .mr-track {
    height: 14px;
    background: linear-gradient(90deg, #FED7AA 0%, #FB923C 50%, #FED7AA 100%);
    border-radius: 7px;
    position: relative;
    margin-top: 18px;
  }
  .mr-marker {
    position: absolute;
    left: 60%;
    top: -5px;
    width: 24px; height: 24px;
    background: #fff;
    border: 3px solid #E91E63;
    border-radius: 50%;
    box-shadow: 0 4px 12px rgba(233,30,99,0.5);
    transform: translateX(-50%);
  }
  .mr-marker::after {
    content: 'Bạn 25K';
    position: absolute;
    top: -28px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #E91E63, #BE185D);
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    padding: 3px 7px;
    border-radius: 6px;
    white-space: nowrap;
    box-shadow: 0 3px 8px rgba(233,30,99,0.4);
  }
  .mr-avg {
    position: absolute;
    left: 50%;
    top: 0;
    height: 100%;
    width: 2px;
    background: #9A3412;
    transform: translateX(-50%);
  }
  .mr-labels {
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #9A3412;
    font-weight: 700;
  }

  /* Section header */
  .section-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 0 12px;
  }
  .section-title {
    font-size: 11px;
    font-weight: 700;
    color: #BE185D;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .filter-pill {
    background: rgba(255,255,255,0.7);
    border: 0.5px solid #FBCFE8;
    color: #BE185D;
    padding: 4px 10px;
    border-radius: 9px;
    font-size: 10px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  /* Similar product cards */
  .similar-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 16px;
  }
  .sim-card {
    background: #FFFFFF;
    border-radius: 14px;
    padding: 12px;
    border: 0.5px solid #FED7AA;
    display: flex;
    gap: 12px;
    align-items: center;
    box-shadow: 0 4px 12px rgba(251,146,60,0.1);
  }
  .sim-thumb {
    width: 64px; height: 64px;
    background: linear-gradient(135deg, #FFEDD5, #FED7AA);
    border-radius: 12px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .sim-info { flex: 1; min-width: 0; }
  .sim-name {
    font-size: 12px;
    font-weight: 600;
    color: #831447;
    line-height: 1.3;
    margin-bottom: 4px;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .sim-meta {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 10px;
    font-weight: 500;
    color: #BE185D;
  }
  .sim-rating {
    display: flex;
    align-items: center;
    gap: 2px;
    color: #C2410C;
  }
  .sim-shop {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background: rgba(251,146,60,0.12);
    color: #C2410C;
    padding: 2px 6px;
    border-radius: 6px;
    font-size: 9px;
    font-weight: 700;
  }
  .sim-right { text-align: right; flex-shrink: 0; }
  .sim-price {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    font-weight: 700;
    color: #C2410C;
  }
  .sim-sold {
    font-size: 9px;
    color: #BE185D;
    font-weight: 600;
    margin-top: 2px;
  }
  .sim-card.highlighted {
    border-color: #E91E63;
    border-width: 1.5px;
    background: linear-gradient(135deg, #FFFFFF 0%, #FFF1F5 100%);
    box-shadow: 0 6px 14px rgba(233,30,99,0.15);
  }
  .sim-badge-yours {
    background: linear-gradient(135deg, #E91E63, #FB923C);
    color: #fff;
    padding: 3px 7px;
    border-radius: 7px;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    display: inline-block;
    margin-bottom: 4px;
  }

  /* Insight strip */
  .insight-strip {
    background: linear-gradient(135deg, #FFE4E6 0%, #FED7AA 100%);
    border: 0.5px solid rgba(190,24,93,0.2);
    border-radius: 14px;
    padding: 12px 14px;
    display: flex;
    gap: 10px;
    align-items: flex-start;
    margin-top: 8px;
  }
  .insight-icon {
    width: 30px; height: 30px;
    background: linear-gradient(135deg, #E91E63, #FB923C);
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .insight-text {
    font-size: 12px;
    color: #831447;
    font-weight: 500;
    line-height: 1.5;
    flex: 1;
  }
  .insight-text strong { color: #BE185D; font-weight: 700; }
"""
    body = top_bar("So sánh thị trường", "Maggi nước tương 200ml") + """
  <div class="main-scroll">

    <!-- Market hero card -->
    <div class="market-hero">
      <div class="mh-header">
        <div class="mh-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C2410C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9h18l-2 10H5L3 9z"/>
            <path d="M8 9V5a4 4 0 0 1 8 0v4"/>
          </svg>
        </div>
        <div>
          <div class="mh-title">Shopee · 5 cửa hàng tương tự</div>
          <div class="mh-sub">Cập nhật 15 phút trước · 1.247 đánh giá</div>
        </div>
      </div>

      <div class="mh-stats">
        <div class="mh-stat">
          <div class="mh-stat-label">Thấp nhất</div>
          <div class="mh-stat-value">22.000₫</div>
        </div>
        <div class="mh-stat">
          <div class="mh-stat-label">Trung bình</div>
          <div class="mh-stat-value">24.500₫</div>
        </div>
        <div class="mh-stat">
          <div class="mh-stat-label">Cao nhất</div>
          <div class="mh-stat-value">28.000₫</div>
        </div>
      </div>

      <div class="market-range">
        <div style="font-size:10px; font-weight:700; color:#9A3412; letter-spacing:0.5px; text-transform:uppercase;">Vị trí giá của bạn</div>
        <div class="mr-track">
          <div class="mr-avg"></div>
          <div class="mr-marker"></div>
        </div>
        <div class="mr-labels">
          <span>22K</span>
          <span style="color:#7C2D12;">TB 24.5K</span>
          <span>28K</span>
        </div>
      </div>
    </div>

    <!-- Similar list -->
    <div class="section-label">
      <span class="section-title">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#BE185D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="8" y1="6" x2="21" y2="6"/>
          <line x1="8" y1="12" x2="21" y2="12"/>
          <line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/>
          <line x1="3" y1="12" x2="3.01" y2="12"/>
          <line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
        5 sản phẩm tương tự
      </span>
      <div class="filter-pill">
        Sắp xếp: Giá
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
    </div>

    <div class="similar-grid">

      <div class="sim-card">
        <div class="sim-thumb">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C2410C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2v6.343c0 .53.21 1.04.586 1.414L18.414 13.586c.375.375.586.884.586 1.414V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5c0-.53.21-1.04.586-1.414L9.414 9.757A2 2 0 0 0 10 8.343V2"/>
          </svg>
        </div>
        <div class="sim-info">
          <div class="sim-name">Nước tương Maggi đậu nành nguyên chất 200ml</div>
          <div class="sim-meta">
            <span class="sim-rating">★ 4.9</span>
            <span class="sim-shop">Maggi Official</span>
          </div>
        </div>
        <div class="sim-right">
          <div class="sim-price">22.000₫</div>
          <div class="sim-sold">Đã bán 8.5k</div>
        </div>
      </div>

      <div class="sim-card">
        <div class="sim-thumb">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C2410C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2v6.343c0 .53.21 1.04.586 1.414L18.414 13.586c.375.375.586.884.586 1.414V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5c0-.53.21-1.04.586-1.414L9.414 9.757A2 2 0 0 0 10 8.343V2"/>
          </svg>
        </div>
        <div class="sim-info">
          <div class="sim-name">Maggi nước tương đậu nành chai 200ml</div>
          <div class="sim-meta">
            <span class="sim-rating">★ 4.7</span>
            <span class="sim-shop">SiêuThị Online</span>
          </div>
        </div>
        <div class="sim-right">
          <div class="sim-price">24.000₫</div>
          <div class="sim-sold">Đã bán 3.2k</div>
        </div>
      </div>

      <div class="sim-card highlighted">
        <div class="sim-thumb">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#E91E63" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2v6.343c0 .53.21 1.04.586 1.414L18.414 13.586c.375.375.586.884.586 1.414V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5c0-.53.21-1.04.586-1.414L9.414 9.757A2 2 0 0 0 10 8.343V2"/>
          </svg>
        </div>
        <div class="sim-info">
          <span class="sim-badge-yours">Giá của bạn</span>
          <div class="sim-name" style="color:#BE185D;">Maggi nước tương đậu nành 200ml (sản phẩm bạn nhập)</div>
          <div class="sim-meta">
            <span class="sim-rating">★ — </span>
            <span class="sim-shop" style="background:linear-gradient(135deg,#E91E63,#FB923C); color:#fff;">Cửa hàng của bạn</span>
          </div>
        </div>
        <div class="sim-right">
          <div class="sim-price" style="background:linear-gradient(135deg,#E91E63,#FB923C);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">25.000₫</div>
          <div class="sim-sold">Chưa bán</div>
        </div>
      </div>

      <div class="sim-card">
        <div class="sim-thumb">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C2410C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2v6.343c0 .53.21 1.04.586 1.414L18.414 13.586c.375.375.586.884.586 1.414V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5c0-.53.21-1.04.586-1.414L9.414 9.757A2 2 0 0 0 10 8.343V2"/>
          </svg>
        </div>
        <div class="sim-info">
          <div class="sim-name">Nước tương Maggi cao cấp 200ml + tặng kèm</div>
          <div class="sim-meta">
            <span class="sim-rating">★ 4.8</span>
            <span class="sim-shop">Premium Store</span>
          </div>
        </div>
        <div class="sim-right">
          <div class="sim-price">26.000₫</div>
          <div class="sim-sold">Đã bán 1.5k</div>
        </div>
      </div>

      <div class="sim-card">
        <div class="sim-thumb">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C2410C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2v6.343c0 .53.21 1.04.586 1.414L18.414 13.586c.375.375.586.884.586 1.414V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5c0-.53.21-1.04.586-1.414L9.414 9.757A2 2 0 0 0 10 8.343V2"/>
          </svg>
        </div>
        <div class="sim-info">
          <div class="sim-name">Maggi nước tương đậu nành 200ml combo 3 chai</div>
          <div class="sim-meta">
            <span class="sim-rating">★ 5.0</span>
            <span class="sim-shop">Vinmart+</span>
          </div>
        </div>
        <div class="sim-right">
          <div class="sim-price">28.000₫</div>
          <div class="sim-sold">Đã bán 920</div>
        </div>
      </div>

    </div>

    <!-- AI reasoning -->
    <div class="insight-strip">
      <div class="insight-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L9.5 8.5 2 9 7 14 5.5 22 12 18 18.5 22 17 14 22 9 14.5 8.5z"/>
        </svg>
      </div>
      <div class="insight-text">
        Giá <strong>25.000₫</strong> đặt bạn ở vị trí <strong>top 3/5</strong>. Cân nhắc đặt <strong>26.500₫</strong> để bằng top 2 nhưng vẫn cạnh tranh.
      </div>
    </div>

  </div>
"""
    return page_shell("Intent 01 — State D — Shopee Expanded", head, body)


# ============================================================================
# STATE H — Market Trend Expanded (Google Trends)
# ============================================================================

def build_state_H():
    head = """
  .main-scroll { flex: 1; overflow-y: auto; padding: 8px 18px 150px; }

  /* Hero: big delta number */
  .trend-hero {
    background: linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 50%, #10B981 100%);
    border-radius: 20px;
    padding: 22px 18px 18px;
    margin-bottom: 18px;
    position: relative;
    overflow: hidden;
    box-shadow: 0 8px 22px rgba(16,185,129,0.22);
  }
  .trend-hero::before {
    content: '';
    position: absolute;
    top: -40px; right: -40px;
    width: 140px; height: 140px;
    background: radial-gradient(circle, rgba(255,255,255,0.45) 0%, transparent 70%);
    border-radius: 50%;
  }
  .th-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: rgba(255,255,255,0.85);
    color: #065F46;
    padding: 4px 9px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    position: relative;
    z-index: 1;
  }
  .th-delta {
    font-family: 'JetBrains Mono', monospace;
    font-size: 56px;
    font-weight: 700;
    color: #065F46;
    line-height: 1;
    letter-spacing: -2px;
    margin: 12px 0 6px;
    text-shadow: 0 2px 0 rgba(255,255,255,0.4);
    position: relative;
    z-index: 1;
  }
  .th-headline {
    font-size: 14px;
    color: #065F46;
    font-weight: 700;
    margin-bottom: 14px;
    position: relative;
    z-index: 1;
  }
  .th-spark-box {
    background: rgba(255,255,255,0.9);
    border-radius: 14px;
    padding: 12px 14px;
    position: relative;
    z-index: 1;
  }
  .th-spark-svg {
    width: 100%;
    height: 64px;
    display: block;
  }
  .th-spark-axis {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: #047857;
    font-weight: 600;
  }

  /* 3 stat cells */
  .stats-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
    margin-bottom: 18px;
  }
  .stat-cell {
    background: #FFFFFF;
    border: 0.5px solid #A7F3D0;
    border-radius: 14px;
    padding: 12px 8px;
    text-align: center;
    box-shadow: 0 4px 10px rgba(16,185,129,0.08);
  }
  .stat-label {
    font-size: 9px;
    color: #047857;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .stat-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 18px;
    font-weight: 700;
    color: #065F46;
  }
  .stat-value.now {
    background: linear-gradient(135deg, #10B981, #059669);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .stat-sub {
    font-size: 9px;
    color: #047857;
    font-weight: 500;
    margin-top: 2px;
  }

  /* Section header reuse */
  .section-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 0 12px;
  }
  .section-title {
    font-size: 11px;
    font-weight: 700;
    color: #065F46;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .section-hint {
    font-size: 10px;
    color: #047857;
    font-weight: 500;
  }

  /* Related rising chips */
  .chips-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 18px;
  }
  .chip-rising {
    background: #FFFFFF;
    border: 0.5px solid #A7F3D0;
    color: #065F46;
    padding: 7px 12px;
    border-radius: 11px;
    font-size: 12px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    box-shadow: 0 2px 6px rgba(16,185,129,0.08);
  }
  .chip-arrow {
    color: #10B981;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
  }
  .chip-rising .chip-pct {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #047857;
    font-weight: 700;
    background: rgba(16,185,129,0.12);
    padding: 1px 5px;
    border-radius: 5px;
  }

  /* AI reasoning strip */
  .ai-reasoning {
    background: linear-gradient(135deg, #FFFFFF 0%, #ECFDF5 100%);
    border: 0.5px solid #A7F3D0;
    border-left: 3px solid #10B981;
    border-radius: 14px;
    padding: 14px;
    margin-bottom: 18px;
    box-shadow: 0 4px 12px rgba(16,185,129,0.1);
  }
  .ai-reasoning-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .ai-reasoning-avatar {
    width: 26px; height: 26px;
    border-radius: 50%;
    background: linear-gradient(135deg, #10B981, #059669);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .ai-reasoning-tag {
    font-size: 9px;
    font-weight: 700;
    color: #065F46;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }
  .ai-reasoning-body {
    font-size: 12px;
    color: #065F46;
    line-height: 1.55;
    font-weight: 500;
  }
  .ai-reasoning-body strong { color: #047857; font-weight: 700; }

  /* Bottom bar */
  .bottom-bar {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    z-index: 10;
    background: #FFF8F0;
    box-shadow: 0 -8px 16px rgba(255,248,240,0.95), 0 -16px 24px rgba(255,248,240,0.6);
    padding: 16px 18px 20px;
  }
  .btn-back-form {
    width: 100%;
    background: linear-gradient(135deg, #10B981 0%, #059669 100%);
    color: #fff;
    border-radius: 14px;
    font-size: 14px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 10px 22px rgba(16,185,129,0.3);
    height: 52px;
    letter-spacing: -0.2px;
  }

  .meta-fresh {
    text-align: center;
    font-size: 10px;
    color: #047857;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    margin-top: 10px;
    margin-bottom: 6px;
  }
"""
    body = top_bar("Nhu cầu thị trường", "Google Trends · Maggi nước tương 200ml", action_label=None) + """
  <div class="main-scroll">

    <!-- Hero: big delta -->
    <div class="trend-hero">
      <span class="th-tag">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
          <polyline points="17 6 23 6 23 12"/>
        </svg>
        Đang tăng mạnh
      </span>
      <div class="th-delta">↑34%</div>
      <div class="th-headline">90 ngày qua, từ khóa "nước tương Maggi" tăng đều</div>

      <div class="th-spark-box">
        <svg class="th-spark-svg" viewBox="0 0 320 64" preserveAspectRatio="none">
          <defs>
            <linearGradient id="sparkBig" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#10B981" stop-opacity="0.4"/>
              <stop offset="100%" stop-color="#10B981" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <!-- horizontal grid lines -->
          <line x1="0" y1="16" x2="320" y2="16" stroke="#A7F3D0" stroke-width="0.5" stroke-dasharray="2,3"/>
          <line x1="0" y1="32" x2="320" y2="32" stroke="#A7F3D0" stroke-width="0.5" stroke-dasharray="2,3"/>
          <line x1="0" y1="48" x2="320" y2="48" stroke="#A7F3D0" stroke-width="0.5" stroke-dasharray="2,3"/>
          <!-- area + line -->
          <path d="M0,50 L20,48 L40,49 L60,46 L80,45 L100,43 L120,40 L140,38 L160,34 L180,30 L200,26 L220,22 L240,18 L260,14 L280,10 L300,8 L320,6 L320,64 L0,64 Z" fill="url(#sparkBig)"/>
          <path d="M0,50 L20,48 L40,49 L60,46 L80,45 L100,43 L120,40 L140,38 L160,34 L180,30 L200,26 L220,22 L240,18 L260,14 L280,10 L300,8 L320,6" stroke="#10B981" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <!-- last point -->
          <circle cx="320" cy="6" r="3.5" fill="#fff" stroke="#10B981" stroke-width="2.2"/>
        </svg>
        <div class="th-spark-axis">
          <span>3 tháng trước</span>
          <span>2 tháng</span>
          <span>1 tháng</span>
          <span style="color:#10B981;">Hôm nay</span>
        </div>
      </div>
    </div>

    <!-- 3 stat cells -->
    <div class="stats-row">
      <div class="stat-cell">
        <div class="stat-label">Hiện tại</div>
        <div class="stat-value now">78</div>
        <div class="stat-sub">/ 100</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Đỉnh 90d</div>
        <div class="stat-value">95</div>
        <div class="stat-sub">tuần trước</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Đáy 90d</div>
        <div class="stat-value">42</div>
        <div class="stat-sub">3 tháng trước</div>
      </div>
    </div>

    <!-- Related rising chips -->
    <div class="section-label">
      <span class="section-title">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#065F46" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
          <polyline points="17 6 23 6 23 12"/>
        </svg>
        Từ khoá đang lên
      </span>
      <span class="section-hint">Tap để thêm vào sản phẩm</span>
    </div>

    <div class="chips-grid">
      <span class="chip-rising">
        <span class="chip-arrow">↑</span>
        không đường
        <span class="chip-pct">+120%</span>
      </span>
      <span class="chip-rising">
        <span class="chip-arrow">↑</span>
        ít muối
        <span class="chip-pct">+85%</span>
      </span>
      <span class="chip-rising">
        <span class="chip-arrow">↑</span>
        hữu cơ
        <span class="chip-pct">+62%</span>
      </span>
      <span class="chip-rising">
        <span class="chip-arrow">↑</span>
        thuần chay
        <span class="chip-pct">+48%</span>
      </span>
      <span class="chip-rising">
        <span class="chip-arrow">↑</span>
        Nhật Bản
        <span class="chip-pct">+33%</span>
      </span>
    </div>

    <!-- AI reasoning -->
    <div class="ai-reasoning">
      <div class="ai-reasoning-head">
        <div class="ai-reasoning-avatar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L9.5 8.5 2 9 7 14 5.5 22 12 18 18.5 22 17 14 22 9 14.5 8.5z"/>
          </svg>
        </div>
        <span class="ai-reasoning-tag">🤖 Aida nhận định</span>
      </div>
      <div class="ai-reasoning-body">
        Trên thị trường Việt Nam, từ khóa <strong>"nước tương Maggi"</strong> tăng <strong>34% trong 90 ngày</strong>. Đặc biệt biến thể <strong>"không đường"</strong> và <strong>"ít muối"</strong> đang được tìm nhiều hơn 2x so với cùng kỳ. Đề xuất: tăng lượng nhập + thêm thuộc tính sức khoẻ vào mô tả sản phẩm để bắt sóng.
      </div>
    </div>

    <div class="meta-fresh">Cập nhật 5 phút trước · Google Trends VN</div>
  </div>

  <div class="bottom-bar">
    <button class="btn-back-form">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"/>
        <polyline points="12 19 5 12 12 5"/>
      </svg>
      Quay lại form
    </button>
  </div>
"""
    return page_shell("Intent 01 — State H — Market Trend Expanded", head, body)


# ============================================================================
# STATE E — Blur error
# ============================================================================

def build_state_E():
    head = """
  .err-content {
    flex: 1;
    padding: 20px 22px 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow-y: auto;
  }
  .blurry-preview {
    width: 220px;
    height: 220px;
    border-radius: 24px;
    background: linear-gradient(135deg, #FCE7F3 0%, #FECDD3 50%, #FED7AA 100%);
    margin-top: 12px;
    position: relative;
    overflow: hidden;
    border: 3px solid #fff;
    box-shadow: 0 12px 28px rgba(233,30,99,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    filter: blur(2px);
  }
  .blurry-content {
    text-align: center;
    color: rgba(190,24,93,0.5);
  }
  .err-overlay {
    position: absolute;
    inset: -3px;
    border-radius: 24px;
    border: 3px dashed rgba(220,38,38,0.6);
    pointer-events: none;
  }
  .err-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    background: linear-gradient(135deg, #DC2626, #991B1B);
    color: #fff;
    padding: 5px 11px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    box-shadow: 0 4px 10px rgba(220,38,38,0.4);
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .err-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(220,38,38,0.1);
    color: #DC2626;
    padding: 6px 13px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
    margin-top: 22px;
    text-transform: uppercase;
    border: 0.5px solid rgba(220,38,38,0.3);
  }
  .err-title {
    font-size: 22px;
    font-weight: 700;
    color: #831447;
    text-align: center;
    margin-top: 14px;
    letter-spacing: -0.5px;
    line-height: 1.25;
  }
  .err-sub {
    font-size: 13px;
    color: #BE185D;
    text-align: center;
    margin-top: 8px;
    font-weight: 500;
    line-height: 1.5;
    max-width: 300px;
  }
  .err-reasons {
    width: 100%;
    margin-top: 24px;
    background: #FFFFFF;
    border-radius: 16px;
    padding: 16px;
    border: 0.5px solid #FBCFE8;
    box-shadow: 0 4px 12px rgba(233,30,99,0.08);
  }
  .err-reasons-title {
    font-size: 11px;
    font-weight: 700;
    color: #BE185D;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .reason-row {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 8px 0;
  }
  .reason-row + .reason-row {
    border-top: 0.5px solid #FCE7F3;
  }
  .reason-icon {
    width: 28px; height: 28px;
    background: linear-gradient(135deg, #FEF3C7, #FCD34D);
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .reason-text {
    font-size: 12px;
    color: #831447;
    line-height: 1.5;
    font-weight: 500;
    flex: 1;
  }
  .reason-text strong { color: #BE185D; font-weight: 700; }
  .err-ctas {
    width: 100%;
    margin-top: 22px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .btn-primary {
    width: 100%;
    background: linear-gradient(135deg, #E91E63 0%, #F43F5E 50%, #FB923C 100%);
    color: #fff;
    padding: 16px 20px;
    border-radius: 16px;
    font-size: 15px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    box-shadow: 0 10px 22px rgba(233,30,99,0.35);
    letter-spacing: -0.2px;
  }
  .btn-secondary {
    width: 100%;
    background: #FFFFFF;
    color: #BE185D;
    padding: 14px 20px;
    border-radius: 16px;
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    border: 0.5px solid #FBCFE8;
  }
  .err-code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #9F1239;
    background: rgba(220,38,38,0.08);
    padding: 6px 10px;
    border-radius: 8px;
    margin-top: 14px;
    border: 0.5px solid rgba(220,38,38,0.2);
  }
"""
    body = top_bar("Không nhận diện được", "Aida cần ảnh rõ hơn") + """
  <div class="err-content">

    <div class="blurry-preview">
      <div class="err-badge">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Ảnh mờ
      </div>
      <div class="err-overlay"></div>
      <div class="blurry-content">
        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2v6.343c0 .53.21 1.04.586 1.414L18.414 13.586c.375.375.586.884.586 1.414V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5c0-.53.21-1.04.586-1.414L9.414 9.757A2 2 0 0 0 10 8.343V2"/>
          <line x1="9" y1="2" x2="15" y2="2"/>
        </svg>
        <div style="font-size:11px; margin-top:8px; font-weight:600;">IMG_20260517_094555.jpg</div>
      </div>
    </div>

    <div class="err-label">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
      </svg>
      Vision Quality Low
    </div>

    <h1 class="err-title">Aida chưa đọc<br>được nhãn sản phẩm</h1>
    <p class="err-sub">
      Ảnh hơi mờ hoặc thiếu ánh sáng. Hãy chụp lại theo gợi ý dưới đây.
    </p>

    <div class="err-reasons">
      <div class="err-reasons-title">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18h6"/>
          <path d="M10 22h4"/>
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
        </svg>
        Mẹo chụp lại
      </div>

      <div class="reason-row">
        <div class="reason-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B45309" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          </svg>
        </div>
        <div class="reason-text">
          Chụp ở chỗ <strong>sáng hơn</strong> — gần cửa sổ hoặc bật đèn trần
        </div>
      </div>

      <div class="reason-row">
        <div class="reason-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B45309" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18h6"/>
            <path d="M11 21h2"/>
            <circle cx="12" cy="9" r="6"/>
          </svg>
        </div>
        <div class="reason-text">
          Giữ điện thoại <strong>cách 20-30cm</strong>, đợi tự động lấy nét rồi mới chụp
        </div>
      </div>

      <div class="reason-row">
        <div class="reason-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B45309" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
          </svg>
        </div>
        <div class="reason-text">
          Đặt sản phẩm <strong>thẳng đứng</strong>, nhãn quay thẳng về camera
        </div>
      </div>
    </div>

    <div class="err-ctas">
      <button class="btn-primary">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
          <path d="M21 3v5h-5"/>
        </svg>
        Chụp lại ngay
      </button>
      <button class="btn-secondary">
        Nhập thông tin thủ công
      </button>
    </div>

    <div class="err-code">
      E_VISION_BLUR · trace: a3f2c89...d4e1
    </div>

  </div>
"""
    return page_shell("Intent 01 — State E — Blur Error", head, body)


# ============================================================================
# STATE F — Low confidence
# ============================================================================

def build_state_F():
    head = """
  .main-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 8px 18px 100px;
  }

  /* Warning banner */
  .warning-banner {
    background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
    border: 0.5px solid #FCD34D;
    border-radius: 14px;
    padding: 12px 14px;
    display: flex;
    gap: 10px;
    align-items: flex-start;
    margin-bottom: 16px;
  }
  .warning-icon {
    width: 32px; height: 32px;
    background: linear-gradient(135deg, #F59E0B, #D97706);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 3px 8px rgba(217,119,6,0.3);
  }
  .warning-content { flex: 1; }
  .warning-title {
    font-size: 12px;
    font-weight: 700;
    color: #92400E;
    margin-bottom: 3px;
  }
  .warning-text {
    font-size: 11px;
    color: #78350F;
    line-height: 1.5;
    font-weight: 500;
  }
  .warning-text strong { color: #92400E; font-weight: 700; }

  /* Section */
  .section-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 18px 0 10px;
  }
  .section-title {
    font-size: 11px;
    font-weight: 700;
    color: #BE185D;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Form card */
  .form-card {
    background: #FFFFFF;
    border-radius: 18px;
    padding: 16px;
    border: 0.5px solid #FBCFE8;
    box-shadow: 0 6px 16px rgba(233,30,99,0.08);
    margin-bottom: 16px;
  }
  .field { margin-bottom: 14px; }
  .field:last-child { margin-bottom: 0; }
  .field-label {
    font-size: 11px;
    color: #BE185D;
    font-weight: 600;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .field-label .required { color: #E91E63; }
  .field-confidence {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 9px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 6px;
    letter-spacing: 0.3px;
  }
  .conf-high { background: rgba(34,197,94,0.12); color: #15803D; }
  .conf-high .dot { background: #22C55E; }
  .conf-low { background: rgba(245,158,11,0.15); color: #92400E; }
  .conf-low .dot { background: #F59E0B; }
  .field-confidence .dot { width: 5px; height: 5px; border-radius: 50%; }

  .field-input {
    width: 100%;
    background: linear-gradient(135deg, #FFFFFF 0%, #FEF7F9 100%);
    border: 0.5px solid #FBCFE8;
    border-radius: 11px;
    padding: 11px 13px;
    font-size: 13px;
    color: #831447;
    font-weight: 500;
  }
  .field-input.has-ai {
    background: linear-gradient(135deg, #FFF1F5 0%, #FEEEE0 100%);
    border-color: #F9A8D4;
  }
  .field-input.uncertain {
    background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
    border: 1.5px solid #F59E0B;
    color: #92400E;
  }
  .field-input.empty {
    background: #FFFFFF;
    border: 1.5px dashed #E91E63;
    color: #BE185D;
  }
  .field-hint {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 5px;
    font-size: 10px;
    font-weight: 600;
  }
  .field-hint.warning { color: #B45309; }
  .field-hint.error { color: #E11D48; }

  .field-row {
    display: flex;
    gap: 10px;
  }
  .field-row .field { flex: 1; margin-bottom: 14px; }

  .alt-suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }
  .alt-chip {
    background: rgba(255,255,255,0.7);
    border: 0.5px solid #F59E0B;
    color: #92400E;
    padding: 5px 10px;
    border-radius: 9px;
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .image-card {
    background: #FFFFFF;
    border-radius: 16px;
    padding: 12px;
    border: 0.5px solid #FBCFE8;
    box-shadow: 0 4px 12px rgba(233,30,99,0.08);
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 14px;
  }
  .image-thumb {
    width: 64px; height: 64px;
    border-radius: 12px;
    background: linear-gradient(135deg, #FEF3C7, #FDE68A);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .image-info { flex: 1; min-width: 0; }
  .image-status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: linear-gradient(135deg, #FEF3C7, #FCD34D);
    color: #92400E;
    padding: 3px 8px;
    border-radius: 8px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    margin-bottom: 5px;
  }
  .image-title {
    font-size: 12px;
    color: #831447;
    font-weight: 600;
    line-height: 1.3;
  }
  .image-meta {
    font-size: 10px;
    color: #BE185D;
    font-weight: 500;
    margin-top: 2px;
    font-family: 'JetBrains Mono', monospace;
  }
  .retake-btn {
    background: linear-gradient(135deg, #F59E0B, #D97706);
    color: #fff;
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 5px;
    box-shadow: 0 3px 8px rgba(217,119,6,0.3);
    flex-shrink: 0;
  }

  /* Bottom bar */
  .bottom-bar {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    z-index: 10;
    background: #FFF8F0;
    box-shadow: 0 -8px 16px rgba(255,248,240,0.95), 0 -16px 24px rgba(255,248,240,0.6);
    padding: 16px 18px 20px;
    display: flex;
    gap: 10px;
  }
  .btn-commit {
    flex: 1;
    background: linear-gradient(135deg, #E91E63 0%, #F43F5E 50%, #FB923C 100%);
    color: #fff;
    border-radius: 14px;
    font-size: 14px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 10px 22px rgba(233,30,99,0.35);
    height: 52px;
  }
  .btn-commit:disabled, .btn-commit.disabled {
    opacity: 0.5;
    box-shadow: none;
  }
"""
    body = top_bar("Kiểm tra giúp Aida", "3 trường cần xác nhận", with_progress=True, progress_pct=42, progress_text="5 / 12 trường") + """
  <div class="main-scroll">

    <!-- Image preview -->
    <div class="image-card">
      <div class="image-thumb">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#B45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2v6.343c0 .53.21 1.04.586 1.414L18.414 13.586c.375.375.586.884.586 1.414V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5c0-.53.21-1.04.586-1.414L9.414 9.757A2 2 0 0 0 10 8.343V2"/>
        </svg>
      </div>
      <div class="image-info">
        <span class="image-status">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
          </svg>
          ĐỘ TIN CẬY THẤP
        </span>
        <div class="image-title">Nhãn bị che một phần</div>
        <div class="image-meta">Đọc được 60% nội dung</div>
      </div>
      <button class="retake-btn">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
          <path d="M21 3v5h-5"/>
        </svg>
        Chụp lại
      </button>
    </div>

    <!-- Warning banner -->
    <div class="warning-banner">
      <div class="warning-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <div class="warning-content">
        <div class="warning-title">Aida đoán chưa chắc chắn</div>
        <div class="warning-text">
          Một số trường có <strong>độ tin cậy thấp</strong> (viền vàng). Vui lòng kiểm tra hoặc <strong>chụp lại ảnh rõ hơn</strong>.
        </div>
      </div>
    </div>

    <!-- Form -->
    <div class="section-label">
      <span class="section-title">Thông tin sản phẩm</span>
    </div>

    <div class="form-card">
      <div class="field">
        <div class="field-label">
          Tên sản phẩm <span class="required">*</span>
          <span class="field-confidence conf-low"><span class="dot"></span>54%</span>
        </div>
        <input class="field-input uncertain" value="Nước tương hạt 200ml?" />
        <div class="field-hint warning">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
          </svg>
          Aida không chắc — gợi ý khác:
        </div>
        <div class="alt-suggestions">
          <button class="alt-chip">Maggi nước tương 200ml</button>
          <button class="alt-chip">Nước tương đậu nành 200ml</button>
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <div class="field-label">
            Nhãn hiệu
            <span class="field-confidence conf-low"><span class="dot"></span>32%</span>
          </div>
          <input class="field-input empty" placeholder="Aida không đọc được" />
          <div class="field-hint error">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Cần điền thủ công
          </div>
        </div>
        <div class="field">
          <div class="field-label">
            Danh mục
            <span class="field-confidence conf-high"><span class="dot"></span>91%</span>
          </div>
          <input class="field-input has-ai" value="Nước tương" />
        </div>
      </div>

      <div class="field">
        <div class="field-label">
          Dung tích / Trọng lượng
          <span class="field-confidence conf-low"><span class="dot"></span>48%</span>
        </div>
        <input class="field-input uncertain" value="200ml hoặc 250ml" />
        <div class="field-hint warning">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
          </svg>
          Hãy chọn chính xác:
        </div>
        <div class="alt-suggestions">
          <button class="alt-chip">200ml</button>
          <button class="alt-chip">250ml</button>
          <button class="alt-chip">300ml</button>
        </div>
      </div>
    </div>

  </div>

  <div class="bottom-bar">
    <button class="btn-commit disabled">
      Sửa xong 3 trường để lưu
    </button>
  </div>
"""
    return page_shell("Intent 01 — State F — Low Confidence", head, body)


# ============================================================================
# STATE G — Success
# ============================================================================

def build_state_G():
    head = """
  .success-content {
    flex: 1;
    padding: 20px 22px 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow-y: auto;
  }
  .success-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, #DCFCE7, #BBF7D0);
    color: #15803D;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2px;
    margin-top: 18px;
    text-transform: uppercase;
    border: 0.5px solid #BBF7D0;
  }
  .success-label .dot {
    width: 6px; height: 6px;
    background: #10B981;
    border-radius: 50%;
  }
  .success-title {
    font-size: 26px;
    font-weight: 700;
    color: #831447;
    text-align: center;
    margin-top: 14px;
    letter-spacing: -0.5px;
    line-height: 1.2;
  }
  .success-title strong {
    background: linear-gradient(135deg, #E91E63, #FB923C);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    font-weight: 700;
  }
  .success-sub {
    font-size: 13px;
    color: #BE185D;
    text-align: center;
    margin-top: 8px;
    font-weight: 500;
  }
  /* Product preview card */
  .product-preview {
    width: 100%;
    margin-top: 24px;
    background: #FFFFFF;
    border-radius: 20px;
    padding: 14px;
    border: 0.5px solid #FBCFE8;
    box-shadow: 0 10px 28px rgba(233,30,99,0.15);
    position: relative;
    overflow: hidden;
    animation: slideUp 0.6s ease-out 0.3s backwards;
  }
  .product-preview::before {
    content: '';
    position: absolute;
    top: -30px; right: -30px;
    width: 120px; height: 120px;
    background: radial-gradient(circle, rgba(251,146,60,0.15) 0%, transparent 70%);
    border-radius: 50%;
  }
  .pp-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: linear-gradient(135deg, #10B981, #059669);
    color: #fff;
    padding: 4px 10px;
    border-radius: 8px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-bottom: 10px;
    box-shadow: 0 3px 8px rgba(16,185,129,0.3);
  }
  .pp-row {
    display: flex;
    gap: 14px;
    align-items: center;
  }
  .pp-thumb {
    width: 84px; height: 84px;
    border-radius: 16px;
    background: linear-gradient(135deg, #FFE4E6, #FECDD3 50%, #FED7AA);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #fff;
    box-shadow: 0 6px 14px rgba(233,30,99,0.15);
  }
  .pp-thumb-icon {
    background: linear-gradient(135deg, #F43F5E, #E11D48);
    width: 42px; height: 42px;
    border-radius: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 10px rgba(244,63,94,0.4);
  }
  .pp-info { flex: 1; }
  .pp-title {
    font-size: 14px;
    font-weight: 700;
    color: #831447;
    line-height: 1.3;
    margin-bottom: 6px;
  }
  .pp-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 8px;
  }
  .pp-chip {
    font-size: 10px;
    font-weight: 600;
    background: #FCE7F3;
    color: #BE185D;
    padding: 3px 7px;
    border-radius: 6px;
  }
  .pp-price {
    font-family: 'JetBrains Mono', monospace;
    font-size: 18px;
    font-weight: 700;
    background: linear-gradient(135deg, #FB923C, #EA580C);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  /* Stats grid */
  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    margin-top: 18px;
    width: 100%;
    animation: slideUp 0.6s ease-out 0.5s backwards;
  }
  .stat-cell {
    background: rgba(255,255,255,0.7);
    border: 0.5px solid #FBCFE8;
    border-radius: 12px;
    padding: 10px 8px;
    text-align: center;
    backdrop-filter: blur(8px);
  }
  .stat-cell-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 16px;
    font-weight: 700;
    background: linear-gradient(135deg, #E91E63, #FB923C);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .stat-cell-label {
    font-size: 9px;
    color: #BE185D;
    font-weight: 600;
    margin-top: 3px;
    letter-spacing: 0.3px;
  }
  /* CTAs */
  .ctas {
    width: 100%;
    margin-top: 28px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: slideUp 0.6s ease-out 0.7s backwards;
  }
  .btn-primary {
    width: 100%;
    background: linear-gradient(135deg, #E91E63 0%, #F43F5E 50%, #FB923C 100%);
    color: #fff;
    padding: 16px 20px;
    border-radius: 16px;
    font-size: 15px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    box-shadow: 0 10px 22px rgba(233,30,99,0.35);
    letter-spacing: -0.2px;
  }
  .btn-secondary {
    width: 100%;
    background: #FFFFFF;
    color: #BE185D;
    padding: 14px 20px;
    border-radius: 16px;
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    border: 0.5px solid #FBCFE8;
  }
  .success-id {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #BE185D;
    margin-top: 14px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
  }
  .success-id .dot {
    width: 6px; height: 6px;
    background: #10B981;
    border-radius: 50%;
    animation: glow 1.6s ease-in-out infinite;
  }
"""
    body = f"""
  <div style="padding: 4px 18px 0; flex-shrink: 0;">
    <div style="display:flex; align-items:center; justify-content:flex-end;">
      <button style="font-size:12px; color:#BE185D; font-weight:600; padding:8px 14px; background:rgba(255,255,255,0.7); border-radius:12px; border:0.5px solid #FBCFE8; display:flex; align-items:center; gap:5px;">
        Đóng
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  </div>
  <div class="success-content">

    {brain_svg(140, with_check=True)}

    <div class="success-label">
      <span class="dot pulse-dot"></span>
      Đã lưu sản phẩm
    </div>

    <h1 class="success-title">Sản phẩm đã có<br>trong <strong>cửa hàng của bạn</strong></h1>
    <p class="success-sub">Aida đã đăng lên trang chính · sẵn sàng bán</p>

    <!-- Product preview -->
    <div class="product-preview">
      <span class="pp-tag">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        SẢN PHẨM MỚI
      </span>
      <div class="pp-row">
        <div class="pp-thumb">
          <div class="pp-thumb-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2v6.343c0 .53.21 1.04.586 1.414L18.414 13.586c.375.375.586.884.586 1.414V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5c0-.53.21-1.04.586-1.414L9.414 9.757A2 2 0 0 0 10 8.343V2"/>
              <line x1="9" y1="2" x2="15" y2="2"/>
            </svg>
          </div>
        </div>
        <div class="pp-info">
          <div class="pp-title">Maggi nước tương đậu nành 200ml</div>
          <div class="pp-meta">
            <span class="pp-chip">200ml</span>
            <span class="pp-chip">Maggi</span>
            <span class="pp-chip">Tồn 50</span>
          </div>
          <div class="pp-price">25.000₫</div>
        </div>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-cell">
        <div class="stat-cell-value">12</div>
        <div class="stat-cell-label">TRƯỜNG ĐIỀN</div>
      </div>
      <div class="stat-cell">
        <div class="stat-cell-value">3.2s</div>
        <div class="stat-cell-label">THỜI GIAN</div>
      </div>
      <div class="stat-cell">
        <div class="stat-cell-value">98%</div>
        <div class="stat-cell-label">ĐỘ CHÍNH XÁC</div>
      </div>
    </div>

    <!-- CTAs -->
    <div class="ctas">
      <button class="btn-primary">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Nhập sản phẩm tiếp theo
      </button>
      <button class="btn-secondary">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11l2 2m-2-2v10a1 1 0 0 1-1 1h-3m-6 0a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1m-6 0h6"/>
        </svg>
        Về trang chính
      </button>
    </div>

    <div class="success-id">
      <span class="dot"></span>
      ID: prd_8b4f...a12 · 9:41 hôm nay
    </div>

  </div>
"""
    return page_shell("Intent 01 — State G — Success", head, body)


# ============================================================================
# WRITE FILES
# ============================================================================

builders = {
    "intent-01-state-A-analyzing.html": build_state_A,
    "intent-01-state-C-suggestions-rising.html": lambda: build_state_C("rising"),
    "intent-01-state-C-suggestions-falling.html": lambda: build_state_C("falling"),
    "intent-01-state-D-shopee-expanded.html": build_state_D,
    "intent-01-state-E-blur-error.html": build_state_E,
    "intent-01-state-F-low-confidence.html": build_state_F,
    "intent-01-state-G-success.html": build_state_G,
    "intent-01-state-H-trend-expanded.html": build_state_H,
}

if __name__ == "__main__":
    for fname, fn in builders.items():
        path = OUT / fname
        path.write_text(fn(), encoding="utf-8")
        size = path.stat().st_size
        print(f"  ✓ {fname}  ({size:,} bytes)")
    print(f"\nBuilt {len(builders)} states.")
