"""
Intent 02 — Buy Products by Voice · Mockup Builder
Generates 6 remaining states from shared template functions.
Run: python3 build_intent_02.py

Outputs:
  intent-02-state-A-listening.html        (Orb pulsing waveform, timer, cancel)
  intent-02-state-B-transcribing.html     (Live transcription streaming + parsing phases)
  intent-02-state-D-clarify.html          (Ambiguous item → inline chip options)
  intent-02-state-E-cart-added.html       (Success toast + cart bump + co-purchase)
  intent-02-state-F-no-match.html         (No match → 2 alt products + retry CTA)
  intent-02-state-G-error.html            (E_TRANSCRIBE_FAILED + retry + typing fallback)
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
    align-items: flex-start;
    justify-content: center;
    padding: 24px 14px;
    color: #831447;
  }
  .phone-frame {
    width: 100%;
    max-width: 414px;
    height: 844px;
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
    .phone-frame { box-shadow: 0 32px 80px rgba(233,30,99,0.24); }
  }
  button { font-family: inherit; cursor: pointer; border: none; }
  input { font-family: inherit; outline: none; }

  @keyframes pop { 0%{transform:scale(0.96); opacity:0} 100%{transform:scale(1); opacity:1} }
  @keyframes glow { 0%,100%{opacity:0.7; transform:scale(1)} 50%{opacity:1; transform:scale(1.05)} }
  @keyframes glow-strong { 0%,100%{opacity:0.6; transform:scale(1)} 50%{opacity:1; transform:scale(1.08)} }
  @keyframes pulseRing { 0%{transform:scale(0.85); opacity:0.7} 100%{transform:scale(1.8); opacity:0} }
  @keyframes pulseRingBig { 0%{transform:scale(0.85); opacity:0.5} 100%{transform:scale(2.2); opacity:0} }
  @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  @keyframes spin { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }
  @keyframes slideUp { 0%{transform:translateY(20px); opacity:0} 100%{transform:translateY(0); opacity:1} }
  @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
  @keyframes elastic-pop { 0%{transform:scale(0); opacity:0} 60%{transform:scale(1.2)} 100%{transform:scale(1); opacity:1} }
  @keyframes bump { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
  @keyframes orbBreathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
  @keyframes cursor { 0%,49%{opacity:1} 50%,100%{opacity:0} }
  .pulse-dot { animation: glow 1.6s ease-in-out infinite; }
  .pulse-ring { animation: pulseRing 2.4s ease-out infinite; }
  .spinner { animation: spin 1s linear infinite; }

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


def top_bar(title, subtitle=None, action_html=None):
    sub = f'<div style="font-size:11px; color:#BE185D; font-weight:500; margin-top:1px;">{subtitle}</div>' if subtitle else ""
    action = action_html or ""
    return f"""
    <div style="padding: 4px 18px 12px; display:flex; align-items:center; gap:12px; flex-shrink: 0;">
      <button style="width:36px; height:36px; background:#FFFFFF; border:0.5px solid #FBCFE8; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(233,30,99,0.1);">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#BE185D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <div style="flex:1;">
        <div style="font-size:16px; font-weight:700; color:#831447; letter-spacing:-0.3px;">{title}</div>
        {sub}
      </div>
      {action}
    </div>
    """


def avatar_aida(visible=True):
    vis = "" if visible else "visibility:hidden;"
    return f"""
    <div style="width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg, #E91E63, #FB923C); display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 3px 8px rgba(233,30,99,0.3); {vis}">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L9.5 8.5 2 9 7 14 5.5 22 12 18 18.5 22 17 14 22 9 14.5 8.5z"/>
      </svg>
    </div>
    """


def page_shell(title, head_extra, body):
    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>{title}</title>
{FONT_AND_RESET}
<style>{BASE_CSS}
{head_extra}
</style>
</head>
<body>
<div class="phone-frame">
{STATUS_BAR}
{body}
</div>
</body>
</html>
"""


# ============================================================================
# STATE A — Listening (Orb pulsing)
# ============================================================================

