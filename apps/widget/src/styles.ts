const STYLE_ID = 'mira-widget-styles';

// استایل همراه باندل است؛ رنگ و موقعیت سفارشی سایت میزبان حفظ می‌شود.
export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .mira-panel, .mira-bubble, .mira-trigger {
      --mira-color: #2e6be6; --mira-ink: #1c2b49; --mira-muted: #64748b;
      --mira-line: #e5ebf4; --mira-soft: #f5f8fd; --mira-teal: #137d71;
      font-family: Vazirmatn, Tahoma, Arial, sans-serif; font-size: 14px;
      line-height: 1.8; direction: rtl; text-align: start; letter-spacing: normal;
      box-sizing: border-box; color: var(--mira-ink);
    }
    .mira-panel *, .mira-bubble *, .mira-trigger *, .mira-panel *::before, .mira-panel *::after { box-sizing: border-box; }
    .mira-panel button, .mira-panel select, .mira-bubble, .mira-trigger button {
      font-family: inherit; font-size: inherit; line-height: inherit; letter-spacing: normal;
      cursor: pointer; text-transform: none; margin: 0;
    }
    .mira-panel button, .mira-panel select { color: inherit; }
    .mira-panel button { appearance: none; }
    .mira-panel [hidden] { display: none !important; }
    .mira-panel button:disabled { opacity: .45; cursor: not-allowed; }
    .mira-panel button:focus-visible, .mira-panel a:focus-visible, .mira-panel select:focus-visible,
    .mira-bubble:focus-visible, .mira-trigger button:focus-visible { outline: 3px solid var(--mira-color); outline-offset: 3px; }
    .mira-panel svg, .mira-bubble svg { display: block; flex-shrink: 0; }
    .mira-bubble {
      position: fixed; bottom: max(20px, env(safe-area-inset-bottom)); display: flex; align-items: center;
      gap: 14px; height: 64px; padding: 8px 10px 8px 22px; border: 0; border-radius: 36px;
      background: var(--mira-gradient, #2e6be6); color: white; font-size: 15px; font-weight: 700;
      box-shadow: 0 8px 28px #244f9c35; z-index: 999998; transition: transform .2s, box-shadow .2s;
      animation: mira-enter .3s ease-out both;
    }
    .mira-bubble:hover { transform: translateY(-3px); box-shadow: 0 12px 32px #244f9c45; }
    .mira-icon-chat { display: grid; place-items: center; width: 46px; height: 46px; background: white; color: var(--mira-color); border-radius: 50%; }
    .mira-icon-chat svg { width: 28px; height: 28px; }
    .mira-icon-close { display: none; }
    .mira-bubble.mira-bubble-open { width: 56px; height: 56px; padding: 0; justify-content: center; }
    .mira-bubble-open .mira-icon-chat, .mira-bubble-open .mira-launcher-label { display: none; }
    .mira-bubble-open .mira-icon-close { display: block; }
    .mira-bubble.mira-launcher-hidden { visibility: hidden; pointer-events: none; }
    .mira-pos-right.mira-bubble, .mira-pos-right.mira-trigger, .mira-pos-right.mira-panel { right: 24px; }
    .mira-pos-left.mira-bubble, .mira-pos-left.mira-trigger, .mira-pos-left.mira-panel { left: 24px; }
    .mira-trigger {
      position: fixed; bottom: 100px; max-width: min(280px, calc(100vw - 48px)); padding: 16px;
      border: 1px solid var(--mira-line); border-radius: 20px; background: white; box-shadow: 0 8px 32px #1c2b4918;
      z-index: 999997; opacity: 0; visibility: hidden; transform: translateY(8px); pointer-events: none;
      transition: opacity .2s, transform .2s, visibility .2s;
    }
    .mira-trigger.mira-open { opacity: 1; visibility: visible; transform: none; pointer-events: auto; }
    .mira-trigger .mira-trigger-open { border: 0; background: none; padding: 0; color: inherit; text-align: start; }
    .mira-trigger .mira-trigger-close { position: absolute; inset-inline-start: -12px; top: -14px; width: 44px; height: 44px; border: 1px solid var(--mira-line); border-radius: 50%; background: white; color: var(--mira-muted); }
    .mira-backdrop { position: fixed; inset: 0; background: #172d4e52; backdrop-filter: blur(5px); z-index: 999998; display: none; }
    .mira-backdrop.mira-open { display: block; }
    .mira-panel {
      position: fixed; bottom: 96px; width: 560px; max-width: calc(100vw - 48px); height: 760px;
      max-height: calc(100dvh - 120px); background: white; border-radius: 28px; border: 1px solid var(--mira-line);
      box-shadow: 0 24px 80px #142b5526, 0 4px 16px #142b550a; display: flex; flex-direction: column;
      overflow: hidden; z-index: 999999; opacity: 0; visibility: hidden; pointer-events: none;
      transform: translateY(16px) scale(.98); transition: opacity .2s, transform .25s, visibility .25s;
      isolation: isolate; color-scheme: light;
    }
    .mira-panel.mira-open { opacity: 1; visibility: visible; pointer-events: auto; transform: none; }
    .mira-panel.mira-fullscreen {
      inset: 16px; width: auto; height: auto; max-width: none; max-height: none; border-radius: 24px;
    }
    .mira-header { display: flex; align-items: center; gap: 12px; padding: 18px 22px; border-bottom: 1px solid var(--mira-line); flex-shrink: 0; background: white; }
    .mira-header-logo { display: grid; place-items: center; width: 46px; height: 46px; flex-shrink: 0; border-radius: 17px; color: var(--mira-color); background: #eef4ff; }
    .mira-header-logo svg { width: 29px; height: 29px; }
    .mira-header-logo img { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; }
    .mira-header-identity { flex: 1; min-width: 0; }
    .mira-header-title { display: block; font-size: 15px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mira-header-sub { display: block; color: var(--mira-muted); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mira-connection { display: flex; align-items: center; gap: 5px; margin-top: 2px; font-size: 11px; color: var(--mira-muted); }
    .mira-connection::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #9b6b17; }
    .mira-connected .mira-connection::before { background: #16967f; }
    .mira-header-actions { display: flex; gap: 3px; }
    .mira-header-actions button { display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: 12px; background: transparent; color: #68778e; }
    .mira-header-actions button:hover { color: var(--mira-color); background: var(--mira-soft); }
    .mira-messages { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 28px 24px 20px; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #d5dfed transparent; }
    .mira-welcome { max-width: 680px; margin: 0 auto; padding: 8px 0 12px; }
    .mira-welcome-eyebrow { display: flex; align-items: center; justify-content: center; gap: 6px; color: var(--mira-teal); font-size: 11px; margin-bottom: 10px; }
    .mira-welcome-eyebrow svg { width: 16px; height: 16px; }
    .mira-welcome h1 { font-family: inherit; font-size: 27px; line-height: 1.7; text-align: center; font-weight: 800; color: var(--mira-ink); margin: 0 0 12px; letter-spacing: normal; }
    .mira-welcome h1 span { color: var(--mira-color); }
    .mira-welcome p { font-family: inherit; text-align: center; color: var(--mira-muted); font-size: 13px; line-height: 1.9; margin: 0 auto 24px; max-width: 430px; }
    .mira-intents { display: grid; gap: 10px; }
    .mira-panel .mira-intent { display: flex; align-items: center; gap: 14px; width: 100%; border: 1px solid var(--mira-line); border-radius: 18px; background: white; padding: 16px; text-align: start; transition: border-color .2s, background .2s, transform .2s; }
    .mira-panel .mira-intent:hover { border-color: #9fbaf0; background: #fafcff; transform: translateY(-2px); }
    .mira-intent-icon { display: grid; place-items: center; flex-shrink: 0; width: 46px; height: 46px; border-radius: 15px; background: #eef4ff; color: var(--mira-color); }
    .mira-intent:nth-child(2) .mira-intent-icon { color: #137d71; background: #edf8f5; }
    .mira-intent:nth-child(3) .mira-intent-icon { color: #9a6514; background: #fbf5e9; }
    .mira-intent-copy { flex: 1; min-width: 0; }
    .mira-intent strong { display: block; font-size: 14px; font-weight: 700; }
    .mira-intent small { display: block; font-size: 11px; color: var(--mira-muted); margin-top: 3px; }
    .mira-intent > svg { width: 18px; color: #9aabc2; }
    .mira-quick-title { font-size: 11px; color: var(--mira-muted); margin: 22px 0 10px; text-align: center; }
    .mira-quick { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
    .mira-quick button { padding: 9px 13px; min-height: 44px; border: 1px solid var(--mira-line); border-radius: 24px; background: white; color: var(--mira-color); font-size: 12px; }
    .mira-quick button:hover { background: #f2f6fd; border-color: #b6cbee; }
    .mira-msg { width: fit-content; max-width: 94%; margin-bottom: 24px; padding: 16px 18px; border-radius: 20px; font-size: 14px; line-height: 1.95; color: var(--mira-ink); animation: mira-enter .25s ease-out both; }
    .mira-msg-visitor { background: #eef4ff; border: 1px solid #e2eafb; color: #294b84; margin-inline-start: auto; border-end-start-radius: 6px; }
    .mira-msg-agent, .mira-msg-bot { margin-inline-end: auto; padding-inline: 0; max-width: 100%; width: 100%; }
    .mira-msg-meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 7px; color: var(--mira-muted); font-size: 10px; }
    .mira-msg-bot .mira-msg-meta > span { color: #44689d; }
    .mira-msg-body { white-space: pre-wrap; overflow-wrap: anywhere; }
    .mira-msg-visitor .mira-msg-meta { color: #5a7094; }
    .mira-panel .mira-copy { display: flex; align-items: center; gap: 5px; min-width: 44px; min-height: 44px; padding: 0 6px; border: 0; border-radius: 8px; background: transparent; color: var(--mira-muted); font-size: 10px; }
    .mira-copy svg { width: 14px; height: 14px; }
    .mira-copy:hover { color: var(--mira-color); background: var(--mira-soft); }
    .mira-footer { padding: 10px 18px 12px; flex-shrink: 0; border-top: 1px solid var(--mira-line); background: white; }
    .mira-actions { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 10px; padding: 2px; scrollbar-width: none; }
    .mira-actions button { display: flex; align-items: center; justify-content: center; gap: 5px; min-height: 44px; padding: 7px 10px; flex: 1 0 auto; border: 1px solid var(--mira-line); border-radius: 12px; background: white; color: #536a8c; font-size: 11px; white-space: nowrap; }
    .mira-actions button:first-child { background: #f2f6ff; border-color: #dae5fa; color: var(--mira-color); }
    .mira-actions button:hover { border-color: #adc3e8; }
    .mira-actions svg { width: 17px; height: 17px; }
    .mira-input-row { display: flex; align-items: flex-end; gap: 8px; padding: 12px; border: 1px solid #dbe4f2; border-radius: 19px; background: #fff; transition: border-color .2s, box-shadow .2s; }
    .mira-input-row:focus-within { border-color: var(--mira-color); box-shadow: 0 0 0 3px #2e6be60b; }
    .mira-panel .mira-input { display: block; flex: 1; min-width: 0; width: 0; min-height: 44px; max-height: 120px; resize: none; margin: 0; padding: 9px 3px; border: 0; border-radius: 0; outline: none; box-shadow: none; background: transparent; color: var(--mira-ink); font-family: inherit; font-size: 14px; line-height: 1.85; direction: rtl; text-align: start; }
    .mira-panel .mira-input::placeholder { color: #7889a2; opacity: 1; }
    .mira-panel .mira-send { display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; padding: 0; border: 0; border-radius: 13px; background: var(--mira-color); color: white; transition: filter .2s, transform .2s; }
    .mira-send:not(:disabled):hover { filter: brightness(1.1); transform: translateY(-2px); }
    .mira-panel .mira-send:disabled { background: #eaf0f9; color: #9aadc9; opacity: 1; }
    .mira-tools { display: flex; justify-content: space-between; gap: 8px; color: #718198; font-size: 10px; padding: 8px 4px 0; }
    .mira-error { color: #a33437; font-size: 11px; line-height: 1.8; }
    .mira-error:not(:empty) { padding: 0 2px 9px; }
    .mira-typing { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--mira-muted); padding-inline: 24px; }
    .mira-typing:not(:empty) { padding-block: 8px; }
    .mira-ai-status { margin-inline: 18px; font-size: 11px; line-height: 1.8; color: #116f63; }
    .mira-ai-status:not(:empty) { display: flex; align-items: center; gap: 10px; border: 1px solid #dcefe9; background: #f3fbf8; border-radius: 14px; margin-bottom: 10px; padding: 10px 12px; animation: mira-enter .25s ease-out both; }
    .mira-thinking { display: grid; place-items: center; width: 26px; height: 26px; color: #168b79; animation: mira-spark 1.8s ease-in-out infinite; font-size: 22px; }
    .mira-dots { display: inline-flex; gap: 3px; }
    .mira-dots i { width: 4px; height: 4px; border-radius: 50%; background: currentColor; animation: mira-dot 1.2s ease-in-out infinite; }
    .mira-dots i:nth-child(2) { animation-delay: .15s; } .mira-dots i:nth-child(3) { animation-delay: .3s; }
    .mira-ai-status .mira-dots { margin-inline-start: auto; }
    .mira-product-result { margin-top: 20px; border: 1px solid var(--mira-line); border-radius: 21px; padding: 16px; white-space: normal; }
    .mira-product-heading { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; margin-bottom: 10px; }
    .mira-product-heading small { color: var(--mira-muted); font-size: 10px; font-weight: 400; margin-inline-start: auto; }
    .mira-product-heading svg { color: var(--mira-color); width: 19px; }
    .mira-product-controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 12px; color: var(--mira-muted); font-size: 10px; }
    .mira-product-controls select { max-width: 100%; min-height: 44px; border: 1px solid var(--mira-line); border-radius: 10px; padding: 6px 8px; background: #fff; color: var(--mira-ink); font-size: 11px; }
    .mira-product-controls label { display: flex; align-items: center; gap: 5px; min-height: 44px; cursor: pointer; }
    .mira-product-controls input { width: 16px; height: 16px; accent-color: var(--mira-color); }
    .mira-products { display: flex; gap: 12px; overflow-x: auto; padding: 2px 2px 10px; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; scrollbar-width: thin; scrollbar-color: #cedbeb transparent; }
    .mira-panel .mira-product { display: flex; flex-direction: column; flex: 0 0 220px; min-width: 0; padding: 12px; border: 1px solid var(--mira-line); border-radius: 17px; background: white; color: var(--mira-ink); text-decoration: none; scroll-snap-align: start; transition: border-color .2s, box-shadow .2s; }
    .mira-product:hover { border-color: #aac3ef; box-shadow: 0 5px 16px #2647790d; }
    .mira-product img, .mira-product-icon { display: grid; place-items: center; width: 100%; height: 164px; object-fit: contain; border-radius: 12px; background: #f5f7fa; color: #8ca3c0; margin-bottom: 12px; padding: 12px; }
    .mira-product-icon svg { width: 46px; height: 46px; }
    .mira-product strong { display: block; min-width: 0; overflow-wrap: anywhere; font-family: inherit; font-size: 12px; font-weight: 700; line-height: 1.9; margin-bottom: 8px; }
    .mira-product small { display: block; font-size: 10px; color: var(--mira-teal); margin-bottom: 8px; }
    .mira-product small.mira-out-of-stock { color: #8c5560; }
    .mira-product b { display: block; margin-top: auto; font-size: 14px; font-weight: 800; }
    .mira-product-link { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; margin-top: 12px; border-radius: 10px; background: #edf3ff; color: var(--mira-color); font-size: 11px; font-weight: 700; }
    .mira-product-link svg { width: 15px; height: 15px; }
    .mira-product-empty { font-size: 12px; color: var(--mira-muted); padding: 16px 0; }
    .mira-source { display: inline-flex; align-items: center; gap: 5px; min-height: 44px; max-width: 100%; overflow-wrap: anywhere; padding: 6px 10px; margin-block-start: 8px; margin-inline-end: 6px; border: 1px solid var(--mira-line); border-radius: 10px; background: white; color: #536d89; text-decoration: none; font-size: 10px; white-space: normal; }
    .mira-csat { margin-block: 12px; padding: 20px; border-radius: 18px; background: var(--mira-soft); border: 1px solid var(--mira-line); font-size: 13px; text-align: center; }
    .mira-csat-stars { display: flex; justify-content: center; gap: 5px; margin-block: 12px; }
    .mira-panel .mira-csat-star { width: 44px; height: 44px; border: 0; border-radius: 10px; background: white; color: #8190a5; font-size: 27px; }
    .mira-panel .mira-csat-star.mira-active { color: #b77b0e; background: #fff7e5; }
    .mira-panel .mira-csat-submit { width: 100%; min-height: 44px; border: 0; border-radius: 11px; background: var(--mira-color); color: white; font-size: 12px; }
    .mira-fullscreen .mira-messages { padding-inline: max(32px, calc((100% - 1020px) / 2)); padding-top: 40px; }
    .mira-fullscreen .mira-footer { padding-inline: max(32px, calc((100% - 1020px) / 2)); padding-bottom: 20px; }
    .mira-fullscreen .mira-ai-status, .mira-fullscreen .mira-typing { margin-inline: max(32px, calc((100% - 1020px) / 2)); }
    .mira-fullscreen .mira-header { padding-inline: 30px; }
    .mira-fullscreen .mira-welcome { padding-top: 16px; }
    .mira-fullscreen .mira-welcome h1 { font-size: 36px; }
    .mira-fullscreen .mira-actions { justify-content: flex-start; }
    .mira-fullscreen .mira-actions button { flex: 0 0 auto; padding-inline: 15px; }
    .mira-fullscreen .mira-product { flex-basis: 240px; }
    @keyframes mira-enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    @keyframes mira-dot { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }
    @keyframes mira-spark { 0%,100% { transform: scale(.9) rotate(-8deg); opacity: .65; } 50% { transform: scale(1.05) rotate(8deg); opacity: 1; } }
    @media (max-width: 600px) {
      .mira-panel { bottom: 88px; max-width: calc(100vw - 20px); max-height: calc(100dvh - 102px); border-radius: 23px; }
      .mira-pos-right.mira-panel { right: 10px; } .mira-pos-left.mira-panel { left: 10px; }
      .mira-pos-right.mira-bubble, .mira-pos-right.mira-trigger { right: 16px; } .mira-pos-left.mira-bubble, .mira-pos-left.mira-trigger { left: 16px; }
      .mira-bubble { bottom: max(16px, env(safe-area-inset-bottom)); height: 58px; font-size: 13px; }
      .mira-icon-chat { width: 42px; height: 42px; }
      .mira-header { padding: 12px 14px; gap: 9px; }
      .mira-header-title { font-size: 13px; } .mira-header-sub { max-width: 190px; font-size: 10px; }
      .mira-header-logo, .mira-header-logo img { width: 38px; height: 38px; }
      .mira-header-actions { gap: 0; } .mira-header-actions button { width: 44px; }
      .mira-messages { padding: 20px 16px 10px; }
      .mira-welcome h1 { font-size: 23px; } .mira-welcome p { font-size: 12px; margin-bottom: 18px; }
      .mira-panel .mira-intent { padding: 13px; gap: 10px; } .mira-intent small { font-size: 10px; }
      .mira-intent-icon { width: 40px; height: 40px; }
      .mira-footer { padding: 8px 12px 10px; }
      .mira-actions { gap: 5px; margin-bottom: 7px; } .mira-actions button { padding-inline: 8px; font-size: 10px; }
      .mira-input-row { padding: 8px; } .mira-panel .mira-input { font-size: 16px; }
      .mira-tools { font-size: 9px; }
      .mira-product-result { padding: 12px; } .mira-panel .mira-product { flex-basis: 208px; }
      .mira-panel.mira-fullscreen { inset: 0; border-radius: 0; max-width: none; max-height: none; padding-top: env(safe-area-inset-top); }
      .mira-fullscreen .mira-messages { padding: 20px 16px; }
      .mira-fullscreen .mira-footer { padding: 8px 12px max(12px, env(safe-area-inset-bottom)); }
      .mira-fullscreen .mira-header { padding: 12px 14px; }
      .mira-fullscreen .mira-welcome h1 { font-size: 25px; }
      .mira-fullscreen .mira-ai-status, .mira-fullscreen .mira-typing { margin-inline: 12px; }
    }
    @media (max-height: 600px) {
      .mira-panel:not(.mira-fullscreen) { bottom: 80px; max-height: calc(100dvh - 92px); }
      .mira-header { padding-block: 8px; } .mira-header-sub { display: none; }
      .mira-tools { display: none; } .mira-footer { padding-block: 6px; }
      .mira-actions { margin-bottom: 5px; } .mira-input-row { padding-block: 5px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .mira-panel, .mira-panel *, .mira-bubble, .mira-trigger { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
    }
  `;
  document.head.appendChild(style);
}
