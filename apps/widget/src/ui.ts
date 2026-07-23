import { MessageSenderType } from '@mira/shared-types';

const STYLE_ID = 'mira-widget-styles';

// همه‌ی استایل‌ها inline در JS تزریق می‌شن تا ویجت به هیچ فایل CSS خارجی نیاز نداشته باشه.
// رنگ با یک CSS variable قابل تنظیمه؛ موقعیت (راست/چپ) با کلاس‌های mira-pos-* که physical
// left/right هستن (نه logical inset-inline-*) — چون باید مستقل از جهت متن سایت میزبان باشه.
function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .mira-bubble {
      position: fixed; bottom: 20px; width: 56px; height: 56px;
      border-radius: 50%; background: var(--mira-color, #2563eb); color: #fff; border: none; cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,.2); font-size: 24px; z-index: 999998;
    }
    .mira-trigger {
      position: fixed; bottom: 84px; max-width: 240px;
      background: #fff; border-radius: 12px; box-shadow: 0 6px 20px rgba(0,0,0,.18);
      padding: 12px 14px; font-size: 13px; line-height: 1.5; cursor: pointer;
      display: none; z-index: 999997; direction: rtl; font-family: Tahoma, Arial, sans-serif;
    }
    .mira-trigger.mira-open { display: block; }
    .mira-trigger-close {
      position: absolute; top: -8px; inset-inline-start: -8px; width: 20px; height: 20px;
      border-radius: 50%; background: #6b7280; color: #fff; border: none; font-size: 12px; cursor: pointer;
    }
    .mira-panel {
      position: fixed; bottom: 88px; width: 320px; height: 440px;
      background: #fff; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,.2);
      display: none; flex-direction: column; overflow: hidden; z-index: 999999;
      font-family: Tahoma, Arial, sans-serif; direction: rtl;
    }
    .mira-panel.mira-open { display: flex; }
    .mira-pos-right.mira-bubble, .mira-pos-right.mira-trigger, .mira-pos-right.mira-panel { right: 20px; }
    .mira-pos-left.mira-bubble, .mira-pos-left.mira-trigger, .mira-pos-left.mira-panel { left: 20px; }
    .mira-header { background: var(--mira-color, #2563eb); color: #fff; padding: 12px 16px; font-size: 14px; }
    .mira-messages { flex: 1; overflow-y: auto; padding: 12px; background: #f3f4f6; }
    .mira-msg { margin-bottom: 8px; max-width: 80%; padding: 8px 12px; border-radius: 10px; font-size: 13px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
    .mira-msg-visitor { background: var(--mira-color, #2563eb); color: #fff; margin-inline-start: auto; }
    .mira-msg-agent, .mira-msg-bot { background: #e5e7eb; color: #111827; margin-inline-end: auto; }
    .mira-typing { font-size: 11px; color: #6b7280; padding: 0 12px 6px; min-height: 16px; }
    .mira-input-row { display: flex; border-top: 1px solid #e5e7eb; }
    .mira-input { flex: 1; border: none; padding: 10px; font-size: 13px; outline: none; direction: rtl; }
    .mira-send { border: none; background: var(--mira-color, #2563eb); color: #fff; padding: 0 14px; cursor: pointer; }
    .mira-error { color: #b91c1c; font-size: 11px; padding: 4px 12px; }
    .mira-csat { margin: 8px 0; padding: 10px; border-radius: 10px; background: #fff; border: 1px solid #e5e7eb; font-size: 12px; }
    .mira-csat-stars { display: flex; gap: 4px; justify-content: center; margin: 6px 0; font-size: 22px; }
    .mira-csat-star { cursor: pointer; color: #d1d5db; }
    .mira-csat-star.mira-active { color: #f59e0b; }
    .mira-csat-submit { width: 100%; margin-top: 6px; border: none; background: var(--mira-color, #2563eb); color: #fff; padding: 6px; border-radius: 6px; cursor: pointer; font-size: 12px; }
  `;
  document.head.appendChild(style);
}

export interface WidgetUiOptions {
  color?: string;
  // موقعیت حباب/پنجره روی صفحه — مستقل از جهت متن سایت میزبان
  position?: 'bottom-right' | 'bottom-left';
}

export interface WidgetUiCallbacks {
  onSend: (content: string) => void;
  onTypingChange: (isTyping: boolean) => void;
}

export class WidgetUi {
  readonly bubble: HTMLButtonElement;
  readonly panel: HTMLDivElement;
  private readonly messagesEl: HTMLDivElement;
  private readonly typingEl: HTMLDivElement;
  private readonly inputEl: HTMLInputElement;
  private readonly errorEl: HTMLDivElement;
  private readonly triggerEl: HTMLDivElement;
  private csatCardEl: HTMLDivElement | null = null;
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly callbacks: WidgetUiCallbacks,
    options: WidgetUiOptions = {},
  ) {
    injectStyles();

    const positionClass = options.position === 'bottom-left' ? 'mira-pos-left' : 'mira-pos-right';

    this.bubble = document.createElement('button');
    this.bubble.className = `mira-bubble ${positionClass}`;
    this.bubble.setAttribute('aria-label', 'باز کردن گفتگوی پشتیبانی');
    this.bubble.textContent = '💬';

    this.triggerEl = document.createElement('div');
    this.triggerEl.className = `mira-trigger ${positionClass}`;

    this.panel = document.createElement('div');
    this.panel.className = `mira-panel ${positionClass}`;
    this.panel.innerHTML = `
      <div class="mira-header">پشتیبانی آنلاین</div>
      <div class="mira-messages"></div>
      <div class="mira-typing"></div>
      <div class="mira-error"></div>
      <div class="mira-input-row">
        <input class="mira-input" type="text" placeholder="پیام خود را بنویسید..." />
        <button class="mira-send">ارسال</button>
      </div>
    `;

    if (options.color) {
      for (const el of [this.bubble, this.triggerEl, this.panel]) {
        el.style.setProperty('--mira-color', options.color);
      }
    }

    this.messagesEl = this.panel.querySelector('.mira-messages')!;
    this.typingEl = this.panel.querySelector('.mira-typing')!;
    this.errorEl = this.panel.querySelector('.mira-error')!;
    this.inputEl = this.panel.querySelector('.mira-input')!;
    const sendButton = this.panel.querySelector('.mira-send')!;

    this.bubble.addEventListener('click', () => this.togglePanel());
    sendButton.addEventListener('click', () => this.submit());
    this.inputEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.submit();
      else this.handleTyping();
    });

    document.body.appendChild(this.bubble);
    document.body.appendChild(this.triggerEl);
    document.body.appendChild(this.panel);
  }

  openPanel(): void {
    this.panel.classList.add('mira-open');
    this.hideTriggerBubble();
  }

  private togglePanel(): void {
    this.panel.classList.toggle('mira-open');
    this.hideTriggerBubble();
  }

  private submit(): void {
    const value = this.inputEl.value.trim();
    if (!value) return;
    this.callbacks.onSend(value);
    this.inputEl.value = '';
    this.callbacks.onTypingChange(false);
  }

  private handleTyping(): void {
    this.callbacks.onTypingChange(true);
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => this.callbacks.onTypingChange(false), 2000);
  }

  appendMessage(content: string, senderType: MessageSenderType): void {
    const el = document.createElement('div');
    el.className = `mira-msg mira-msg-${senderType}`;
    el.textContent = content;
    this.messagesEl.appendChild(el);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  setTypingIndicator(visible: boolean): void {
    this.typingEl.textContent = visible ? 'در حال تایپ...' : '';
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