def build_state_A():
    head = """
  .listen-content {
    flex: 1;
    padding: 0 22px 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow-y: auto;
  }
  .rec-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, #FEE2E2, #FECACA);
    color: #B91C1C;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    margin-top: 30px;
    text-transform: uppercase;
    border: 0.5px solid #FCA5A5;
  }
  .rec-label .dot {
    width: 8px; height: 8px;
    background: #DC2626;
    border-radius: 50%;
    animation: glow-strong 1s ease-in-out infinite;
  }
  .timer {
    font-family: 'JetBrains Mono', monospace;
    font-size: 36px;
    font-weight: 700;
    color: #831447;
    margin-top: 14px;
    letter-spacing: -1px;
  }
  .timer-sub {
    font-size: 11px;
    color: #BE185D;
    font-weight: 600;
    margin-top: -2px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  /* Orb */
  .orb-wrap {
    position: relative;
    width: 280px;
    height: 280px;
    margin-top: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .orb-ring {
    position: absolute;
    inset: 30px;
    border: 2.5px solid;
    border-radius: 50%;
    pointer-events: none;
  }
  .orb-ring.r1 { border-color: rgba(233,30,99,0.45); animation: pulseRing 2.4s ease-out infinite; }
  .orb-ring.r2 { border-color: rgba(251,146,60,0.4); animation: pulseRing 2.4s ease-out infinite; animation-delay: 0.8s; }
  .orb-ring.r3 { border-color: rgba(244,63,94,0.35); animation: pulseRingBig 3s ease-out infinite; animation-delay: 1.6s; }
  .orb-glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle, rgba(233,30,99,0.4) 0%, rgba(251,146,60,0.2) 40%, transparent 70%);
    border-radius: 50%;
    animation: glow-strong 2.5s ease-in-out infinite;
  }
  .orb-core {
    width: 180px;
    height: 180px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #FFFFFF 0%, #FFE4E6 20%, #F9A8D4 50%, #E91E63 75%, #BE185D 100%);
    box-shadow:
      0 20px 50px rgba(233,30,99,0.5),
      inset 0 -10px 30px rgba(190,24,93,0.4),
      inset 0 10px 30px rgba(255,255,255,0.3);
    animation: orbBreathe 2s ease-in-out infinite;
    position: relative;
    z-index: 2;
  }
  .orb-highlight {
    position: absolute;
    top: 20%;
    left: 28%;
    width: 38%;
    height: 30%;
    background: radial-gradient(ellipse, rgba(255,255,255,0.8) 0%, transparent 60%);
    border-radius: 50%;
    z-index: 3;
    pointer-events: none;
  }
  .listening-text {
    font-size: 14px;
    font-weight: 600;
    color: #BE185D;
    margin-top: 22px;
    font-style: italic;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .listening-text .dots span {
    display: inline-block;
    width: 4px; height: 4px;
    background: #E91E63;
    border-radius: 50%;
    margin: 0 1px;
    animation: glow 1.2s ease-in-out infinite;
  }
  .listening-text .dots span:nth-child(2) { animation-delay: 0.2s; }
  .listening-text .dots span:nth-child(3) { animation-delay: 0.4s; }

  /* Live transcription preview (partial) */
  .live-preview {
    width: 100%;
    margin-top: 20px;
    background: rgba(255,255,255,0.7);
    border: 0.5px solid #FBCFE8;
    border-radius: 14px;
    padding: 12px 14px;
    backdrop-filter: blur(8px);
    min-height: 60px;
  }
  .live-preview-label {
    font-size: 10px;
    font-weight: 700;
    color: #BE185D;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    margin-bottom: 5px;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .live-preview-text {
    font-size: 13px;
    color: #831447;
    font-weight: 500;
    line-height: 1.5;
    font-style: italic;
  }
  .live-cursor {
    display: inline-block;
    width: 2px;
    height: 14px;
    background: #E91E63;
    vertical-align: middle;
    margin-left: 2px;
    animation: cursor 1s infinite;
  }
  /* Bottom controls */
  .bottom-bar {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    padding: 16px 18px 22px;
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: center;
  }
  .btn-cancel {
    width: 56px; height: 56px;
    background: #FFFFFF;
    border: 0.5px solid #FBCFE8;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #BE185D;
    box-shadow: 0 6px 14px rgba(233,30,99,0.15);
  }
  .btn-stop {
    width: 76px; height: 76px;
    background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    box-shadow: 0 10px 28px rgba(220,38,38,0.45);
    position: relative;
  }
  .btn-stop::after {
    content: 'DỪNG';
    position: absolute;
    bottom: -22px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 10px;
    font-weight: 700;
    color: #B91C1C;
    letter-spacing: 1px;
  }
"""
    body = top_bar("Đang nghe", "Aida đang ghi giọng nói của bạn") + """
  <div class="listen-content">

    <div class="rec-label">
      <span class="dot"></span>
      Đang ghi âm
    </div>

    <div class="timer">0:04</div>
    <div class="timer-sub">tối đa 30 giây</div>

    <!-- Orb -->
    <div class="orb-wrap">
      <div class="orb-glow"></div>
      <div class="orb-ring r1"></div>
      <div class="orb-ring r2"></div>
      <div class="orb-ring r3"></div>
      <div class="orb-core">
        <div class="orb-highlight"></div>
      </div>
    </div>

    <div class="listening-text">
      Aida đang nghe
      <span class="dots"><span></span><span></span><span></span></span>
    </div>

    <!-- Live transcript partial preview -->
    <div class="live-preview">
      <div class="live-preview-label">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        </svg>
        Tạm hiểu
      </div>
      <div class="live-preview-text">
        Cho tôi 2 chai nước tương Maggi<span class="live-cursor"></span>
      </div>
    </div>

  </div>

  <div class="bottom-bar">
    <button class="btn-cancel" aria-label="cancel">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
    <button class="btn-stop" aria-label="stop recording">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <rect x="6" y="6" width="12" height="12" rx="2"/>
      </svg>
    </button>
  </div>
"""
    return page_shell("Intent 02 — State A — Listening", head, body)


# ============================================================================
# STATE B — Transcribing & Parsing (4-phase progress)
# ============================================================================

