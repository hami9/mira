import {
  MessageSenderType,
  AI_STATUS_LABELS,
  safeHttpUrl,
  formatProductPrice,
} from '@mira/shared-types';
import type { MessagePayload, AiStatusPayload, WidgetAssistant } from '@mira/shared-types';

const STYLE_ID = 'mira-widget-styles';

// همه‌ی استایل‌ها inline در JS تزریق می‌شن تا ویجت به هیچ فایل CSS خارجی نیاز نداشته باشه.
// رنگ با یک CSS variable قابل تنظیمه؛ موقعیت (راست/چپ) با کلاس‌های mira-pos-* که physical
// left/right هستن (نه logical inset-inline-*) — چون باید مستقل از جهت متن سایت میزبان باشه.
// پیش‌فرض رنگ/گرادیان از هویت برند میراست (docs/brand/README.md)؛ اگر سایت رنگ سفارشی بدهد،
// --mira-gradient هم با همان رنگ تختِ سفارشی جایگزین می‌شود (رفتار قبلی حفظ شده).
function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .mira-bubble {
      position: fixed; bottom: 20px; width: 60px; height: 60px;
      border-radius: 50%; background: var(--mira-gradient, linear-gradient(135deg, #2E6BE6 0%, #17B8A6 100%));
      color: #fff; border: none; cursor: pointer;
      box-shadow: 0 6px 20px rgba(46,107,230,.4); z-index: 999998;
      animation: mira-bubble-in .45s cubic-bezier(.34,1.56,.64,1) both;
      transition: transform .2s ease, box-shadow .2s ease;
    }
    .mira-bubble:hover { transform: scale(1.06); box-shadow: 0 8px 26px rgba(46,107,230,.5); }
    .mira-bubble::before {
      content: ''; position: absolute; inset: 0; border-radius: 50%;
      box-shadow: 0 0 0 0 rgba(46,107,230,.45); animation: mira-pulse 3s ease-out .8s infinite;
    }
    .mira-icon { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; transition: opacity .2s ease, transform .25s ease; }
    .mira-icon-close { opacity: 0; transform: rotate(-90deg) scale(.4); }
    .mira-bubble.mira-bubble-open .mira-icon-chat { opacity: 0; transform: rotate(90deg) scale(.4); }
    .mira-bubble.mira-bubble-open .mira-icon-close { opacity: 1; transform: none; }
    .mira-bubble.mira-bubble-open::before { animation: none; }
    .mira-trigger {
      position: fixed; bottom: 92px; max-width: 240px;
      background: #fff; border-radius: 14px; box-shadow: 0 6px 20px rgba(0,0,0,.18);
      padding: 12px 14px; font-size: 13px; line-height: 1.5; cursor: pointer;
      z-index: 999997; direction: rtl; font-family: Tahoma, Arial, sans-serif;
      opacity: 0; visibility: hidden; transform: translateY(8px); pointer-events: none;
      transition: opacity .25s ease, transform .25s ease, visibility .25s;
    }
    .mira-trigger.mira-open { opacity: 1; visibility: visible; transform: none; pointer-events: auto; }
    .mira-trigger-close {
      position: absolute; top: -8px; inset-inline-start: -8px; width: 20px; height: 20px;
      border-radius: 50%; background: #6b7280; color: #fff; border: none; font-size: 12px; cursor: pointer;
    }
    .mira-panel {
      position: fixed; bottom: 92px; width: 390px; max-width: calc(100vw - 24px); height: 600px; max-height: calc(100dvh - 115px);
      background: #fff; border-radius: 16px; box-shadow: 0 12px 40px rgba(15,40,90,.25);
      display: flex; flex-direction: column; overflow: hidden; z-index: 999999;
      font-family: Tahoma, Arial, sans-serif; direction: rtl;
      opacity: 0; visibility: hidden; transform: translateY(14px) scale(.98); pointer-events: none;
      transition: opacity .25s ease, transform .3s cubic-bezier(.34,1.56,.64,1), visibility .3s;
    }
    .mira-panel.mira-open { opacity: 1; visibility: visible; transform: none; pointer-events: auto; }
    .mira-pos-right.mira-bubble, .mira-pos-right.mira-trigger, .mira-pos-right.mira-panel { right: 20px; }
    .mira-pos-left.mira-bubble, .mira-pos-left.mira-trigger, .mira-pos-left.mira-panel { left: 20px; }
    .mira-header {
      background: var(--mira-gradient, linear-gradient(135deg, #2E6BE6 0%, #17B8A6 100%));
      color: #fff; padding: 12px 16px; display: flex; align-items: center; gap: 10px;
    }
    .mira-header-logo { width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,.18); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .mira-header-title { font-size: 14px; font-weight: 700; line-height: 1.3; }
    .mira-header-sub { font-size: 11px; opacity: .85; }
    .mira-messages { flex: 1; overflow-y: auto; padding: 12px; background: #f7f9fc; }
    .mira-msg {
      margin-bottom: 8px; max-width: 80%; padding: 8px 12px; border-radius: 12px;
      font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word;
      animation: mira-msg-in .25s ease-out both;
    }
    .mira-msg-visitor { background: var(--mira-color, #2E6BE6); color: #fff; margin-inline-start: auto; border-bottom-left-radius: 4px; }
    .mira-msg-agent { background: #e8ecf3; color: #111827; margin-inline-end: auto; border-bottom-right-radius: 4px; }
    .mira-msg-bot { background: #EFFCF9; border: 1px solid #B2EAE0; color: #12504A; margin-inline-end: auto; border-bottom-right-radius: 4px; }
    .mira-typing { font-size: 11px; color: #6b7280; padding: 0 12px 6px; min-height: 16px; display: flex; align-items: center; gap: 6px; }
    .mira-dots { display: inline-flex; gap: 3px; }
    .mira-dots i {
      width: 5px; height: 5px; border-radius: 50%; background: #9ca3af; display: inline-block;
      animation: mira-dot 1.2s ease-in-out infinite;
    }
    .mira-dots i:nth-child(2) { animation-delay: .15s; }
    .mira-dots i:nth-child(3) { animation-delay: .3s; }
    .mira-input-row { display: flex; border-top: 1px solid #e5e7eb; }
    .mira-input { flex: 1; min-width: 0; resize: none; border: none; padding: 12px; font-size: 13px; outline: none; direction: rtl; font-family: inherit; color: #17243b; background: #fff; }
    .mira-send {
      border: none; background: var(--mira-color, #2E6BE6); color: #fff; padding: 0 16px;
      cursor: pointer; font-family: inherit; font-size: 13px; transition: filter .15s ease;
    }
    .mira-send:hover { filter: brightness(1.1); }
    .mira-error { color: #b91c1c; font-size: 11px; padding: 4px 12px; }
    .mira-csat { margin: 8px 0; padding: 12px; border-radius: 12px; background: #fff; border: 1px solid #e5e7eb; font-size: 12px; animation: mira-msg-in .25s ease-out both; }
    .mira-csat-stars { display: flex; gap: 6px; justify-content: center; margin: 8px 0; font-size: 24px; }
    .mira-csat-star { cursor: pointer; color: #d1d5db; transition: transform .15s ease, color .15s ease; }
    .mira-csat-star:hover { transform: scale(1.2); }
    .mira-csat-star.mira-active { color: #F5A623; }
    .mira-csat-submit {
      width: 100%; margin-top: 6px; border: none;
      background: var(--mira-gradient, linear-gradient(135deg, #2E6BE6 0%, #17B8A6 100%));
      color: #fff; padding: 8px; border-radius: 8px; cursor: pointer; font-size: 12px; font-family: inherit;
    }
    .mira-csat-submit:disabled { opacity: .5; cursor: default; }
    .mira-panel *, .mira-panel *::before, .mira-panel *::after { box-sizing: border-box; }
    .mira-panel button { font-family: inherit; }
    .mira-panel button:focus-visible, .mira-panel a:focus-visible, .mira-input:focus-visible { outline: 2px solid #2e6be6; outline-offset: -2px; }
    .mira-panel button:disabled { opacity: .5; cursor: wait; }
    .mira-header { padding: 20px 18px; }
    .mira-header-title { font-size: 16px; }
    .mira-header-sub { display: inline-block; margin-top: 5px; }
    .mira-header-close { margin-inline-start: auto; background: transparent; border: 0; color: white; cursor: pointer; font-size: 24px; }
    .mira-messages { padding: 18px 14px; scroll-behavior: smooth; }
    .mira-msg { max-width: 92%; padding: 12px; margin-bottom: 14px; }
    .mira-msg-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 10px; opacity: .75; margin-bottom: 5px; }
    .mira-copy { background: none; color: inherit; border: none; cursor: pointer; font-size: 10px; }
    .mira-welcome { text-align: center; padding: 26px 12px; color: #17243b; }
    .mira-welcome strong { display: block; font-size: 19px; margin-bottom: 12px; }
    .mira-welcome p { font-size: 13px; line-height: 1.9; color: #64748b; }
    .mira-quick { display: flex; flex-wrap: wrap; justify-content: center; gap: 7px; margin-top: 18px; }
    .mira-quick button { border: 1px solid #dbe4f0; border-radius: 16px; background: white; padding: 8px 11px; color: #2E6BE6; cursor: pointer; font-size: 11px; }
    .mira-tools { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; font-size: 10px; color: #64748b; background: #fff; }
    .mira-human { border: 0; background: transparent; color: #2e6be6; cursor: pointer; font-size: 11px; }
    .mira-ai-status { margin: 0 12px; border-radius: 10px; color: #126c62; background: #effcf9; font-size: 11px; line-height: 1.8; }
    .mira-ai-status:not(:empty) { padding: 10px; margin-bottom: 8px; display: flex; gap: 10px; align-items: center; }
    .mira-thinking { width: 18px; height: 18px; flex-shrink: 0; border: 2px solid #b2eae0; border-top-color: #17b8a6; border-radius: 50%; animation: mira-spin 1s linear infinite; }
    @keyframes mira-spin { to { transform: rotate(360deg); } }
    .mira-products { display: grid; gap: 8px; margin-top: 12px; white-space: normal; }
    .mira-product { display: grid; grid-template-columns: 52px 1fr; gap: 10px; background: white; border: 1px solid #dce7e8; padding: 10px; border-radius: 10px; color: #17243b; text-decoration: none; }
    .mira-product img, .mira-product-icon { width: 52px; height: 60px; border-radius: 6px; object-fit: contain; background: #f1f5f9; }
    .mira-product-icon { display: grid; place-items: center; font-size: 24px; }
    .mira-product strong { font-size: 12px; display: block; }
    .mira-product small { display: block; font-size: 10px; margin-top: 4px; color: #64748b; }
    .mira-product b { display: block; font-size: 12px; margin-top: 5px; color: #126c62; }
    .mira-source { display: inline-block; font-size: 10px; color: #376b78; background: #fff; border: 1px solid #dce7e8; border-radius: 6px; padding: 3px 6px; margin: 8px 0 0 4px; text-decoration: none; white-space: normal; }
    @media (max-width: 480px) { .mira-pos-right.mira-panel { right: 12px; } .mira-pos-left.mira-panel { left: 12px; } .mira-panel { bottom: 88px; } }
    @media (prefers-reduced-motion: reduce) { .mira-thinking { animation: none; } .mira-messages { scroll-behavior: auto; } }
    @keyframes mira-bubble-in { from { opacity: 0; transform: scale(.3); } to { opacity: 1; transform: scale(1); } }
    @keyframes mira-pulse {
      0% { box-shadow: 0 0 0 0 rgba(46,107,230,.45); }
      60% { box-shadow: 0 0 0 14px rgba(46,107,230,0); }
      100% { box-shadow: 0 0 0 0 rgba(46,107,230,0); }
    }
    @keyframes mira-msg-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    @keyframes mira-dot { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }
    @media (prefers-reduced-motion: reduce) {
      .mira-bubble, .mira-msg, .mira-csat { animation: none; }
      .mira-bubble::before { animation: none; }
      .mira-panel, .mira-trigger, .mira-icon, .mira-bubble, .mira-csat-star { transition: none; }
      .mira-dots i { animation: none; }
    }
  `;
  document.head.appendChild(style);
}

// نشان میرا (قلب داخل حباب گفتگو) — سفید، برای حباب شناور و هدر پنل
const CHAT_HEART_SVG = `
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true">
    <path d="M12 3C6.9 3 3 6.4 3 10.6c0 2.4 1.2 4.5 3.1 5.9L5.2 20.5l4.2-1.6c.8.2 1.7.3 2.6.3 5.1 0 9-3.4 9-7.6S17.1 3 12 3Z" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/>
    <path d="M12 14.1c-2.3-1.7-3.5-3-3.5-4.4 0-1.1.9-1.8 1.8-1.7.6.1 1.2.5 1.7 1.1.5-.6 1.1-1 1.7-1.1.9-.1 1.8.6 1.8 1.7 0 1.4-1.2 2.7-3.5 4.4Z" fill="#fff"/>
  </svg>`;

const CLOSE_SVG = `
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
  </svg>`;

export interface WidgetUiOptions {
  color?: string;
  // موقعیت حباب/پنجره روی صفحه — مستقل از جهت متن سایت میزبان
  position?: 'bottom-right' | 'bottom-left';
}

export interface WidgetUiCallbacks {
  onSend: (content: string) => Promise<void>;
  onTypingChange: (isTyping: boolean) => void;
}

export class WidgetUi {
  readonly bubble: HTMLButtonElement;
  readonly panel: HTMLDivElement;
  private readonly messagesEl: HTMLDivElement;
  private readonly typingEl: HTMLDivElement;
  private readonly inputEl: HTMLTextAreaElement;
  private readonly errorEl: HTMLDivElement;
  private readonly triggerEl: HTMLDivElement;
  private csatCardEl: HTMLDivElement | null = null;
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly seenMessages = new Set<string>();
  private aiTimeout: ReturnType<typeof setTimeout> | null = null;
  private aiMessageId: string | null = null;
  private sending = false;
  private connected = false;
  private botName = 'دستیار میرا';

  constructor(
    private readonly callbacks: WidgetUiCallbacks,
    options: WidgetUiOptions = {},
  ) {
    injectStyles();

    const positionClass = options.position === 'bottom-left' ? 'mira-pos-left' : 'mira-pos-right';

    this.bubble = document.createElement('button');
    this.bubble.className = `mira-bubble ${positionClass}`;
    this.bubble.setAttribute('aria-label', 'باز کردن گفتگوی پشتیبانی');
    // دو آیکون روی‌هم: نشان چت و ضربدر — با کلاس mira-bubble-open بین‌شان جابه‌جا می‌شویم
    this.bubble.innerHTML = `
      <span class="mira-icon mira-icon-chat">${CHAT_HEART_SVG}</span>
      <span class="mira-icon mira-icon-close">${CLOSE_SVG}</span>
    `;

    this.triggerEl = document.createElement('div');
    this.triggerEl.className = `mira-trigger ${positionClass}`;

    this.panel = document.createElement('div');
    this.panel.className = `mira-panel ${positionClass}`;
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-label', 'گفتگوی پشتیبانی');
    this.panel.inert = true;
    this.panel.innerHTML = `
      <div class="mira-header">
        <span class="mira-header-logo">${CHAT_HEART_SVG}</span>
        <span>
          <span class="mira-header-title">پشتیبانی آنلاین</span><br />
          <span class="mira-header-sub">میرا — پاسخ‌گوی شما</span>
        </span>
        <button class="mira-header-close" aria-label="بستن گفتگو">×</button>
      </div>
      <div class="mira-messages" role="log" aria-label="پیام‌های گفتگو" aria-live="polite"></div>
      <div class="mira-ai-status" role="status" aria-live="polite"></div>
      <div class="mira-typing"></div>
      <div class="mira-error" role="alert"></div>
      <div class="mira-input-row">
        <textarea class="mira-input" rows="2" maxlength="8000" aria-label="پیام شما" placeholder="پیام خود را بنویسید..."></textarea>
        <button class="mira-send" disabled>ارسال</button>
      </div>
      <div class="mira-tools"><button class="mira-human">گفتگو با پشتیبان</button><span>با میرا، کنار شما</span></div>
    `;

    if (options.color) {
      // رنگ سفارشی سایت: هم رنگ تخت و هم گرادیان با همان رنگ جایگزین می‌شوند
      for (const el of [this.bubble, this.triggerEl, this.panel]) {
        el.style.setProperty('--mira-color', options.color);
        el.style.setProperty('--mira-gradient', options.color);
      }
    }

    this.messagesEl = this.panel.querySelector('.mira-messages')!;
    this.typingEl = this.panel.querySelector('.mira-typing')!;
    this.errorEl = this.panel.querySelector('.mira-error')!;
    this.inputEl = this.panel.querySelector('.mira-input')!;
    const sendButton = this.panel.querySelector('.mira-send')!;

    this.bubble.addEventListener('click', () => this.togglePanel());
    sendButton.addEventListener('click', () => this.submit());
    this.panel
      .querySelector('.mira-header-close')!
      .addEventListener('click', () => this.togglePanel());
    this.panel.querySelector('.mira-human')!.addEventListener('click', () => {
      this.inputEl.value = 'می‌خواهم با اپراتور انسانی صحبت کنم';
      this.submit();
    });
    this.panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.togglePanel();
        this.bubble.focus();
      }
    });
    this.inputEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        this.submit();
      } else this.handleTyping();
    });

    document.body.appendChild(this.bubble);
    document.body.appendChild(this.triggerEl);
    document.body.appendChild(this.panel);
  }

  openPanel(): void {
    this.panel.classList.add('mira-open');
    this.bubble.classList.add('mira-bubble-open');
    this.hideTriggerBubble();
    this.panel.inert = false;
    this.bubble.setAttribute('aria-expanded', 'true');
    this.inputEl.focus();
  }

  private togglePanel(): void {
    const isOpen = this.panel.classList.toggle('mira-open');
    this.bubble.classList.toggle('mira-bubble-open', isOpen);
    this.hideTriggerBubble();
    this.panel.inert = !isOpen;
    this.bubble.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) this.inputEl.focus();
  }

  private async submit(): Promise<void> {
    const value = this.inputEl.value.trim();
    if (!value || this.sending || !this.connected) return;
    this.sending = true;
    this.showError('');
    this.updateSendButton();
    try {
      await this.callbacks.onSend(value);
      if (this.inputEl.value.trim() === value) this.inputEl.value = '';
      this.callbacks.onTypingChange(false);
    } catch {
      this.showError('ارسال انجام نشد. پیام شما حفظ شده؛ دوباره ارسال کنید.');
    } finally {
      this.sending = false;
      this.updateSendButton();
    }
  }

  private handleTyping(): void {
    this.callbacks.onTypingChange(true);
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => this.callbacks.onTypingChange(false), 2000);
  }

  appendMessage(content: string, senderType: MessageSenderType, message?: MessagePayload): void {
    if (message && this.seenMessages.has(message.id)) return;
    if (message) this.seenMessages.add(message.id);
    this.messagesEl.querySelector('.mira-welcome')?.remove();
    if (senderType !== MessageSenderType.VISITOR) this.clearAiStatus();
    const nearBottom =
      this.messagesEl.scrollHeight - this.messagesEl.scrollTop - this.messagesEl.clientHeight < 100;
    const el = document.createElement('div');
    el.className = `mira-msg mira-msg-${senderType}`;
    const meta = document.createElement('div');
    meta.className = 'mira-msg-meta';
    const label = document.createElement('span');
    label.textContent =
      senderType === MessageSenderType.BOT
        ? `✦ ${this.botName}`
        : senderType === MessageSenderType.AGENT
          ? 'پشتیبان'
          : 'شما';
    if (message)
      label.textContent += ` · ${new Date(message.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`;
    meta.appendChild(label);
    if (senderType !== MessageSenderType.VISITOR) {
      const copy = document.createElement('button');
      copy.className = 'mira-copy';
      copy.textContent = 'کپی';
      copy.setAttribute('aria-label', 'کپی پاسخ');
      copy.onclick = () => {
        navigator.clipboard
          ?.writeText(content)
          .then(() => {
            copy.textContent = 'کپی شد';
          })
          .catch(() => this.showError('کپی متن در این مرورگر ممکن نیست'));
      };
      meta.appendChild(copy);
    }
    el.appendChild(meta);
    const body = document.createElement('div');
    body.textContent = content;
    el.appendChild(body);
    if (message?.aiMetadata && senderType === MessageSenderType.BOT) {
      const cards = document.createElement('div');
      cards.className = 'mira-products';
      for (const product of message.aiMetadata.products ?? []) {
        const url = safeHttpUrl(product.url);
        if (!url) continue;
        const card = document.createElement('a');
        card.className = 'mira-product';
        card.href = url;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
        const imageUrl = product.imageUrl && safeHttpUrl(product.imageUrl);
        if (imageUrl) {
          const img = document.createElement('img');
          img.src = imageUrl;
          img.alt = product.name;
          img.loading = 'lazy';
          img.referrerPolicy = 'no-referrer';
          card.appendChild(img);
        } else {
          const icon = document.createElement('span');
          icon.className = 'mira-product-icon';
          icon.textContent = '◇';
          card.appendChild(icon);
        }
        const info = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = product.name;
        info.appendChild(name);
        const price = document.createElement('b');
        price.textContent = formatProductPrice(product);
        info.appendChild(price);
        const stock = document.createElement('small');
        stock.textContent = product.inStock
          ? 'موجود · مشاهده محصول ↗'
          : 'ناموجود · مشاهده جزئیات ↗';
        info.appendChild(stock);
        card.appendChild(info);
        cards.appendChild(card);
      }
      el.appendChild(cards);
      for (const source of message.aiMetadata.sources ?? []) {
        const url = source.url && safeHttpUrl(source.url);
        const chip = document.createElement(url ? 'a' : 'span');
        chip.className = 'mira-source';
        chip.textContent = `↗ ${source.title}`;
        if (url && chip instanceof HTMLAnchorElement) {
          chip.href = url;
          chip.target = '_blank';
          chip.rel = 'noopener noreferrer';
        }
        el.appendChild(chip);
      }
    }
    this.messagesEl.appendChild(el);
    if (nearBottom || senderType === MessageSenderType.VISITOR)
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  configureAssistant(assistant?: WidgetAssistant): void {
    const store = assistant?.siteName?.trim() || 'فروشگاه';
    if (assistant?.enabled) this.botName = assistant.name;
    if (assistant?.enabled && assistant.avatarUrl && safeHttpUrl(assistant.avatarUrl)) {
      const avatar = document.createElement('img');
      avatar.src = safeHttpUrl(assistant.avatarUrl)!;
      avatar.alt = '';
      avatar.width = 34;
      avatar.height = 34;
      avatar.style.borderRadius = '50%';
      avatar.style.objectFit = 'cover';
      avatar.referrerPolicy = 'no-referrer';
      this.panel.querySelector('.mira-header-logo')!.replaceChildren(avatar);
    }
    this.panel.querySelector('.mira-header-title')!.textContent = assistant?.enabled
      ? this.botName
      : `پشتیبانی ${store}`;
    this.panel.querySelector('.mira-header-sub')!.textContent = assistant?.enabled
      ? `دستیار ${store} · همراه با پشتیبان انسانی`
      : `${store} · پاسخ‌گوی شما`;
    if (this.seenMessages.size) return;
    this.messagesEl.querySelector('.mira-welcome')?.remove();
    const welcome = document.createElement('div');
    welcome.className = 'mira-welcome';
    const title = document.createElement('strong');
    title.textContent = 'سلام، چطور می‌توانیم کمک کنیم؟';
    welcome.appendChild(title);
    const text = document.createElement('p');
    text.textContent = assistant?.enabled
      ? assistant.greeting || `برای انتخاب محصول و پاسخ به پرسش‌های ${store} اینجا هستم.`
      : 'پیامتان را بنویسید تا همکاران ما راهنمایی‌تان کنند.';
    welcome.appendChild(text);
    const quick = document.createElement('div');
    quick.className = 'mira-quick';
    for (const prompt of assistant?.enabled ? assistant.quickReplies : []) {
      const button = document.createElement('button');
      button.textContent = prompt;
      button.onclick = () => {
        this.inputEl.value = prompt;
        this.inputEl.focus();
        this.submit();
      };
      quick.appendChild(button);
    }
    welcome.appendChild(quick);
    this.messagesEl.appendChild(welcome);
  }

  setConnected(connected: boolean): void {
    this.connected = connected;
    this.updateSendButton();
    if (!connected) {
      this.clearAiStatus();
      this.showError('در حال اتصال به پشتیبانی…');
    } else this.showError('');
  }

  private updateSendButton(): void {
    (this.panel.querySelector('.mira-send') as HTMLButtonElement).disabled =
      !this.connected || this.sending;
  }

  setAiStatus(payload: AiStatusPayload): void {
    if (payload.stage === 'idle') {
      if (this.aiMessageId === payload.messageId) this.clearAiStatus();
      return;
    }
    this.clearAiStatus();
    this.aiMessageId = payload.messageId;
    const el = this.panel.querySelector('.mira-ai-status')!;
    const spinner = document.createElement('span');
    spinner.className = 'mira-thinking';
    spinner.setAttribute('aria-hidden', 'true');
    el.appendChild(spinner);
    el.appendChild(document.createTextNode(AI_STATUS_LABELS[payload.stage]));
    this.aiTimeout = setTimeout(() => this.clearAiStatus(), 60_000);
  }

  clearAiStatus(): void {
    if (this.aiTimeout) clearTimeout(this.aiTimeout);
    this.aiTimeout = null;
    this.aiMessageId = null;
    this.panel.querySelector('.mira-ai-status')!.textContent = '';
  }

  setTypingIndicator(visible: boolean): void {
    if (visible) {
      this.typingEl.innerHTML = '<span class="mira-dots"><i></i><i></i><i></i></span> در حال تایپ';
    } else {
      this.typingEl.textContent = '';
    }
  }

  showError(message: string): void {
    this.errorEl.textContent = message;
  }

  showTriggerBubble(text: string, onOpen: () => void): void {
    this.triggerEl.innerHTML = '';
    this.triggerEl.textContent = text;

    const closeButton = document.createElement('button');
    closeButton.className = 'mira-trigger-close';
    closeButton.textContent = '×';
    closeButton.setAttribute('aria-label', 'بستن پیام');
    closeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      this.hideTriggerBubble();
    });
    this.triggerEl.appendChild(closeButton);

    this.triggerEl.addEventListener('click', () => {
      this.openPanel();
      onOpen();
    });
    this.triggerEl.classList.add('mira-open');
  }

  hideTriggerBubble(): void {
    this.triggerEl.classList.remove('mira-open');
  }

  // پرامپت امتیازدهی CSAT — به‌عنوان یک کارت در انتهای لیست پیام‌ها نمایش داده می‌شه، نه به‌جای ورودی پیام
  showCsatPrompt(onSubmit: (score: number, comment: string) => void): void {
    this.hideCsatPrompt();

    const card = document.createElement('div');
    card.className = 'mira-csat';
    card.innerHTML = `
      <div>این گفتگو به پایان رسید. چقدر از پاسخ‌گویی راضی بودید؟</div>
      <div class="mira-csat-stars"></div>
      <button class="mira-csat-submit" disabled>ارسال امتیاز</button>
    `;

    const starsEl = card.querySelector('.mira-csat-stars')!;
    const submitButton = card.querySelector('.mira-csat-submit') as HTMLButtonElement;
    let selectedScore = 0;

    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('span');
      star.className = 'mira-csat-star';
      star.textContent = '★';
      star.addEventListener('click', () => {
        selectedScore = i;
        submitButton.disabled = false;
        starsEl.querySelectorAll('.mira-csat-star').forEach((el, index) => {
          el.classList.toggle('mira-active', index < selectedScore);
        });
      });
      starsEl.appendChild(star);
    }

    submitButton.addEventListener('click', () => {
      if (selectedScore < 1) return;
      onSubmit(selectedScore, '');
      card.innerHTML = '<div>متشکریم از بازخورد شما! 🙏</div>';
    });

    this.csatCardEl = card;
    this.messagesEl.appendChild(card);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  hideCsatPrompt(): void {
    this.csatCardEl?.remove();
    this.csatCardEl = null;
  }
}
