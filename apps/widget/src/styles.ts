const STYLE_ID = 'mira-widget-styles';

// استایل همراه باندل است؛ رنگ و موقعیت سفارشی سایت میزبان حفظ می‌شود.
export function injectStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .mira-panel, .mira-bubble, .mira-trigger {
      --mira-color: #2e6be6; --mira-color-ink: #2558be; --mira-color-soft: #f0f5fd;
      --mira-color-border: #cbdafa; --mira-color-foreground: #fff; --mira-color-ring: #2e6be622; --mira-color-shadow: #2e6be626;
      --mira-accent: #168b6a; --mira-accent-ink: #117457; --mira-accent-soft: #eff7f5;
      --mira-accent-border: #c5e2da; --mira-accent-foreground: #fff; --mira-accent-ring: #168b6a22; --mira-accent-shadow: #168b6a26;
      --mira-ink: #1c2b49; --mira-muted: #64748b;
      --mira-line: #e5ebf4; --mira-soft: #f7f9fa; --mira-teal: var(--mira-accent-ink);
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
    .mira-bubble:focus-visible, .mira-trigger button:focus-visible { outline: 3px solid var(--mira-color-ink); outline-offset: 3px; }
    .mira-panel svg, .mira-bubble svg { display: block; flex-shrink: 0; }
    .mira-bubble {
      position: fixed; bottom: max(20px, env(safe-area-inset-bottom)); display: flex; align-items: center;
      gap: 14px; height: 64px; padding: 8px 10px 8px 22px; border: 0; border-radius: 36px;
      background: var(--mira-color); color: var(--mira-color-foreground); font-size: 15px; font-weight: 700;
      box-shadow: 0 8px 28px var(--mira-color-shadow); z-index: 999998; transition: transform .2s, box-shadow .2s;
      animation: mira-enter .3s ease-out both;
    }
    .mira-bubble:hover { transform: translateY(-3px); box-shadow: 0 12px 32px var(--mira-color-shadow); }
    .mira-icon-chat { display: grid; place-items: center; width: 46px; height: 46px; background: var(--mira-surface, #fff); color: var(--mira-color-ink); border-radius: 50%; }
    .mira-icon-chat svg { width: 28px; height: 28px; }
    .mira-bubble { max-width: calc(100vw - 48px); }
    .mira-launcher-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mira-icon-chat { flex-shrink: 0; }
    .mira-icon-close { display: none; }
    .mira-bubble.mira-bubble-open { width: 56px; height: 56px; padding: 0; justify-content: center; }
    .mira-bubble-open .mira-icon-chat, .mira-bubble-open .mira-launcher-label { display: none; }
    .mira-bubble-open .mira-icon-close { display: block; }
    .mira-bubble.mira-launcher-hidden { visibility: hidden; pointer-events: none; }
    .mira-pos-right.mira-bubble, .mira-pos-right.mira-trigger, .mira-pos-right.mira-panel { right: 24px; }
    .mira-pos-left.mira-bubble, .mira-pos-left.mira-trigger, .mira-pos-left.mira-panel { left: 24px; }
    .mira-trigger {
      position: fixed; bottom: 100px; max-width: min(280px, calc(100vw - 48px)); padding: 16px;
      border: 1px solid var(--mira-line); border-radius: 20px; background: var(--mira-surface, #fff); box-shadow: 0 8px 32px #1c2b4918;
      z-index: 999997; opacity: 0; visibility: hidden; transform: translateY(8px); pointer-events: none;
      transition: opacity .2s, transform .2s, visibility .2s;
    }
    .mira-trigger.mira-open { opacity: 1; visibility: visible; transform: none; pointer-events: auto; }
    .mira-trigger .mira-trigger-open { border: 0; background: none; padding: 0; color: inherit; text-align: start; }
    .mira-trigger .mira-trigger-close { position: absolute; inset-inline-start: -12px; top: -14px; width: 44px; height: 44px; border: 1px solid var(--mira-line); border-radius: 50%; background: var(--mira-surface, #fff); color: var(--mira-muted); }
    .mira-backdrop { position: fixed; inset: 0; background: #172d4e52; backdrop-filter: blur(5px); z-index: 999998; display: none; }
    .mira-backdrop.mira-open { display: block; }
    .mira-panel {
      position: fixed; bottom: 96px; width: var(--mira-panel-width, 560px); max-width: calc(100vw - 48px); height: 760px;
      max-height: calc(100dvh - 120px); background: var(--mira-surface, #fff); border-radius: var(--mira-panel-radius, 28px); border: 1px solid var(--mira-line);
      box-shadow: 0 24px 80px #142b5526, 0 4px 16px #142b550a; display: flex; flex-direction: column;
      overflow: hidden; z-index: 999999; opacity: 0; visibility: hidden; pointer-events: none;
      transform: translateY(16px) scale(.98); transition: opacity .2s, transform .25s, visibility .25s;
      isolation: isolate; color-scheme: light;
    }
    .mira-panel.mira-open { opacity: 1; visibility: visible; pointer-events: auto; transform: none; }
    .mira-panel.mira-fullscreen {
      inset: 16px; width: auto; height: auto; max-width: none; max-height: none; border-radius: 24px;
    }
    .mira-header { display: flex; align-items: center; gap: 12px; padding: 18px 22px; border-bottom: 1px solid var(--mira-accent-border); flex-shrink: 0; background: var(--mira-surface, #fff); box-shadow: inset 0 3px var(--mira-accent); }
    .mira-header-logo { display: grid; place-items: center; width: 46px; height: 46px; flex-shrink: 0; border-radius: 17px 17px 17px 7px; color: var(--mira-accent-ink); background: var(--mira-accent-soft); }
    .mira-header-logo svg { width: 29px; height: 29px; }
    .mira-header-logo img { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; }
    .mira-header-identity { flex: 1; min-width: 0; }
    .mira-header-title { display: block; font-size: 15px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mira-header-sub { display: block; color: var(--mira-muted); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mira-connection { display: flex; align-items: center; gap: 5px; margin-top: 2px; font-size: 11px; color: var(--mira-muted); }
    .mira-connection::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #9b6b17; }
    .mira-connected .mira-connection::before { background: var(--mira-accent); }
    .mira-header-actions { display: flex; gap: 3px; }
    .mira-header-actions button { display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: 12px; background: transparent; color: var(--mira-muted); }
    .mira-header-actions button:hover { color: var(--mira-color-ink); background: var(--mira-color-soft); }
    .mira-messages { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 28px 24px 20px; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--mira-color-border) transparent; }
    .mira-welcome { max-width: 720px; margin: 0 auto; padding: 4px 0 12px; }
    .mira-welcome-hero { display: flex; align-items: center; gap: 20px; margin-bottom: 14px; }
    .mira-welcome-heading { flex: 1; min-width: 0; }
    .mira-welcome-eyebrow { display: inline-flex; align-items: center; gap: 6px; color: var(--mira-accent-ink); background: var(--mira-accent-soft); border-radius: 7px; padding: 4px 8px; font-size: 10px; margin-bottom: 12px; }
    .mira-welcome-eyebrow svg { width: 16px; height: 16px; }
    .mira-welcome h1 { font-family: inherit; font-size: 26px; line-height: 1.65; text-align: start; white-space: pre-line; overflow-wrap: anywhere; font-weight: 800; color: var(--mira-ink); margin: 0; letter-spacing: normal; }
    .mira-welcome h1 span { color: var(--mira-accent-ink); }
    .mira-welcome-mark { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; flex-shrink: 0; width: 86px; height: 106px; border: 1px solid var(--mira-accent-border); border-radius: 30px 30px 30px 8px; background: var(--mira-accent-soft); color: var(--mira-accent-ink); transform: rotate(-5deg); }
    .mira-welcome-mark > svg { width: 40px; height: 40px; }
    .mira-welcome-mark > span { font-size: 10px; }
    .mira-welcome p { font-family: inherit; text-align: start; color: var(--mira-muted); font-size: 12px; line-height: 1.9; margin: 0 0 22px; max-width: 480px; }
    .mira-intents { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .mira-panel .mira-intent { text-decoration: none; color: inherit; position: relative; display: grid; grid-template-columns: 1fr auto; align-items: start; gap: 10px; width: 100%; min-width: 0; min-height: 128px; border: 1px solid var(--mira-line); border-radius: 18px; background: var(--mira-surface, #fff); padding: 16px; text-align: start; transition: border-color .2s, background .2s, transform .2s; }
    .mira-panel .mira-intent:hover { border-color: var(--mira-color-border); background: var(--mira-color-soft); transform: translateY(-2px); }
    .mira-panel .mira-intent:first-child { grid-column: 1 / -1; display: flex; align-items: center; min-height: 108px; gap: 16px; padding: 20px; border-color: var(--mira-accent-border); background: var(--mira-accent-soft); }
    .mira-panel .mira-intent:first-child:hover { border-color: var(--mira-accent); box-shadow: 0 5px 18px var(--mira-accent-ring); }
    .mira-intent-icon { display: grid; place-items: center; flex-shrink: 0; width: 38px; height: 38px; border-radius: 12px; background: var(--mira-color-soft); color: var(--mira-color-ink); }
    .mira-intent:first-child .mira-intent-icon { width: 50px; height: 50px; border-radius: 16px 16px 16px 6px; color: var(--mira-accent-foreground); background: var(--mira-accent); }
    .mira-intent:first-child strong { color: var(--mira-accent-ink); font-size: 16px; }
    .mira-intent:first-child > svg { color: var(--mira-accent-ink); }
    .mira-intent:nth-child(3) .mira-intent-icon { color: var(--mira-accent-ink); background: var(--mira-accent-soft); }
    .mira-intent-copy { flex: 1; min-width: 0; grid-column: 1; }
    .mira-intent strong { display: block; overflow-wrap: anywhere; font-size: 14px; font-weight: 700; }
    .mira-intent small { display: block; overflow-wrap: anywhere; font-size: 11px; color: var(--mira-muted); margin-top: 3px; }
    .mira-intent > svg { width: 18px; color: var(--mira-muted); grid-column: 2; grid-row: 2; align-self: center; }
    .mira-quick-title { font-size: 10px; color: var(--mira-muted); margin: 20px 0 10px; text-align: start; }
    .mira-quick { display: flex; flex-wrap: wrap; justify-content: flex-start; gap: 8px; }
    .mira-quick button { padding: 9px 13px; min-height: 44px; border: 1px solid var(--mira-line); border-radius: 11px; background: var(--mira-surface, #fff); color: var(--mira-color-ink); font-size: 11px; }
    .mira-quick button:hover { background: var(--mira-color-soft); border-color: var(--mira-color-border); }
    .mira-msg { width: fit-content; max-width: 94%; margin-bottom: 24px; padding: 16px 18px; border-radius: 20px; font-size: 14px; line-height: 1.95; color: var(--mira-ink); animation: mira-enter .25s ease-out both; }
    .mira-msg-visitor { background: var(--mira-color-soft); border: 1px solid var(--mira-color-border); color: var(--mira-color-ink); margin-inline-start: auto; border-end-start-radius: 6px; }
    .mira-msg-agent, .mira-msg-bot { margin-inline-end: auto; padding-inline: 0; max-width: 100%; width: 100%; }
    .mira-msg-meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 7px; color: var(--mira-muted); font-size: 10px; }
    .mira-msg-bot .mira-msg-meta > span { color: var(--mira-accent-ink); }
    .mira-msg-body { white-space: pre-wrap; overflow-wrap: anywhere; }
    .mira-msg-visitor .mira-msg-meta { color: var(--mira-color-ink); }
    .mira-panel .mira-copy { display: flex; align-items: center; gap: 5px; min-width: 44px; min-height: 44px; padding: 0 6px; border: 0; border-radius: 8px; background: transparent; color: var(--mira-muted); font-size: 10px; }
    .mira-copy svg { width: 14px; height: 14px; }
    .mira-copy:hover { color: var(--mira-color-ink); background: var(--mira-color-soft); }
    .mira-footer { padding: 10px 18px 12px; flex-shrink: 0; border-top: 1px solid var(--mira-line); background: var(--mira-surface, #fff); }
    .mira-actions { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 10px; padding: 2px; scrollbar-width: none; }
    .mira-actions .mira-action { display: flex; align-items: center; justify-content: center; gap: 5px; min-height: 44px; padding: 7px 10px; flex: 1 0 auto; border: 1px solid var(--mira-line); border-radius: 12px; background: var(--mira-surface, #fff); color: var(--mira-muted); font-size: 11px; white-space: nowrap; }
    .mira-actions .mira-action:first-child { background: var(--mira-accent-soft); border-color: var(--mira-accent-border); color: var(--mira-accent-ink); }
    .mira-actions .mira-action:hover { border-color: var(--mira-accent-border); color: var(--mira-accent-ink); }
    .mira-actions svg { width: 17px; height: 17px; }
    .mira-input-row { display: flex; align-items: flex-end; gap: 8px; padding: 12px; border: 1px solid var(--mira-accent-border); border-radius: 19px; background: var(--mira-surface, #fff); transition: border-color .2s, box-shadow .2s; }
    .mira-input-row:focus-within { border-color: var(--mira-accent-ink); box-shadow: 0 0 0 3px var(--mira-accent-ring); }
    .mira-panel .mira-input { display: block; flex: 1; min-width: 0; width: 0; min-height: 44px; max-height: 120px; resize: none; margin: 0; padding: 9px 3px; border: 0; border-radius: 0; outline: none; box-shadow: none; background: transparent; color: var(--mira-ink); font-family: inherit; font-size: 14px; line-height: 1.85; direction: rtl; text-align: start; }
    .mira-panel .mira-input::placeholder { color: var(--mira-muted); opacity: 1; }
    .mira-panel .mira-send { display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; padding: 0; border: 0; border-radius: 13px; background: var(--mira-accent); color: var(--mira-accent-foreground); transition: filter .2s, transform .2s; }
    .mira-send:not(:disabled):hover { filter: brightness(1.1); transform: translateY(-2px); }
    .mira-panel .mira-send:disabled { background: var(--mira-accent-soft); color: var(--mira-accent-ink); opacity: .5; }
    .mira-tools { display: flex; justify-content: space-between; gap: 8px; color: var(--mira-muted); font-size: 10px; padding: 8px 4px 0; }
    .mira-error { color: var(--mira-danger, #a33437); font-size: 11px; line-height: 1.8; }
    .mira-error:not(:empty) { padding: 0 2px 9px; }
    .mira-typing { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--mira-muted); padding-inline: 24px; }
    .mira-typing:not(:empty) { padding-block: 8px; }
    .mira-ai-status { margin-inline: 18px; font-size: 11px; line-height: 1.8; color: var(--mira-accent-ink); }
    .mira-ai-status:not(:empty) { display: flex; align-items: center; gap: 10px; border: 1px solid var(--mira-accent-border); background: var(--mira-accent-soft); border-radius: 14px; margin-bottom: 10px; padding: 10px 12px; animation: mira-enter .25s ease-out both; }
    .mira-thinking { display: grid; place-items: center; width: 26px; height: 26px; color: var(--mira-accent-ink); animation: mira-spark 1.8s ease-in-out infinite; font-size: 22px; }
    .mira-dots { display: inline-flex; gap: 3px; }
    .mira-dots i { width: 4px; height: 4px; border-radius: 50%; background: currentColor; animation: mira-dot 1.2s ease-in-out infinite; }
    .mira-dots i:nth-child(2) { animation-delay: .15s; } .mira-dots i:nth-child(3) { animation-delay: .3s; }
    .mira-ai-status .mira-dots { margin-inline-start: auto; }
    .mira-product-result { margin-top: 20px; border: 1px solid var(--mira-accent-border); border-radius: 21px; padding: 16px; white-space: normal; box-shadow: 0 4px 0 var(--mira-accent-soft); }
    .mira-product-heading { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; margin-bottom: 10px; }
    .mira-product-heading small { color: var(--mira-muted); font-size: 10px; font-weight: 400; margin-inline-start: auto; }
    .mira-product-heading svg { color: var(--mira-accent-ink); width: 19px; }
    .mira-product-controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 12px; color: var(--mira-muted); font-size: 10px; }
    .mira-product-controls select { max-width: 100%; min-height: 44px; border: 1px solid var(--mira-line); border-radius: 10px; padding: 6px 8px; background: var(--mira-surface, #fff); color: var(--mira-ink); font-size: 11px; }
    .mira-product-controls label { display: flex; align-items: center; gap: 5px; min-height: 44px; cursor: pointer; }
    .mira-product-controls input { width: 16px; height: 16px; accent-color: var(--mira-accent); }
    .mira-products { display: flex; gap: 12px; overflow-x: auto; padding: 2px 2px 10px; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; scrollbar-width: thin; scrollbar-color: var(--mira-accent-border) transparent; }
    .mira-panel .mira-product { display: flex; flex-direction: column; flex: 0 0 220px; min-width: 0; padding: 12px; border: 1px solid var(--mira-line); border-radius: 17px; background: var(--mira-surface, #fff); color: var(--mira-ink); text-decoration: none; scroll-snap-align: start; transition: border-color .2s, box-shadow .2s; }
    .mira-product:hover { border-color: var(--mira-accent-border); box-shadow: 0 5px 16px var(--mira-accent-ring); }
    .mira-product img, .mira-product-icon { display: grid; place-items: center; width: 100%; height: 164px; object-fit: contain; border-radius: 12px; background: var(--mira-soft); color: var(--mira-accent-ink); margin-bottom: 12px; padding: 12px; }
    .mira-product-icon svg { width: 46px; height: 46px; }
    .mira-product strong { display: block; min-width: 0; overflow-wrap: anywhere; font-family: inherit; font-size: 12px; font-weight: 700; line-height: 1.9; margin-bottom: 8px; }
    .mira-product small { display: block; font-size: 10px; color: var(--mira-success, #137d71); margin-bottom: 8px; }
    .mira-product small.mira-out-of-stock { color: var(--mira-danger, #8c5560); }
    .mira-product b { display: block; margin-top: auto; font-size: 14px; font-weight: 800; }
    .mira-product-link { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; margin-top: 12px; border-radius: 10px; background: var(--mira-accent-soft); color: var(--mira-accent-ink); font-size: 11px; font-weight: 700; }
    .mira-product-link svg { width: 15px; height: 15px; }
    .mira-product-empty { font-size: 12px; color: var(--mira-muted); padding: 16px 0; }
    .mira-source { display: inline-flex; align-items: center; gap: 5px; min-height: 44px; max-width: 100%; overflow-wrap: anywhere; padding: 6px 10px; margin-block-start: 8px; margin-inline-end: 6px; border: 1px solid var(--mira-color-border); border-radius: 10px; background: var(--mira-surface, #fff); color: var(--mira-color-ink); text-decoration: none; font-size: 10px; white-space: normal; }
    .mira-csat { margin-block: 12px; padding: 20px; border-radius: 18px; background: var(--mira-soft); border: 1px solid var(--mira-line); font-size: 13px; text-align: center; }
    .mira-csat-stars { display: flex; justify-content: center; gap: 5px; margin-block: 12px; }
    .mira-panel .mira-csat-star { width: 44px; height: 44px; border: 0; border-radius: 10px; background: var(--mira-surface, #fff); color: #8190a5; font-size: 27px; }
    .mira-panel .mira-csat-star.mira-active { color: #b77b0e; background: #fff7e5; }
    .mira-panel .mira-csat-submit { width: 100%; min-height: 44px; border: 0; border-radius: 11px; background: var(--mira-accent); color: var(--mira-accent-foreground); font-size: 12px; }
    .mira-fullscreen .mira-messages { padding-inline: max(32px, calc((100% - 1020px) / 2)); padding-top: 40px; }
    .mira-fullscreen .mira-footer { padding-inline: max(32px, calc((100% - 1020px) / 2)); padding-bottom: 20px; }
    .mira-fullscreen .mira-ai-status, .mira-fullscreen .mira-typing { margin-inline: max(32px, calc((100% - 1020px) / 2)); }
    .mira-fullscreen .mira-header { padding-inline: 30px; }
    .mira-fullscreen .mira-welcome { padding-top: 16px; }
    .mira-fullscreen .mira-welcome h1 { font-size: 34px; }
    .mira-fullscreen .mira-welcome-mark { width: 114px; height: 136px; }
    .mira-fullscreen .mira-actions { justify-content: flex-start; }
    .mira-fullscreen .mira-actions .mira-action { flex: 0 0 auto; padding-inline: 15px; }
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
      .mira-welcome-hero { gap: 12px; margin-bottom: 12px; }
      .mira-welcome h1 { font-size: 21px; } .mira-welcome p { font-size: 12px; margin-bottom: 18px; }
      .mira-welcome-mark, .mira-fullscreen .mira-welcome-mark { width: 66px; height: 90px; border-radius: 24px 24px 24px 6px; gap: 5px; }
      .mira-welcome-mark > svg { width: 32px; height: 32px; } .mira-welcome-mark > span { font-size: 9px; }
      .mira-panel .mira-intent { text-decoration: none; color: inherit; padding: 13px; gap: 10px; } .mira-intent small { font-size: 10px; }
      .mira-panel .mira-intent:first-child { padding: 16px; gap: 12px; min-height: 100px; }
      .mira-intent:first-child strong { font-size: 15px; }
      .mira-intent-icon { width: 34px; height: 34px; }
      .mira-intent:first-child .mira-intent-icon { width: 44px; height: 44px; }
      .mira-footer { padding: 8px 12px 10px; }
      .mira-actions { gap: 5px; margin-bottom: 7px; } .mira-actions .mira-action { padding-inline: 8px; font-size: 10px; }
      .mira-input-row { padding: 8px; } .mira-panel .mira-input { font-size: 16px; }
      .mira-tools { font-size: 9px; }
      .mira-product-result { padding: 12px; } .mira-panel .mira-product { flex-basis: 208px; }
      .mira-panel.mira-fullscreen { inset: 0; border-radius: 0; max-width: none; max-height: none; padding-top: env(safe-area-inset-top); }
      .mira-fullscreen .mira-messages { padding: 20px 16px; }
      .mira-fullscreen .mira-footer { padding: 8px 12px max(12px, env(safe-area-inset-bottom)); }
      .mira-fullscreen .mira-header { padding: 12px 14px; }
      .mira-fullscreen .mira-welcome h1 { font-size: 23px; }
      .mira-fullscreen .mira-ai-status, .mira-fullscreen .mira-typing { margin-inline: 12px; }
    }
    @media (max-height: 600px) {
      .mira-panel:not(.mira-fullscreen) { bottom: 80px; max-height: calc(100dvh - 92px); }
      .mira-header { padding-block: 8px; } .mira-header-sub { display: none; }
      .mira-tools { display: none; } .mira-footer { padding-block: 6px; }
      .mira-actions { margin-bottom: 5px; } .mira-input-row { padding-block: 5px; }
    }
    .mira-actions .mira-action { text-decoration: none; }
    .mira-icon-chat img { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; }
    .mira-welcome-avatar { display: grid; place-items: center; }
    .mira-welcome-avatar svg { width: 40px; height: 40px; }
    .mira-welcome-avatar img { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; }
    .mira-launcher-icon:not(.mira-bubble-open) { width: 64px; padding: 0; justify-content: center; }
    .mira-launcher-icon .mira-launcher-label { display: none; }
    .mira-hide-copy .mira-copy, .mira-hide-products .mira-product-result, .mira-hide-sources .mira-source { display: none; }
    .mira-panel:not(.mira-fullscreen) { border-radius: var(--mira-panel-radius, 24px); }
    .mira-panel .mira-intent, .mira-panel .mira-product, .mira-product-result, .mira-csat { border-radius: var(--mira-card-radius, 16px); }
    .mira-panel[data-density="compact"] .mira-header { padding-block: 10px; }
    .mira-panel[data-density="compact"] .mira-messages { padding-block: 16px; }
    .mira-panel[data-density="compact"] .mira-intent { min-height: 108px; padding: 12px; }
    .mira-panel[data-density="compact"] .mira-intent:first-child { min-height: 86px; }
    .mira-panel[data-density="compact"] .mira-msg { margin-bottom: 14px; padding-block: 10px; }
    .mira-panel[data-density="compact"] .mira-footer { padding-block: 7px; }
    .mira-panel[data-density="compact"] .mira-input-row { padding-block: 7px; }
    .mira-panel[data-panel-motion="none"] { transition: none; transform: none; }
    .mira-panel[data-panel-motion="scale"]:not(.mira-open) { transform: scale(.96); }
    .mira-panel[data-panel-motion="reveal"] { clip-path: inset(0 round var(--mira-panel-radius, 24px)); transition: opacity .22s, transform .22s, visibility .22s, clip-path .25s; }
    .mira-panel[data-panel-motion="reveal"]:not(.mira-open) { transform: translateY(8px); clip-path: inset(10% 0 0 round var(--mira-panel-radius, 24px)); }
    .mira-panel[data-panel-motion="rise"].mira-open.mira-replay { animation: mira-panel-rise .24s ease-out both; }
    .mira-panel[data-panel-motion="scale"].mira-open.mira-replay { animation: mira-panel-scale .22s ease-out both; }
    .mira-panel[data-panel-motion="reveal"].mira-open.mira-replay { animation: mira-panel-reveal .25s ease-out both; }
    .mira-bubble[data-launcher-motion] { animation: none; }
    .mira-bubble[data-launcher-motion="breathe"]:not(.mira-bubble-open):not(.mira-attention-played) { animation: mira-attention-breathe 1.4s ease-in-out 3; }
    .mira-bubble[data-launcher-motion="float"]:not(.mira-bubble-open):not(.mira-attention-played) { animation: mira-attention-float 1.5s ease-in-out 3; }
    .mira-bubble[data-launcher-motion="ripple"]:not(.mira-bubble-open):not(.mira-attention-played)::before { content: ''; position: absolute; inset: 0; border-radius: inherit; border: 2px solid var(--mira-color); pointer-events: none; animation: mira-attention-ripple 1.4s ease-out 3; }
    @keyframes mira-attention-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.035); } }
    @keyframes mira-attention-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
    @keyframes mira-attention-ripple { from { opacity: .45; transform: scale(1); } to { opacity: 0; transform: scale(1.15); } }
    @keyframes mira-panel-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
    @keyframes mira-panel-scale { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: none; } }
    @keyframes mira-panel-reveal { from { opacity: 0; clip-path: inset(10% 0 0 round var(--mira-panel-radius, 24px)); } to { opacity: 1; clip-path: inset(0 round var(--mira-panel-radius, 24px)); } }
    @media (prefers-reduced-motion: reduce) {
      .mira-panel, .mira-panel *, .mira-bubble, .mira-trigger { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
      .mira-bubble::before { animation: none !important; display: none !important; }
    }
  `;
  doc.head.appendChild(style);
}