def build_state_B():
    head = """
  .main-scroll { flex: 1; overflow-y: auto; padding: 8px 16px 40px; }

  .user-bubble-row { display: flex; justify-content: flex-end; margin-bottom: 14px; }
  .user-bubble {
    background: linear-gradient(135deg, #E91E63 0%, #F43F5E 50%, #FB923C 100%);
    color: #fff;
    padding: 12px 14px;
    border-radius: 16px 16px 4px 16px;
    max-width: 80%;
    box-shadow: 0 6px 16px rgba(233,30,99,0.3);
  }
  .user-bubble-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
    text-transform: uppercase;
    opacity: 0.9;
  }
  .user-bubble-text {
    font-size: 13.5px;
    line-height: 1.45;
    font-weight: 500;
    font-style: italic;
  }
  .live-cursor {
    display: inline-block;
    width: 2px;
    height: 14px;
    background: #fff;
    vertical-align: middle;
    margin-left: 2px;
    animation: cursor 1s infinite;
  }
  .user-bubble-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 10px;
    margin-top: 8px;
    opacity: 0.85;
    font-weight: 600;
  }
  .user-bubble-meta .duration { font-family: 'JetBrains Mono', monospace; }
  .user-bubble-meta .partial-badge {
    background: rgba(255,255,255,0.25);
    padding: 2px 7px;
    border-radius: 6px;
    backdrop-filter: blur(4px);
  }

  /* AI parsing card */
  .ai-row {
    display: flex;
    gap: 8px;
    margin-bottom: 14px;
    animation: slideUp 0.4s ease-out backwards;
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
    font-size: 12.5px;
    color: #831447;
    font-weight: 500;
    line-height: 1.5;
    margin-bottom: 12px;
  }
  .ai-bubble-greet strong { color: #BE185D; font-weight: 700; }

  /* Phases inside bubble */
  .phases {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .phase-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 11px;
    transition: all 0.3s;
  }
  .phase-row.active {
    background: linear-gradient(135deg, #FFF1F5 0%, #FEEEE0 100%);
    box-shadow: 0 3px 8px rgba(233,30,99,0.1);
  }
  .phase-icon {
    width: 28px; height: 28px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .phase-icon.done {
    background: linear-gradient(135deg, #10B981, #059669);
    color: #fff;
    box-shadow: 0 2px 6px rgba(16,185,129,0.3);
  }
  .phase-icon.active {
    background: linear-gradient(135deg, #E91E63, #FB923C);
    color: #fff;
    box-shadow: 0 2px 8px rgba(233,30,99,0.4);
  }
  .phase-icon.pending {
    background: #FCE7F3;
    color: #F9A8D4;
  }
  .phase-text { flex: 1; }
  .phase-label {
    font-size: 12px;
    font-weight: 600;
    color: #831447;
    margin-bottom: 1px;
  }
  .phase-row.pending .phase-label { color: #BE185D; opacity: 0.5; }
  .phase-meta {
    font-size: 10px;
    color: #BE185D;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
  }
  .phase-status {
    font-size: 9px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 6px;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    flex-shrink: 0;
  }
  .phase-status.done { background: rgba(16,185,129,0.12); color: #15803D; }
  .phase-status.active { background: linear-gradient(135deg, #E91E63, #FB923C); color: #fff; }
  .phase-status.pending { background: #FCE7F3; color: #F9A8D4; }

  /* Sneak peek items found */
  .peek-card {
    margin-top: 12px;
    background: linear-gradient(135deg, #FFF1F5, #FCE7F3);
    border: 0.5px dashed #FBCFE8;
    border-radius: 12px;
    padding: 10px 12px;
  }
  .peek-label {
    font-size: 10px;
    font-weight: 700;
    color: #BE185D;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .peek-items {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .peek-item {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 11.5px;
    color: #831447;
    font-weight: 500;
  }
  .peek-num {
    width: 18px; height: 18px;
    background: linear-gradient(135deg, #E91E63, #FB923C);
    color: #fff;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    flex-shrink: 0;
    font-family: 'JetBrains Mono', monospace;
  }
  .peek-item strong { color: #BE185D; font-weight: 700; }
"""
    body = top_bar("Aida đang xử lý", "Vài giây nữa hoàn tất") + """
  <div class="main-scroll">

    <!-- User voice bubble with partial text -->
    <div class="user-bubble-row">
      <div class="user-bubble">
        <div class="user-bubble-label">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          </svg>
          Đang chuyển thành chữ
        </div>
        <div class="user-bubble-text">
          Cho tôi 2 chai nước tương Maggi, 1 thùng mì Hảo Hảo gà với 3 hộp sữa Vinamilk có đường<span class="live-cursor"></span>
        </div>
        <div class="user-bubble-meta">
          <span class="duration">⏱ 0:06</span>
          <span class="partial-badge">⚡ Streaming</span>
        </div>
      </div>
    </div>

    <!-- AI parsing card -->
    <div class="ai-row">
      """ + avatar_aida() + """
      <div class="ai-bubble">
        <div class="ai-bubble-greet">
          Aida đang <strong>hiểu yêu cầu</strong> và <strong>tìm sản phẩm</strong> trong shop của bạn...
        </div>

        <div class="phases">
          <div class="phase-row">
            <div class="phase-icon done">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div class="phase-text">
              <div class="phase-label">Chuyển âm thanh thành chữ</div>
              <div class="phase-meta">Gemini STT · 0.9s</div>
            </div>
            <span class="phase-status done">XONG</span>
          </div>

          <div class="phase-row">
            <div class="phase-icon done">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div class="phase-text">
              <div class="phase-label">Tách 3 sản phẩm từ câu nói</div>
              <div class="phase-meta">LLM intent parser · 1.2s</div>
            </div>
            <span class="phase-status done">XONG</span>
          </div>

          <div class="phase-row active">
            <div class="phase-icon active">
              <svg class="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            </div>
            <div class="phase-text">
              <div class="phase-label">Tìm sản phẩm trong shop</div>
              <div class="phase-meta">Vespa search 3 queries song song...</div>
            </div>
            <span class="phase-status active">ĐANG</span>
          </div>

          <div class="phase-row pending">
            <div class="phase-icon pending">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 11 12 14 22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
            <div class="phase-text">
              <div class="phase-label">Chuẩn bị giỏ tạm</div>
              <div class="phase-meta">Chờ bước trước</div>
            </div>
            <span class="phase-status pending">CHỜ</span>
          </div>
        </div>

        <!-- Sneak peek of items detected -->
        <div class="peek-card">
          <div class="peek-label">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Đã nhận diện
          </div>
          <div class="peek-items">
            <div class="peek-item">
              <span class="peek-num">1</span>
              <span><strong>Nước tương Maggi</strong> · qty 2 (chai)</span>
            </div>
            <div class="peek-item">
              <span class="peek-num">2</span>
              <span><strong>Mì Hảo Hảo gà</strong> · qty 1 (thùng)</span>
            </div>
            <div class="peek-item">
              <span class="peek-num">3</span>
              <span><strong>Sữa Vinamilk có đường</strong> · qty 3 (hộp)</span>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
"""
    return page_shell("Intent 02 — State B — Transcribing", head, body)


# ============================================================================
# STATE D — Clarify (inline bubble with chip options)
# ============================================================================

def build_state_D():
    head = """
  .thread { flex: 1; overflow-y: auto; padding: 8px 16px 120px; }

  .user-bubble-row { display: flex; justify-content: flex-end; margin-bottom: 14px; }
  .user-bubble {
    background: linear-gradient(135deg, #E91E63 0%, #F43F5E 50%, #FB923C 100%);
    color: #fff;
    padding: 12px 14px;
    border-radius: 16px 16px 4px 16px;
    max-width: 80%;
    box-shadow: 0 6px 16px rgba(233,30,99,0.3);
  }
  .user-bubble-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
    margin-bottom: 6px;
    text-transform: uppercase;
    opacity: 0.9;
    letter-spacing: 0.5px;
  }
  .user-bubble-text {
    font-size: 13.5px;
    line-height: 1.45;
    font-weight: 500;
    font-style: italic;
  }
  .user-bubble-meta {
    font-size: 10px;
    margin-top: 8px;
    opacity: 0.85;
    font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
  }

  .ai-row {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
    animation: slideUp 0.4s ease-out backwards;
  }
  .ai-bubble {
    flex: 1;
    background: #FFFFFF;
    border-radius: 4px 16px 16px 16px;
    padding: 12px 14px;
    border: 0.5px solid #FBCFE8;
    box-shadow: 0 4px 12px rgba(233,30,99,0.08);
  }
  .ai-bubble-text {
    font-size: 12.5px;
    color: #831447;
    font-weight: 500;
    line-height: 1.5;
  }
  .ai-bubble-text strong { color: #BE185D; font-weight: 700; }

  /* Already matched items (compact list) */
  .matched-card {
    background: linear-gradient(135deg, #FFFFFF, #FEF7F9);
    border-radius: 14px;
    padding: 10px 12px;
    border: 0.5px solid #FBCFE8;
    margin-top: 10px;
  }
  .matched-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }
  .matched-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: linear-gradient(135deg, #DCFCE7, #BBF7D0);
    color: #15803D;
    padding: 2px 8px;
    border-radius: 7px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
  }
  .matched-count {
    font-size: 10px;
    color: #BE185D;
    font-weight: 600;
  }
  .matched-line {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-size: 11.5px;
    color: #831447;
    font-weight: 500;
  }
  .matched-line svg { color: #22C55E; flex-shrink: 0; }
  .matched-line strong { color: #BE185D; font-weight: 700; }

  /* Clarify question card */
  .clarify-bubble {
    background: linear-gradient(135deg, #FFE4E6 0%, #FED7AA 100%);
    border: 1.5px solid #F9A8D4;
    border-radius: 4px 16px 16px 16px;
  }
  .clarify-icon-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .clarify-spark {
    width: 24px; height: 24px;
    background: linear-gradient(135deg, #E91E63, #FB923C);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 3px 8px rgba(233,30,99,0.3);
    flex-shrink: 0;
  }
  .clarify-label {
    font-size: 10px;
    font-weight: 700;
    color: #BE185D;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }
  .clarify-question {
    font-size: 13px;
    color: #831447;
    font-weight: 600;
    line-height: 1.4;
    margin-bottom: 10px;
  }
  .clarify-question strong {
    color: #BE185D;
    font-weight: 700;
  }

  /* Option chips */
  .options-list {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .opt-chip {
    background: #FFFFFF;
    border: 0.5px solid #FBCFE8;
    border-radius: 12px;
    padding: 9px 10px;
    display: flex;
    gap: 10px;
    align-items: center;
    box-shadow: 0 2px 6px rgba(233,30,99,0.08);
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
  }
  .opt-chip:hover {
    border-color: #E91E63;
    box-shadow: 0 4px 12px rgba(233,30,99,0.18);
  }
  .opt-thumb {
    width: 36px; height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .opt-thumb.t1 { background: linear-gradient(135deg, #FFE4E6, #FECDD3); color: #BE185D; }
  .opt-thumb.t2 { background: linear-gradient(135deg, #FFEDD5, #FED7AA); color: #C2410C; }
  .opt-thumb.t3 { background: linear-gradient(135deg, #FEF3C7, #FCD34D); color: #92400E; }
  .opt-thumb.t4 { background: linear-gradient(135deg, #FCE7F3, #FBCFE8); color: #BE185D; }
  .opt-info { flex: 1; }
  .opt-name {
    font-size: 12.5px;
    font-weight: 600;
    color: #831447;
    line-height: 1.3;
  }
  .opt-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: #BE185D;
    font-weight: 600;
    margin-top: 2px;
  }
  .opt-meta .sep { width: 3px; height: 3px; background: #BE185D; border-radius: 50%; opacity: 0.5; }
  .opt-price {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    font-weight: 700;
    color: #C2410C;
    flex-shrink: 0;
  }
  .opt-other {
    background: rgba(255,255,255,0.6);
    border: 0.5px dashed #FBCFE8;
    color: #BE185D;
    border-radius: 12px;
    padding: 9px 12px;
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
  }

  /* Bottom bar (locked while clarifying) */
  .bottom-bar {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    background: linear-gradient(180deg, rgba(255,248,240,0) 0%, rgba(255,248,240,0.9) 30%, #FFF8F0 60%);
    padding: 14px 16px 18px;
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .bottom-hint {
    flex: 1;
    background: #FFFFFF;
    border: 0.5px dashed #FBCFE8;
    border-radius: 14px;
    padding: 14px;
    font-size: 12px;
    color: #BE185D;
    font-weight: 600;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
"""
    body = top_bar("Aida cần hỏi thêm", "1 món chưa rõ — chọn giúp") + """
  <div class="thread">

    <!-- User voice bubble -->
    <div class="user-bubble-row">
      <div class="user-bubble">
        <div class="user-bubble-label">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          </svg>
          Bạn vừa nói
        </div>
        <div class="user-bubble-text">
          Cho tôi 2 chai nước tương với 1 thùng mì Hảo Hảo gà
        </div>
        <div class="user-bubble-meta">⏱ 0:04 · ✓ 97%</div>
      </div>
    </div>

    <!-- AI: 1 matched + 1 ambiguous -->
    <div class="ai-row">
      """ + avatar_aida() + """
      <div class="ai-bubble">
        <div class="ai-bubble-text">
          Aida đã hiểu <strong>2 sản phẩm</strong> bạn cần. Trong đó <strong>1 món đã rõ</strong>, còn <strong>1 món cần hỏi thêm</strong>.
        </div>
        <div class="matched-card">
          <div class="matched-header">
            <span class="matched-tag">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Đã rõ
            </span>
            <span class="matched-count">1 / 2 món</span>
          </div>
          <div class="matched-line">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <strong>Mì Hảo Hảo gà</strong> · qty 1 thùng · 110.000₫
          </div>
        </div>
      </div>
    </div>

    <!-- Clarify question bubble -->
    <div class="ai-row">
      """ + avatar_aida() + """
      <div class="ai-bubble clarify-bubble">
        <div class="clarify-icon-row">
          <div class="clarify-spark">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </div>
          <span class="clarify-label">Cần làm rõ</span>
        </div>
        <div class="clarify-question">
          Bạn muốn <strong>nước tương</strong> loại nào? Shop có 4 nhãn:
        </div>

        <div class="options-list">
          <button class="opt-chip">
            <div class="opt-thumb t1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2v6.343c0 .53.21 1.04.586 1.414L18.414 13.586c.375.375.586.884.586 1.414V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5c0-.53.21-1.04.586-1.414L9.414 9.757A2 2 0 0 0 10 8.343V2"/>
                <line x1="9" y1="2" x2="15" y2="2"/>
              </svg>
            </div>
            <div class="opt-info">
              <div class="opt-name">Maggi nước tương đậu nành 200ml</div>
              <div class="opt-meta">
                <span>★ 4.9</span><span class="sep"></span><span>Bán 8.5k</span><span class="sep"></span><span>Còn 42</span>
              </div>
            </div>
            <div class="opt-price">25.000₫</div>
          </button>

          <button class="opt-chip">
            <div class="opt-thumb t2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2v6.343c0 .53.21 1.04.586 1.414L18.414 13.586c.375.375.586.884.586 1.414V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5c0-.53.21-1.04.586-1.414L9.414 9.757A2 2 0 0 0 10 8.343V2"/>
              </svg>
            </div>
            <div class="opt-info">
              <div class="opt-name">Chin-su nước tương cao cấp 250ml</div>
              <div class="opt-meta">
                <span>★ 4.8</span><span class="sep"></span><span>Bán 5.2k</span><span class="sep"></span><span>Còn 28</span>
              </div>
            </div>
            <div class="opt-price">32.000₫</div>
          </button>

          <button class="opt-chip">
            <div class="opt-thumb t3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2v6.343c0 .53.21 1.04.586 1.414L18.414 13.586c.375.375.586.884.586 1.414V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5c0-.53.21-1.04.586-1.414L9.414 9.757A2 2 0 0 0 10 8.343V2"/>
              </svg>
            </div>
            <div class="opt-info">
              <div class="opt-name">Tam Thái Tử nước tương 300ml</div>
              <div class="opt-meta">
                <span>★ 4.7</span><span class="sep"></span><span>Bán 2.1k</span><span class="sep"></span><span>Còn 15</span>
              </div>
            </div>
            <div class="opt-price">28.000₫</div>
          </button>

          <button class="opt-other">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
            </svg>
            Xem tất cả 4 loại nước tương
          </button>
        </div>
      </div>
    </div>

  </div>

  <div class="bottom-bar">
    <div class="bottom-hint">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 11 12 14 22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
      Chọn 1 loại để tiếp tục
    </div>
  </div>
"""
    return page_shell("Intent 02 — State D — Clarify", head, body)


# ============================================================================
# STATE E — Cart added (success)
# ============================================================================

def build_state_E():
    head = """
  .thread { flex: 1; overflow-y: auto; padding: 8px 16px 100px; }

  .user-bubble-row { display: flex; justify-content: flex-end; margin-bottom: 12px; opacity: 0.7; }
  .user-bubble {
    background: linear-gradient(135deg, #E91E63 0%, #F43F5E 50%, #FB923C 100%);
    color: #fff;
    padding: 10px 13px;
    border-radius: 14px 14px 4px 14px;
    max-width: 75%;
    box-shadow: 0 4px 10px rgba(233,30,99,0.2);
  }
  .user-bubble-text { font-size: 12.5px; font-weight: 500; font-style: italic; }

  .ai-row { display: flex; gap: 8px; margin-bottom: 14px; animation: slideUp 0.4s ease-out backwards; }

  /* Success card */
  .success-bubble {
    background: linear-gradient(135deg, #FFFFFF 0%, #ECFDF5 100%);
    border: 1.5px solid #BBF7D0;
    border-radius: 4px 18px 18px 18px;
    padding: 16px;
    box-shadow: 0 10px 24px rgba(16,185,129,0.15);
    flex: 1;
  }
  .success-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }
  .success-check {
    width: 48px; height: 48px;
    background: linear-gradient(135deg, #10B981, #059669);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 6px 14px rgba(16,185,129,0.4);
    flex-shrink: 0;
    animation: elastic-pop 0.6s cubic-bezier(0.34,1.56,0.64,1);
  }
  .success-title {
    font-size: 16px;
    font-weight: 700;
    color: #15803D;
    letter-spacing: -0.3px;
    line-height: 1.2;
  }
  .success-sub {
    font-size: 11px;
    color: #166534;
    font-weight: 500;
    margin-top: 3px;
  }

  /* Summary mini */
  .summary-strip {
    background: rgba(255,255,255,0.7);
    border: 0.5px solid #BBF7D0;
    border-radius: 12px;
    padding: 10px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .summary-left { display: flex; flex-direction: column; gap: 2px; }
  .summary-label {
    font-size: 9px;
    font-weight: 700;
    color: #166534;
    letter-spacing: 0.4px;
    text-transform: uppercase;
  }
  .summary-items { font-size: 11px; color: #15803D; font-weight: 600; }
  .summary-total {
    font-family: 'JetBrains Mono', monospace;
    font-size: 16px;
    font-weight: 700;
    color: #15803D;
  }

  /* Suggested next */
  .suggest-bubble {
    background: linear-gradient(135deg, #FFF1F5, #FCE7F3);
    border-radius: 4px 14px 14px 14px;
    padding: 12px 14px;
    border: 0.5px solid #FBCFE8;
    flex: 1;
  }
  .suggest-label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: linear-gradient(135deg, #E91E63, #FB923C);
    color: #fff;
    padding: 3px 8px;
    border-radius: 7px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .suggest-text {
    font-size: 12.5px;
    color: #831447;
    font-weight: 500;
    line-height: 1.5;
    margin-bottom: 10px;
  }
  .suggest-text strong { color: #BE185D; font-weight: 700; }

  /* Co-purchase mini card */
  .copurchase-card {
    background: #FFFFFF;
    border: 0.5px solid #FBCFE8;
    border-radius: 12px;
    padding: 10px;
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .cp-thumb {
    width: 44px; height: 44px;
    background: linear-gradient(135deg, #FFEDD5, #FED7AA);
    border-radius: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .cp-info { flex: 1; min-width: 0; }
  .cp-name {
    font-size: 12px;
    font-weight: 600;
    color: #831447;
    line-height: 1.3;
  }
  .cp-meta {
    font-size: 10px;
    color: #BE185D;
    font-weight: 600;
    margin-top: 3px;
    font-family: 'JetBrains Mono', monospace;
  }
  .cp-add-btn {
    background: linear-gradient(135deg, #E91E63, #F43F5E);
    color: #fff;
    width: 32px; height: 32px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 3px 8px rgba(233,30,99,0.3);
    flex-shrink: 0;
  }

  /* Cart pill overlay (top-right floating) */
  .cart-pill-float {
    position: absolute;
    top: 60px;
    right: 18px;
    background: linear-gradient(135deg, #E91E63, #FB923C);
    color: #fff;
    padding: 8px 14px 8px 12px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 10px 24px rgba(233,30,99,0.4);
    z-index: 5;
    animation: bump 0.6s cubic-bezier(0.34,1.56,0.64,1);
    font-weight: 700;
    font-size: 12px;
  }
  .cart-pill-icon {
    background: rgba(255,255,255,0.2);
    width: 24px; height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cart-pill-count {
    background: #fff;
    color: #E91E63;
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
  }

  /* Bottom CTAs */
  .bottom-bar {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    background: linear-gradient(180deg, rgba(255,248,240,0) 0%, rgba(255,248,240,0.9) 30%, #FFF8F0 60%);
    padding: 14px 16px 18px;
    display: flex;
    gap: 10px;
  }
  .btn-checkout {
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
  .btn-continue {
    flex: 1;
    background: #FFFFFF;
    color: #BE185D;
    border: 0.5px solid #FBCFE8;
    border-radius: 14px;
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(233,30,99,0.1);
    height: 52px;
  }
"""
    body = top_bar("Đã thêm vào giỏ", "Thành công · giỏ đã cập nhật") + """
  <!-- Floating cart pill (bumped) -->
  <div class="cart-pill-float">
    <div class="cart-pill-icon">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="21" r="1"/>
        <circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
      </svg>
    </div>
    Giỏ
    <span class="cart-pill-count">+3</span>
  </div>

  <div class="thread">

    <!-- Echo user bubble (faded) -->
    <div class="user-bubble-row">
      <div class="user-bubble">
        <div class="user-bubble-text">2 nước tương Maggi, 1 thùng mì gà, 3 hộp sữa Vinamilk</div>
      </div>
    </div>

    <!-- Success bubble -->
    <div class="ai-row">
      """ + avatar_aida() + """
      <div class="success-bubble">
        <div class="success-header">
          <div class="success-check">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div>
            <div class="success-title">Đã thêm 3 món vào giỏ!</div>
            <div class="success-sub">Bạn có thể tiếp tục mua hoặc thanh toán ngay</div>
          </div>
        </div>
        <div class="summary-strip">
          <div class="summary-left">
            <span class="summary-label">Tổng giỏ hiện tại</span>
            <span class="summary-items">3 sản phẩm · 6 đơn vị</span>
          </div>
          <span class="summary-total">185.500₫</span>
        </div>
      </div>
    </div>

    <!-- Suggestion bubble -->
    <div class="ai-row">
      """ + avatar_aida() + """
      <div class="suggest-bubble">
        <span class="suggest-label">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L9.5 8.5 2 9 7 14 5.5 22 12 18 18.5 22 17 14 22 9 14.5 8.5z"/>
          </svg>
          GỢI Ý KÈM
        </span>
        <div class="suggest-text">
          <strong>62% khách</strong> mua nước tương + mì thường lấy thêm <strong>dầu ăn 1L</strong> trong shop bạn
        </div>
        <div class="copurchase-card">
          <div class="cp-thumb">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C2410C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2v6.343c0 .53.21 1.04.586 1.414L18.414 13.586c.375.375.586.884.586 1.414V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5c0-.53.21-1.04.586-1.414L9.414 9.757A2 2 0 0 0 10 8.343V2"/>
              <line x1="9" y1="2" x2="15" y2="2"/>
            </svg>
          </div>
          <div class="cp-info">
            <div class="cp-name">Dầu ăn Tường An 1L</div>
            <div class="cp-meta">45.000₫ · còn 18 chai</div>
          </div>
          <button class="cp-add-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

  </div>

  <div class="bottom-bar">
    <button class="btn-continue">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      </svg>
      Mua tiếp
    </button>
    <button class="btn-checkout">
      Thanh toán
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"/>
        <polyline points="12 5 19 12 12 19"/>
      </svg>
    </button>
  </div>
"""
    return page_shell("Intent 02 — State E — Cart Added", head, body)


# ============================================================================
# STATE F — No match (empty)
# ============================================================================

def build_state_F():
    head = """
  .thread { flex: 1; overflow-y: auto; padding: 8px 16px 100px; }

  .user-bubble-row { display: flex; justify-content: flex-end; margin-bottom: 14px; }
  .user-bubble {
    background: linear-gradient(135deg, #E91E63 0%, #F43F5E 50%, #FB923C 100%);
    color: #fff;
    padding: 12px 14px;
    border-radius: 16px 16px 4px 16px;
    max-width: 80%;
    box-shadow: 0 6px 16px rgba(233,30,99,0.3);
  }
  .user-bubble-label {
    display: flex; align-items: center; gap: 6px;
    font-size: 10px; font-weight: 700; margin-bottom: 6px;
    text-transform: uppercase; opacity: 0.9; letter-spacing: 0.5px;
  }
  .user-bubble-text { font-size: 13.5px; line-height: 1.45; font-weight: 500; font-style: italic; }
  .user-bubble-meta { font-size: 10px; margin-top: 8px; opacity: 0.85; font-weight: 600; font-family: 'JetBrains Mono', monospace; }

  .ai-row { display: flex; gap: 8px; margin-bottom: 14px; animation: slideUp 0.4s ease-out backwards; }

  /* Empty bubble */
  .empty-bubble {
    flex: 1;
    background: linear-gradient(135deg, #FFFFFF, #FEF7F9);
    border-radius: 4px 16px 16px 16px;
    padding: 14px;
    border: 0.5px solid #FBCFE8;
    box-shadow: 0 4px 12px rgba(233,30,99,0.08);
  }
  .empty-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .empty-icon {
    width: 36px; height: 36px;
    background: linear-gradient(135deg, #FEF3C7, #FCD34D);
    border-radius: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .empty-title {
    font-size: 14px;
    font-weight: 700;
    color: #831447;
    line-height: 1.3;
  }
  .empty-sub {
    font-size: 11px;
    color: #BE185D;
    font-weight: 500;
    margin-top: 2px;
  }
  .empty-quote {
    background: rgba(245,158,11,0.08);
    border-left: 3px solid #F59E0B;
    padding: 8px 12px;
    border-radius: 0 10px 10px 0;
    font-size: 12px;
    color: #92400E;
    font-style: italic;
    font-weight: 500;
    margin-bottom: 12px;
  }
  .empty-quote strong { color: #B45309; font-weight: 700; }

  /* Alternatives */
  .alt-label {
    font-size: 11px;
    font-weight: 700;
    color: #BE185D;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .alt-card {
    background: #FFFFFF;
    border: 0.5px solid #FBCFE8;
    border-radius: 12px;
    padding: 10px;
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 7px;
  }
  .alt-thumb {
    width: 48px; height: 48px;
    border-radius: 11px;
    background: linear-gradient(135deg, #FFE4E6, #FECDD3);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .alt-thumb.t2 { background: linear-gradient(135deg, #FFEDD5, #FED7AA); }
  .alt-info { flex: 1; min-width: 0; }
  .alt-name {
    font-size: 12px;
    font-weight: 600;
    color: #831447;
    line-height: 1.3;
    margin-bottom: 3px;
  }
  .alt-similar {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background: rgba(251,146,60,0.12);
    color: #C2410C;
    padding: 1px 6px;
    border-radius: 6px;
    font-size: 9px;
    font-weight: 700;
    margin-right: 5px;
  }
  .alt-meta { font-size: 10px; color: #BE185D; font-weight: 500; margin-top: 2px; }
  .alt-price {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    font-weight: 700;
    color: #C2410C;
    flex-shrink: 0;
  }

  /* Bottom CTAs */
  .bottom-bar {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    background: linear-gradient(180deg, rgba(255,248,240,0) 0%, rgba(255,248,240,0.9) 30%, #FFF8F0 60%);
    padding: 14px 16px 18px;
    display: flex;
    gap: 10px;
  }
  .btn-retry {
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
  .btn-type {
    background: #FFFFFF;
    color: #BE185D;
    border: 0.5px solid #FBCFE8;
    border-radius: 14px;
    font-size: 13px;
    font-weight: 600;
    padding: 0 16px;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 52px;
    box-shadow: 0 4px 12px rgba(233,30,99,0.1);
  }
"""
    body = top_bar("Chưa tìm thấy", "Aida gợi ý sản phẩm gần giống") + """
  <div class="thread">

    <!-- User voice bubble -->
    <div class="user-bubble-row">
      <div class="user-bubble">
        <div class="user-bubble-label">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          </svg>
          Bạn vừa nói
        </div>
        <div class="user-bubble-text">
          Cho tôi 1 chai nước mắm Phan Thiết 5 lít
        </div>
        <div class="user-bubble-meta">⏱ 0:03 · ✓ 94%</div>
      </div>
    </div>

    <!-- Empty bubble -->
    <div class="ai-row">
      """ + avatar_aida() + """
      <div class="empty-bubble">
        <div class="empty-header">
          <div class="empty-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B45309" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </div>
          <div>
            <div class="empty-title">Shop bạn chưa có món này</div>
            <div class="empty-sub">Aida không tìm thấy trong 247 sản phẩm</div>
          </div>
        </div>

        <div class="empty-quote">
          Em đoán bạn cần: <strong>"nước mắm Phan Thiết loại 5L"</strong> — đúng không?
        </div>

        <div class="alt-label">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L9.5 8.5 2 9 7 14 5.5 22 12 18 18.5 22 17 14 22 9 14.5 8.5z"/>
          </svg>
          2 sản phẩm gần giống trong shop
        </div>

        <div class="alt-card">
          <div class="alt-thumb">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#BE185D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2v6.343c0 .53.21 1.04.586 1.414L18.414 13.586c.375.375.586.884.586 1.414V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5c0-.53.21-1.04.586-1.414L9.414 9.757A2 2 0 0 0 10 8.343V2"/>
            </svg>
          </div>
          <div class="alt-info">
            <div class="alt-name">Nước mắm Phú Quốc 30 độ đạm 500ml</div>
            <div class="alt-meta">
              <span class="alt-similar">~ 68%</span>
              ★ 4.8 · Còn 23
            </div>
          </div>
          <div class="alt-price">65.000₫</div>
        </div>

        <div class="alt-card">
          <div class="alt-thumb t2">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C2410C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2v6.343c0 .53.21 1.04.586 1.414L18.414 13.586c.375.375.586.884.586 1.414V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5c0-.53.21-1.04.586-1.414L9.414 9.757A2 2 0 0 0 10 8.343V2"/>
            </svg>
          </div>
          <div class="alt-info">
            <div class="alt-name">Nước mắm Liên Thành can 2L</div>
            <div class="alt-meta">
              <span class="alt-similar">~ 54%</span>
              ★ 4.6 · Còn 12
            </div>
          </div>
          <div class="alt-price">98.000₫</div>
        </div>

      </div>
    </div>

  </div>

  <div class="bottom-bar">
    <button class="btn-type">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="4 7 4 4 20 4 20 7"/>
        <line x1="9" y1="20" x2="15" y2="20"/>
        <line x1="12" y1="4" x2="12" y2="20"/>
      </svg>
      Gõ tay
    </button>
    <button class="btn-retry">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
      </svg>
      Nói lại
    </button>
  </div>
"""
    return page_shell("Intent 02 — State F — No Match", head, body)


# ============================================================================
# STATE G — Error (transcribe failed / no speech)
# ============================================================================

def build_state_G():
    head = """
  .err-content {
    flex: 1;
    padding: 20px 22px 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow-y: auto;
  }

  /* Failed orb (red tint, broken pulse) */
  .err-orb-wrap {
    position: relative;
    width: 220px; height: 220px;
    margin: 12px auto 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .err-orb-aura {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle, rgba(220,38,38,0.3) 0%, rgba(220,38,38,0.1) 50%, transparent 75%);
    border-radius: 50%;
  }
  .err-orb-core {
    width: 140px; height: 140px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #FECACA 0%, #FCA5A5 30%, #DC2626 80%, #991B1B 100%);
    box-shadow:
      0 16px 36px rgba(220,38,38,0.4),
      inset 0 -8px 24px rgba(127,29,29,0.5),
      inset 0 6px 16px rgba(254,202,202,0.25);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: shake 3s ease-in-out infinite;
  }
  .err-orb-icon { color: #fff; opacity: 0.92; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); }
  .err-strike {
    position: absolute;
    inset: 30px;
    border-radius: 50%;
    border: 2.5px dashed rgba(220,38,38,0.5);
    pointer-events: none;
  }

  .err-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(220,38,38,0.1);
    color: #DC2626;
    padding: 6px 14px;
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
    margin-top: 12px;
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

  /* Reason cards */
  .err-reasons {
    width: 100%;
    margin-top: 22px;
    background: #FFFFFF;
    border-radius: 16px;
    padding: 14px;
    border: 0.5px solid #FBCFE8;
    box-shadow: 0 4px 12px rgba(233,30,99,0.08);
  }
  .err-reasons-title {
    font-size: 11px;
    font-weight: 700;
    color: #BE185D;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .reason-row {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 7px 0;
  }
  .reason-row + .reason-row { border-top: 0.5px solid #FCE7F3; }
  .reason-icon {
    width: 26px; height: 26px;
    background: linear-gradient(135deg, #FEF3C7, #FCD34D);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .reason-text {
    font-size: 11.5px;
    color: #831447;
    line-height: 1.5;
    font-weight: 500;
    flex: 1;
  }
  .reason-text strong { color: #BE185D; font-weight: 700; }

  /* CTAs */
  .err-ctas {
    width: 100%;
    margin-top: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .btn-primary {
    width: 100%;
    background: linear-gradient(135deg, #E91E63 0%, #F43F5E 50%, #FB923C 100%);
    color: #fff;
    padding: 15px 20px;
    border-radius: 16px;
    font-size: 15px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    box-shadow: 0 10px 22px rgba(233,30,99,0.35);
  }
  .btn-secondary {
    width: 100%;
    background: #FFFFFF;
    color: #BE185D;
    padding: 13px 20px;
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
    body = top_bar("Không nghe được", "Aida cần bạn nói lại") + """
  <div class="err-content">

    <!-- Failed orb -->
    <div class="err-orb-wrap">
      <div class="err-orb-aura"></div>
      <div class="err-strike"></div>
      <div class="err-orb-core">
        <svg class="err-orb-icon" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="1" y1="1" x2="23" y2="23"/>
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
          <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </div>
    </div>

    <div class="err-label">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      Voice không rõ
    </div>

    <h1 class="err-title">Aida chưa nghe<br>được bạn nói gì</h1>
    <p class="err-sub">
      Âm thanh ngắn quá hoặc ồn quá. Hãy thử lại theo gợi ý.
    </p>

    <div class="err-reasons">
      <div class="err-reasons-title">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18h6"/>
          <path d="M10 22h4"/>
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
        </svg>
        Mẹo nói lại
      </div>

      <div class="reason-row">
        <div class="reason-icon">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B45309" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
            <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
          </svg>
        </div>
        <div class="reason-text">
          Đến nơi <strong>yên tĩnh</strong> — TV, quạt máy có thể che giọng bạn
        </div>
      </div>

      <div class="reason-row">
        <div class="reason-icon">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B45309" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          </svg>
        </div>
        <div class="reason-text">
          Đưa điện thoại <strong>gần miệng 15-20cm</strong>, nói rõ ràng vừa phải
        </div>
      </div>

      <div class="reason-row">
        <div class="reason-icon">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B45309" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <div class="reason-text">
          Nói <strong>ít nhất 2 giây</strong> — đừng tắt nút quá sớm
        </div>
      </div>
    </div>

    <div class="err-ctas">
      <button class="btn-primary">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
        </svg>
        Nói lại
      </button>
      <button class="btn-secondary">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="4 7 4 4 20 4 20 7"/>
          <line x1="9" y1="20" x2="15" y2="20"/>
          <line x1="12" y1="4" x2="12" y2="20"/>
        </svg>
        Gõ tay thay
      </button>
    </div>

    <div class="err-code">
      E_TRANSCRIBE_FAILED · trace: f9e2c1...a83b
    </div>

  </div>
"""
    return page_shell("Intent 02 — State G — Error", head, body)


# ============================================================================
# WRITE FILES
# ============================================================================

builders = {
    "intent-02-state-A-listening.html": build_state_A,
    "intent-02-state-B-transcribing.html": build_state_B,
    "intent-02-state-D-clarify.html": build_state_D,
    "intent-02-state-E-cart-added.html": build_state_E,
    "intent-02-state-F-no-match.html": build_state_F,
    "intent-02-state-G-error.html": build_state_G,
}

if __name__ == "__main__":
    for fname, fn in builders.items():
        path = OUT / fname
        path.write_text(fn(), encoding="utf-8")
        size = path.stat().st_size
        print(f"  ✓ {fname}  ({size:,} bytes)")
    print(f"\nBuilt {len(builders)} states.")
