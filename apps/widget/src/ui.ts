import {
  MessageSenderType,
  AI_STATUS_LABELS,
  safeHttpUrl,
  formatProductPrice,
  DEFAULT_WIDGET_APPEARANCE,
  normalizeWidgetAppearance,
} from '@mira/shared-types';
import type {
  MessagePayload,
  AiStatusPayload,
  WidgetAssistant,
  AiProduct,
  WidgetAppearance,
  WidgetAction,
  VisitorModeration,
} from '@mira/shared-types';
import { icons } from './icons';
import { injectStyles } from './styles';

export interface WidgetUiOptions {
  color?: string;
  accentColor?: string;
  // موقعیت فیزیکی حباب مستقل از جهت متن سایت میزبان است.
  position?: 'bottom-right' | 'bottom-left';
  fullscreen?: boolean;
  fontUrl?: string;
  appearance?: WidgetAppearance;
  document?: Document;
}

export interface WidgetUiCallbacks {
  onSend: (content: string) => Promise<void>;
  onTypingChange: (isTyping: boolean) => void;
}

const HUMAN_PROMPT = 'می‌خواهم با اپراتور انسانی صحبت کنم';
export class WidgetSendError extends Error {}

function hexColor(value?: string): string | undefined {
  return value && /^#[\da-f]{6}$/i.test(value) ? value.toLowerCase() : undefined;
}

function blendColor(color: string, base: string, amount: number): string {
  const channels = [1, 3, 5].map((offset) =>
    Math.round(
      parseInt(color.slice(offset, offset + 2), 16) * amount +
        parseInt(base.slice(offset, offset + 2), 16) * (1 - amount),
    )
      .toString(16)
      .padStart(2, '0'),
  );
  return `#${channels.join('')}`;
}

function luminance(color: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function colorTokens(color: string, prefix: string, surface = '#ffffff'): Record<string, string> {
  let soft = blendColor(color, surface, 0.07);
  let ink = color;
  const target =
    contrast('#ffffff', surface) > contrast('#000000', surface) ? '#ffffff' : '#000000';
  if (contrast(target, soft) < 4.5) soft = surface;
  // متن رنگی روی سفید و زمینه ملایم، حتی با رنگ سفارشی روشن، خوانا می‌ماند.
  for (
    let attempt = 0;
    attempt < 64 && (contrast(ink, surface) < 4.5 || contrast(ink, soft) < 4.5);
    attempt++
  ) {
    const next = blendColor(ink, target, 0.85);
    if (next === ink) {
      ink = target;
      break;
    }
    ink = next;
  }
  if (contrast(ink, surface) < 4.5 || contrast(ink, soft) < 4.5) ink = target;
  const foreground =
    contrast(color, '#ffffff') >= 4.5
      ? '#ffffff'
      : contrast(color, '#14231e') >= 4.5
        ? '#14231e'
        : '#000000';
  return {
    [prefix]: color,
    [`${prefix}-ink`]: ink,
    [`${prefix}-soft`]: soft,
    [`${prefix}-border`]: blendColor(color, surface, 0.25),
    [`${prefix}-foreground`]: foreground,
    [`${prefix}-ring`]: `${color}22`,
    [`${prefix}-shadow`]: `${color}26`,
  };
}

export class WidgetUi {
  readonly bubble: HTMLButtonElement;
  readonly panel: HTMLDivElement;
  private readonly doc: Document;
  private readonly view: Window;
  private readonly messagesEl: HTMLDivElement;
  private readonly typingEl: HTMLDivElement;
  private readonly inputEl: HTMLTextAreaElement;
  private readonly errorEl: HTMLDivElement;
  private readonly triggerEl: HTMLDivElement;
  private readonly backdrop: HTMLDivElement;
  private csatCardEl: HTMLDivElement | null = null;
  private typingTimeout: number | null = null;
  private readonly seenMessages = new Set<string>();
  private aiTimeout: number | null = null;
  private aiMessageId: string | null = null;
  private sending = false;
  private connected = false;
  private moderation: VisitorModeration = { blocked: false, blockedUntil: null, mutedUntil: null };
  private moderationTimeout: number | null = null;
  private fullscreen = false;
  private bodyOverflow = '';
  private botName = 'دستیار میرا';
  private messageCount = 0;
  private primaryColor = '#2e6be6';
  private accentColor = '#168b6a';
  private appearance = normalizeWidgetAppearance(DEFAULT_WIDGET_APPEARANCE);
  private assistant?: WidgetAssistant;
  private destroyed = false;

  constructor(
    private readonly callbacks: WidgetUiCallbacks,
    options: WidgetUiOptions = {},
  ) {
    this.doc = options.document ?? document;
    const view = this.doc.defaultView;
    if (!view) throw new Error('پنجره پیش‌نمایش آماده نیست');
    this.view = view;
    injectStyles(this.doc);
    const fontUrl = options.fontUrl && safeHttpUrl(options.fontUrl);
    if (fontUrl && !this.doc.getElementById('mira-widget-font')) {
      const font = this.doc.createElement('style');
      font.id = 'mira-widget-font';
      font.textContent = `@font-face { font-family: MiraVazirmatn; src: url(${JSON.stringify(fontUrl)}) format('woff2'); font-weight: 100 900; font-style: normal; font-display: swap; } .mira-panel, .mira-bubble, .mira-trigger { font-family: MiraVazirmatn, Vazirmatn, Tahoma, Arial, sans-serif; }`;
      this.doc.head.appendChild(font);
    }
    const positionClass = options.position === 'bottom-left' ? 'mira-pos-left' : 'mira-pos-right';
    this.bubble = this.doc.createElement('button');
    this.bubble.type = 'button';
    this.bubble.className = `mira-bubble ${positionClass}`;
    this.bubble.setAttribute('aria-label', 'باز کردن گفتگوی پشتیبانی');
    this.bubble.setAttribute('aria-expanded', 'false');
    this.bubble.setAttribute('aria-controls', 'mira-chat-panel');
    this.bubble.innerHTML = `<span class="mira-icon mira-icon-chat">${icons.mark}</span><span class="mira-launcher-label">دستیار خرید میرا</span><span class="mira-icon mira-icon-close">${icons.close}</span>`;
    this.triggerEl = this.doc.createElement('div');
    this.triggerEl.className = `mira-trigger ${positionClass}`;
    this.backdrop = this.doc.createElement('div');
    this.backdrop.className = 'mira-backdrop';
    this.backdrop.setAttribute('aria-hidden', 'true');
    this.panel = this.doc.createElement('div');
    this.panel.id = 'mira-chat-panel';
    this.panel.className = `mira-panel ${positionClass}`;
    this.panel.dir = 'rtl';
    this.panel.lang = 'fa';
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-label', 'گفتگوی پشتیبانی');
    this.panel.inert = true;
    this.panel.innerHTML = `
      <div class="mira-header">
        <span class="mira-header-logo">${icons.mark}</span>
        <div class="mira-header-identity">
          <span class="mira-header-title">دستیار میرا</span>
          <span class="mira-header-sub">برای یک انتخاب راحت‌تر</span>
          <span class="mira-connection" role="status">در حال اتصال…</span>
        </div>
        <div class="mira-header-actions">
          <button type="button" class="mira-expand" aria-label="تمام‌صفحه کردن گفتگو" title="تمام‌صفحه" aria-pressed="false">${icons.expand}</button>
          <button type="button" class="mira-header-close" aria-label="بستن گفتگو" title="بستن گفتگو">${icons.close}</button>
        </div>
      </div>
      <div class="mira-messages" role="log" aria-label="پیام‌های گفتگو" aria-live="polite" aria-relevant="additions"></div>
      <div class="mira-ai-status" role="status" aria-live="polite"></div>
      <div class="mira-typing" role="status"></div>
      <div class="mira-footer">
        <div class="mira-moderation" role="status" aria-live="polite"></div>
        <div class="mira-actions" aria-label="دسترسی سریع">
          <button type="button" class="mira-shopping">${icons.spark}<span>مشاوره خرید</span></button>
          <button type="button" class="mira-shipping">${icons.truck}<span>شرایط ارسال</span></button>
          <button type="button" class="mira-human">${icons.headset}<span>گفتگو با پشتیبان</span></button>
        </div>
        <div class="mira-error" role="alert"></div>
        <div class="mira-input-row">
          <textarea class="mira-input" name="message" autocomplete="off" rows="1" maxlength="8000" aria-label="پیام شما" placeholder="چه چیزی در ذهن دارید؟ اینجا بنویسید…"></textarea>
          <button type="button" class="mira-send" aria-label="ارسال" title="ارسال پیام" disabled>${icons.send}</button>
        </div>
        <div class="mira-tools"><span>با میرا، انتخاب راحت‌تر</span><span>ارسال با Enter · خط جدید با Shift + Enter</span></div>
      </div>
    `;
    this.messagesEl = this.panel.querySelector('.mira-messages')!;
    this.typingEl = this.panel.querySelector('.mira-typing')!;
    this.errorEl = this.panel.querySelector('.mira-error')!;
    this.inputEl = this.panel.querySelector('.mira-input')!;
    this.bubble.addEventListener('click', () => this.togglePanel());
    this.bubble.addEventListener('animationend', (event) => {
      if (event.animationName.startsWith('mira-attention'))
        this.bubble.classList.add('mira-attention-played');
    });
    this.panel.querySelector('.mira-send')!.addEventListener('click', () => void this.submit());
    this.panel
      .querySelector('.mira-header-close')!
      .addEventListener('click', () => this.closePanel());
    this.panel
      .querySelector('.mira-expand')!
      .addEventListener('click', () => this.setFullscreen(!this.fullscreen));
    this.backdrop.addEventListener('click', () => this.setFullscreen(false));
    this.panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (this.fullscreen) this.setFullscreen(false);
        else this.closePanel();
      }
      if (event.key === 'Tab' && this.fullscreen) this.trapFocus(event);
    });
    this.inputEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        void this.submit();
      }
    });
    this.inputEl.addEventListener('input', () => {
      this.resizeInput();
      this.updateSendButton();
      this.handleTyping();
    });
    this.doc.body.append(this.backdrop, this.bubble, this.triggerEl, this.panel);
    this.configureAppearance(options);
    if (options.fullscreen) this.setFullscreen(true);
  }

  openPanel(): void {
    if (this.destroyed) return;
    this.panel.classList.add('mira-open');
    this.panel.inert = false;
    this.bubble.classList.add('mira-bubble-open');
    this.bubble.setAttribute('aria-expanded', 'true');
    this.bubble.setAttribute('aria-label', 'بستن گفتگوی پشتیبانی');
    this.hideTriggerBubble();
    // در موبایل باز شدن چت نباید با نمایش صفحه‌کلید، مسیرهای شروع را بپوشاند.
    if (this.view.matchMedia('(hover: hover) and (pointer: fine)').matches)
      this.inputEl.focus({ preventScroll: true });
    else if (this.fullscreen)
      this.panel
        .querySelector<HTMLButtonElement>('.mira-header-close')
        ?.focus({ preventScroll: true });
  }

  private closePanel(): void {
    if (this.fullscreen) this.setFullscreen(false);
    this.panel.classList.remove('mira-open');
    this.panel.classList.remove('mira-replay');
    this.panel.inert = true;
    this.bubble.classList.remove('mira-bubble-open');
    this.bubble.setAttribute('aria-expanded', 'false');
    this.bubble.setAttribute('aria-label', 'باز کردن گفتگوی پشتیبانی');
    this.callbacks.onTypingChange(false);
    this.bubble.focus({ preventScroll: true });
  }

  setFullscreen(fullscreen: boolean): void {
    if (this.fullscreen === fullscreen) return;
    this.fullscreen = fullscreen;
    this.panel.classList.toggle('mira-fullscreen', fullscreen);
    this.backdrop.classList.toggle('mira-open', fullscreen);
    this.bubble.classList.toggle('mira-launcher-hidden', fullscreen);
    this.panel.setAttribute('aria-modal', String(fullscreen));
    const expand = this.panel.querySelector('.mira-expand') as HTMLButtonElement;
    expand.innerHTML = fullscreen ? icons.restore : icons.expand;
    expand.setAttribute('aria-pressed', String(fullscreen));
    expand.setAttribute('aria-label', fullscreen ? 'کوچک کردن گفتگو' : 'تمام‌صفحه کردن گفتگو');
    expand.title = fullscreen ? 'کوچک کردن' : 'تمام‌صفحه';
    if (fullscreen) {
      this.bodyOverflow = this.doc.body.style.overflow;
      this.doc.body.style.overflow = 'hidden';
      this.openPanel();
    } else {
      this.doc.body.style.overflow = this.bodyOverflow;
      if (!expand.hidden) expand.focus({ preventScroll: true });
      else
        this.panel
          .querySelector<HTMLButtonElement>('.mira-header-close')
          ?.focus({ preventScroll: true });
    }
  }

  configureAppearance(options: WidgetUiOptions): void {
    if (options.appearance) this.appearance = normalizeWidgetAppearance(options.appearance);
    else if (!this.panel.dataset.appearance) this.appearance = normalizeWidgetAppearance(undefined);
    this.primaryColor = hexColor(options.color) ?? this.primaryColor;
    this.accentColor = hexColor(options.accentColor) ?? this.accentColor;
    if (options.appearance) {
      this.primaryColor = hexColor(options.color) ?? this.appearance.color;
      this.accentColor = hexColor(options.accentColor) ?? this.appearance.accentColor;
    }
    const surface = this.appearance.surfaceColor;
    const neutral = colorTokens('#64748b', '--mira-neutral', surface);
    const primary = colorTokens(this.primaryColor, '--mira-color', surface);
    const accent = colorTokens(this.accentColor, '--mira-accent', surface);
    const ink = contrast('#ffffff', surface) > contrast('#000000', surface) ? '#f5f7fa' : '#1c2b49';
    const tokens = {
      ...primary,
      ...accent,
      '--mira-gradient': this.primaryColor,
      '--mira-teal': accent['--mira-accent-ink'],
      '--mira-surface': surface,
      '--mira-ink': colorTokens(ink, '--ink', surface)['--ink-ink'],
      '--mira-muted': neutral['--mira-neutral-ink'],
      '--mira-line': blendColor(ink, surface, 0.16),
      '--mira-soft': blendColor(ink, surface, 0.035),
      '--mira-success': colorTokens('#137d71', '--success', surface)['--success-ink'],
      '--mira-danger': colorTokens('#a33437', '--danger', surface)['--danger-ink'],
      '--mira-panel-width': { compact: '390px', comfortable: '560px', wide: '680px' }[
        this.appearance.panelWidth
      ],
      '--mira-panel-radius': { soft: '32px', rounded: '24px', square: '6px' }[
        this.appearance.radius
      ],
      '--mira-card-radius': { soft: '22px', rounded: '16px', square: '5px' }[
        this.appearance.radius
      ],
    };
    const position = options.position ?? this.appearance.position;
    for (const element of [this.bubble, this.triggerEl, this.panel]) {
      for (const [name, value] of Object.entries(tokens)) element.style.setProperty(name, value);
      element.classList.toggle('mira-pos-left', position === 'bottom-left');
      element.classList.toggle('mira-pos-right', position === 'bottom-right');
    }
    this.panel.dataset.appearance = '1';
    this.panel.dataset.density = this.appearance.density;
    this.panel.dataset.panelMotion = this.appearance.motion.panel;
    this.bubble.dataset.launcherMotion = this.appearance.motion.launcher;
    this.bubble.classList.toggle('mira-launcher-icon', this.appearance.launcher.style === 'icon');
    this.bubble.querySelector('.mira-launcher-label')!.textContent = this.appearance.launcher.label;
    this.bubble.title = this.appearance.launcher.label;
    for (const feature of ['products', 'sources', 'copy'] as const)
      this.panel.classList.toggle(`mira-hide-${feature}`, !this.appearance.features[feature]);
    (this.panel.querySelector('.mira-expand') as HTMLButtonElement).hidden =
      !this.appearance.features.fullscreen;
    this.renderActions();
    this.renderWelcome();
  }

  private actionElement(action: WidgetAction, card: boolean): HTMLElement | null {
    if (!action.enabled || (action.type === 'human' && !this.appearance.features.human))
      return null;
    const url = action.type === 'link' && action.value ? safeHttpUrl(action.value) : null;
    if (action.type === 'link' && !url) return null;
    const element = this.doc.createElement(action.type === 'link' ? 'a' : 'button');
    element.className = card ? 'mira-intent' : 'mira-action';
    if (!card && ['shopping', 'shipping', 'human'].includes(action.id))
      element.classList.add(`mira-${action.id}`);
    if (action.type === 'human') element.classList.add('mira-human');
    element.dataset.actionId = action.id;
    if (url) {
      const link = element as HTMLAnchorElement;
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    } else {
      (element as HTMLButtonElement).type = 'button';
      element.addEventListener('click', () =>
        this.sendPrompt(action.type === 'human' ? HUMAN_PROMPT : action.value || action.label),
      );
    }
    if (card) {
      element.innerHTML = `<span class="mira-intent-icon">${icons[action.icon]}</span><span class="mira-intent-copy"><strong></strong><small></small></span>${icons.arrow}`;
      element.querySelector('strong')!.textContent = action.label;
      element.querySelector('small')!.textContent = action.hint;
    } else {
      element.innerHTML = `${icons[action.icon]}<span></span>`;
      element.querySelector('span')!.textContent = action.label;
      if (action.hint) element.title = action.hint;
    }
    return element;
  }

  private renderActions(): void {
    const actions = this.panel.querySelector('.mira-actions')!;
    actions.replaceChildren();
    for (const action of this.appearance.actions) {
      const element = this.actionElement(action, false);
      if (element) actions.appendChild(element);
    }
    (actions as HTMLElement).hidden = !actions.childElementCount;
  }

  replayAnimations(): void {
    if (this.destroyed) return;
    this.panel.classList.remove('mira-replay');
    this.bubble.classList.remove('mira-replay');
    this.bubble.classList.remove('mira-attention-played');
    void this.panel.offsetWidth;
    this.panel.classList.add('mira-replay');
    this.bubble.classList.add('mira-replay');
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.typingTimeout) this.view.clearTimeout(this.typingTimeout);
    if (this.aiTimeout) this.view.clearTimeout(this.aiTimeout);
    if (this.moderationTimeout) this.view.clearTimeout(this.moderationTimeout);
    if (this.fullscreen) this.doc.body.style.overflow = this.bodyOverflow;
    this.callbacks.onTypingChange(false);
    for (const element of [this.panel, this.bubble, this.triggerEl, this.backdrop])
      element.remove();
  }

  private togglePanel(): void {
    if (this.panel.classList.contains('mira-open')) this.closePanel();
    else this.openPanel();
  }

  private trapFocus(event: KeyboardEvent): void {
    const items = Array.from(
      this.panel.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], textarea, select, input:not(:disabled)',
      ),
    ).filter((element) => element.getClientRects().length > 0);
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && this.doc.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && this.doc.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  private sendPrompt(prompt: string): void {
    // پیش‌نویس بازدیدکننده با یک میان‌بر جایگزین نمی‌شود.
    if (this.inputEl.value.trim() && this.inputEl.value.trim() !== prompt) {
      this.showError('برای استفاده از پیشنهاد، ابتدا پیام فعلی را ارسال یا پاک کنید.');
      this.inputEl.focus();
      return;
    }
    this.inputEl.value = prompt;
    this.resizeInput();
    this.updateSendButton();
    this.inputEl.focus({ preventScroll: true });
    void this.submit();
  }

  private async submit(): Promise<void> {
    const value = this.inputEl.value.trim();
    if (!value || this.sending || !this.connected || this.isRestricted()) return;
    this.sending = true;
    this.showError('');
    this.updateSendButton();
    try {
      await this.callbacks.onSend(value);
      if (this.inputEl.value.trim() === value) this.inputEl.value = '';
      this.resizeInput();
      this.callbacks.onTypingChange(false);
    } catch (error) {
      this.showError(
        error instanceof WidgetSendError
          ? error.message
          : 'ارسال انجام نشد. پیام شما حفظ شده؛ دوباره ارسال کنید.',
      );
    } finally {
      this.sending = false;
      this.updateSendButton();
    }
  }

  private handleTyping(): void {
    if (!this.connected || this.isRestricted()) return;
    this.callbacks.onTypingChange(Boolean(this.inputEl.value.trim()));
    if (this.typingTimeout) this.view.clearTimeout(this.typingTimeout);
    this.typingTimeout = this.view.setTimeout(() => this.callbacks.onTypingChange(false), 2000);
  }

  private resizeInput(): void {
    this.inputEl.style.height = 'auto';
    this.inputEl.style.height = `${Math.min(120, this.inputEl.scrollHeight)}px`;
  }

  appendMessage(content: string, senderType: MessageSenderType, message?: MessagePayload): void {
    if (this.destroyed) return;
    if (message && this.seenMessages.has(message.id)) return;
    if (message) this.seenMessages.add(message.id);
    this.messageCount++;
    this.messagesEl.querySelector('.mira-welcome')?.remove();
    if (senderType !== MessageSenderType.VISITOR) this.clearAiStatus();
    const nearBottom =
      this.messagesEl.scrollHeight - this.messagesEl.scrollTop - this.messagesEl.clientHeight < 100;
    const el = this.doc.createElement('div');
    el.className = `mira-msg mira-msg-${senderType}`;
    const meta = this.doc.createElement('div');
    meta.className = 'mira-msg-meta';
    const label = this.doc.createElement('span');
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
      const copy = this.doc.createElement('button');
      copy.type = 'button';
      copy.className = 'mira-copy';
      copy.innerHTML = `${icons.copy}<span>کپی پاسخ</span>`;
      copy.setAttribute('aria-label', 'کپی پاسخ');
      copy.onclick = async () => {
        try {
          if (!this.view.navigator.clipboard) throw new Error('clipboard unavailable');
          await this.view.navigator.clipboard.writeText(content);
          copy.querySelector('span')!.textContent = 'کپی شد';
        } catch {
          this.showError('کپی متن در این مرورگر ممکن نیست');
        }
      };
      meta.appendChild(copy);
    }
    el.appendChild(meta);
    const body = this.doc.createElement('div');
    body.className = 'mira-msg-body';
    body.textContent = content;
    el.appendChild(body);
    if (message?.aiMetadata && senderType === MessageSenderType.BOT) {
      this.appendProducts(el, message.aiMetadata.products ?? []);
      for (const source of message.aiMetadata.sources ?? []) {
        const url = source.url && safeHttpUrl(source.url);
        const chip = this.doc.createElement(url ? 'a' : 'span');
        chip.className = 'mira-source';
        chip.textContent = `↗ ${source.title}`;
        if (url && chip.tagName === 'A') {
          (chip as HTMLAnchorElement).href = url;
          (chip as HTMLAnchorElement).target = '_blank';
          (chip as HTMLAnchorElement).rel = 'noopener noreferrer';
        }
        el.appendChild(chip);
      }
    }
    this.messagesEl.appendChild(el);
    if (nearBottom || senderType === MessageSenderType.VISITOR)
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private appendProducts(parent: HTMLElement, products: AiProduct[]): void {
    const safeProducts = products.filter((product) => safeHttpUrl(product.url));
    if (!safeProducts.length) return;
    const result = this.doc.createElement('section');
    result.className = 'mira-product-result';
    result.setAttribute('aria-label', 'محصولات پیشنهادی این پاسخ');
    const heading = this.doc.createElement('div');
    heading.className = 'mira-product-heading';
    heading.innerHTML = `${icons.box}<span>پیشنهادهای این پاسخ</span><small>${safeProducts.length.toLocaleString('fa-IR')} محصول</small>`;
    result.appendChild(heading);
    const cards = this.doc.createElement('div');
    cards.className = 'mira-products';
    cards.setAttribute('aria-label', 'مرور محصولات پیشنهادی');
    const controls = this.doc.createElement('div');
    controls.className = 'mira-product-controls';
    const sortLabel = this.doc.createElement('label');
    sortLabel.textContent = 'مرتب‌سازی';
    const sort = this.doc.createElement('select');
    sort.className = 'mira-product-sort';
    sort.setAttribute('aria-label', 'مرتب‌سازی پیشنهادهای این پاسخ');
    for (const [value, title] of [
      ['relevant', 'ترتیب پیشنهاد'],
      ['price-asc', 'قیمت کمتر'],
      ['price-desc', 'قیمت بیشتر'],
    ]) {
      const option = this.doc.createElement('option');
      option.value = value;
      option.textContent = title;
      sort.appendChild(option);
    }
    sortLabel.appendChild(sort);
    const stockLabel = this.doc.createElement('label');
    const stock = this.doc.createElement('input');
    stock.type = 'checkbox';
    stock.className = 'mira-stock-filter';
    stockLabel.append(stock, this.doc.createTextNode('فقط موجودها'));
    controls.append(sortLabel, stockLabel);
    if (safeProducts.length > 1) result.appendChild(controls);
    const render = () => {
      let visible = safeProducts.filter((product) => !stock.checked || product.inStock);
      if (sort.value !== 'relevant') {
        const currencies = new Set(visible.map((product) => product.currency));
        // قیمت‌های دو واحد پول متفاوت با هم مقایسه نمی‌شوند.
        if (currencies.size === 1)
          visible = [...visible].sort(
            (a, b) => (Number(a.price) - Number(b.price)) * (sort.value === 'price-asc' ? 1 : -1),
          );
      }
      cards.replaceChildren(...visible.map((product) => this.productCard(product)));
      if (!visible.length) {
        const empty = this.doc.createElement('div');
        empty.className = 'mira-product-empty';
        empty.textContent = 'در این پیشنهادها محصول موجودی نیست. فیلتر را بردارید.';
        cards.appendChild(empty);
      }
      cards.scrollLeft = 0;
    };
    if (new Set(safeProducts.map((product) => product.currency)).size > 1) sort.disabled = true;
    sort.addEventListener('change', render);
    stock.addEventListener('change', render);
    render();
    result.appendChild(cards);
    parent.appendChild(result);
  }

  private productCard(product: AiProduct): HTMLAnchorElement {
    const card = this.doc.createElement('a');
    card.className = 'mira-product';
    card.href = safeHttpUrl(product.url)!;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    const media = this.doc.createElement('span');
    media.className = 'mira-product-icon';
    media.innerHTML = icons.box;
    media.setAttribute('aria-hidden', 'true');
    const imageUrl = product.imageUrl && safeHttpUrl(product.imageUrl);
    if (imageUrl) {
      const image = this.doc.createElement('img');
      image.src = imageUrl;
      image.alt = product.name;
      image.width = 220;
      image.height = 164;
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      image.addEventListener('error', () => image.replaceWith(media), { once: true });
      card.appendChild(image);
    } else card.appendChild(media);
    const name = this.doc.createElement('strong');
    name.textContent = product.name;
    const stock = this.doc.createElement('small');
    stock.textContent = product.inStock ? 'موجود در فروشگاه' : 'در حال حاضر ناموجود';
    if (!product.inStock) stock.className = 'mira-out-of-stock';
    const price = this.doc.createElement('b');
    price.textContent = formatProductPrice(product);
    const view = this.doc.createElement('span');
    view.className = 'mira-product-link';
    view.innerHTML = `مشاهده در فروشگاه ${icons.external}`;
    card.append(name, stock, price, view);
    return card;
  }

  configureAssistant(assistant?: WidgetAssistant): void {
    this.assistant = assistant;
    const store = assistant?.siteName?.trim() || 'فروشگاه';
    if (assistant?.enabled) this.botName = assistant.name;
    this.panel.querySelector('.mira-header-title')!.textContent = assistant?.enabled
      ? this.botName
      : `پشتیبانی ${store}`;
    this.panel.querySelector('.mira-header-sub')!.textContent = assistant?.enabled
      ? `دستیار ${store} · همراه با پشتیبان انسانی`
      : `${store} · پاسخ‌گوی شما`;
    this.renderMark(this.panel.querySelector('.mira-header-logo')!);
    this.renderMark(this.bubble.querySelector('.mira-icon-chat')!);
    this.renderWelcome();
  }

  private renderMark(target: Element): void {
    target.innerHTML = icons.mark;
    const url = this.assistant?.avatarUrl && safeHttpUrl(this.assistant.avatarUrl);
    if (!url) return;
    const avatar = this.doc.createElement('img');
    avatar.src = url;
    avatar.alt = '';
    avatar.width = 46;
    avatar.height = 46;
    avatar.referrerPolicy = 'no-referrer';
    target.replaceChildren(avatar);
  }

  private renderWelcome(): void {
    if (this.messageCount) return;
    const assistant = this.assistant;
    const existing = this.messagesEl.querySelector('.mira-welcome');
    const welcome = this.doc.createElement('div');
    welcome.className = 'mira-welcome';
    welcome.innerHTML = `<div class="mira-welcome-hero"><div class="mira-welcome-heading"><div class="mira-welcome-eyebrow">${icons.spark}<span></span></div><h1></h1></div><div class="mira-welcome-mark" aria-hidden="true"><span class="mira-welcome-avatar"></span><span>قدم‌به‌قدم</span></div></div>`;
    welcome.querySelector('.mira-welcome-eyebrow span')!.textContent =
      this.appearance.welcome.eyebrow;
    welcome.querySelector('h1')!.textContent = this.appearance.welcome.title;
    this.renderMark(welcome.querySelector('.mira-welcome-avatar')!);
    const text = this.doc.createElement('p');
    text.textContent =
      this.appearance.welcome.description ||
      (assistant?.enabled
        ? assistant.greeting || 'بگویید چه می‌خواهید؛ با توجه به نیاز و بودجه شما پیش می‌رویم.'
        : 'سوالتان را بنویسید تا همکاران ما راهنمایی‌تان کنند.');
    welcome.appendChild(text);
    const intents = this.doc.createElement('div');
    intents.className = 'mira-intents';
    for (const action of this.appearance.welcome.cards) {
      const element = this.actionElement(action, true);
      if (element) intents.appendChild(element);
    }
    welcome.appendChild(intents);
    if (
      assistant?.enabled &&
      assistant.quickReplies.length &&
      this.appearance.features.quickReplies
    ) {
      const quickTitle = this.doc.createElement('div');
      quickTitle.className = 'mira-quick-title';
      quickTitle.textContent = 'یا با یک سوال شروع کنید';
      const quick = this.doc.createElement('div');
      quick.className = 'mira-quick';
      for (const prompt of assistant.quickReplies) {
        const button = this.doc.createElement('button');
        button.type = 'button';
        button.textContent = prompt;
        button.onclick = () => this.sendPrompt(prompt);
        quick.appendChild(button);
      }
      welcome.append(quickTitle, quick);
    }
    if (existing) existing.replaceWith(welcome);
    else this.messagesEl.appendChild(welcome);
  }

  resetConversation(message = ''): void {
    this.hideCsatPrompt();
    this.clearAiStatus();
    this.setTypingIndicator(false);
    this.seenMessages.clear();
    this.messageCount = 0;
    this.messagesEl.replaceChildren();
    this.renderWelcome();
    this.showError(message);
  }

  private isRestricted(): boolean {
    const now = Date.now();
    return (
      (this.moderation.blocked &&
        (!this.moderation.blockedUntil ||
          new Date(this.moderation.blockedUntil).getTime() > now)) ||
      !!(this.moderation.mutedUntil && new Date(this.moderation.mutedUntil).getTime() > now)
    );
  }

  setVisitorModeration(value?: VisitorModeration): void {
    this.moderation = value
      ? { blocked: value.blocked, blockedUntil: value.blockedUntil, mutedUntil: value.mutedUntil }
      : { blocked: false, blockedUntil: null, mutedUntil: null };
    if (this.moderationTimeout) this.view.clearTimeout(this.moderationTimeout);
    this.moderationTimeout = null;
    const now = Date.now();
    const blocked =
      this.moderation.blocked &&
      (!this.moderation.blockedUntil || new Date(this.moderation.blockedUntil).getTime() > now);
    const muted =
      this.moderation.mutedUntil && new Date(this.moderation.mutedUntil).getTime() > now;
    const until = blocked
      ? this.moderation.blockedUntil
      : muted
        ? this.moderation.mutedUntil
        : null;
    const expiry = until
      ? new Date(until).toLocaleString('fa-IR', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
    this.panel.querySelector('.mira-moderation')!.textContent = blocked
      ? `ارسال پیام برای این کاربر غیرفعال است.${expiry ? ` پایان محدودیت: ${expiry}` : ''}`
      : muted
        ? `ارسال پیام موقتاً متوقف شده است. پایان سکوت: ${expiry}`
        : '';
    if (blocked || muted) {
      this.clearAiStatus();
      this.callbacks.onTypingChange(false);
    }
    this.updateSendButton();
    const deadlines = [this.moderation.blockedUntil, this.moderation.mutedUntil]
      .filter((date): date is string => !!date)
      .map((date) => new Date(date).getTime())
      .filter((date) => date > now);
    if (deadlines.length)
      this.moderationTimeout = this.view.setTimeout(
        () => this.setVisitorModeration(this.moderation),
        Math.min(Math.min(...deadlines) - now + 50, 2_147_483_647),
      );
  }

  setConnected(connected: boolean): void {
    this.connected = connected;
    this.panel.classList.toggle('mira-connected', connected);
    this.panel.querySelector('.mira-connection')!.textContent = connected
      ? 'متصل · آماده گفتگو'
      : 'در حال اتصال…';
    this.updateSendButton();
    if (!connected) {
      this.clearAiStatus();
      this.showError('در حال اتصال به پشتیبانی… پیام شما حفظ می‌شود.');
    } else this.showError('');
  }

  private updateSendButton(): void {
    (this.panel.querySelector('.mira-send') as HTMLButtonElement).disabled =
      !this.connected || this.sending || this.isRestricted() || !this.inputEl.value.trim();
    this.panel.querySelector('.mira-input-row')!.setAttribute('aria-busy', String(this.sending));
  }

  setAiStatus(payload: AiStatusPayload): void {
    if (payload.stage === 'idle') {
      if (this.aiMessageId === payload.messageId) this.clearAiStatus();
      return;
    }
    this.clearAiStatus();
    this.aiMessageId = payload.messageId;
    const el = this.panel.querySelector('.mira-ai-status')!;
    const spinner = this.doc.createElement('span');
    spinner.className = 'mira-thinking';
    spinner.textContent = '✦';
    spinner.setAttribute('aria-hidden', 'true');
    el.append(spinner, this.doc.createTextNode(AI_STATUS_LABELS[payload.stage]));
    const dots = this.doc.createElement('span');
    dots.className = 'mira-dots';
    dots.setAttribute('aria-hidden', 'true');
    dots.innerHTML = '<i></i><i></i><i></i>';
    el.appendChild(dots);
    this.aiTimeout = this.view.setTimeout(() => this.clearAiStatus(), 60_000);
  }

  clearAiStatus(): void {
    if (this.aiTimeout) this.view.clearTimeout(this.aiTimeout);
    this.aiTimeout = null;
    this.aiMessageId = null;
    this.panel.querySelector('.mira-ai-status')!.textContent = '';
  }

  setTypingIndicator(visible: boolean): void {
    this.typingEl.innerHTML = visible
      ? '<span class="mira-dots" aria-hidden="true"><i></i><i></i><i></i></span> پشتیبان در حال نوشتن است…'
      : '';
  }

  showError(message: string): void {
    this.errorEl.textContent = message;
  }

  showTriggerBubble(text: string, onOpen: () => void): void {
    const open = this.doc.createElement('button');
    open.type = 'button';
    open.className = 'mira-trigger-open';
    open.textContent = text;
    open.onclick = () => {
      this.openPanel();
      onOpen();
    };
    const close = this.doc.createElement('button');
    close.type = 'button';
    close.className = 'mira-trigger-close';
    close.textContent = '×';
    close.setAttribute('aria-label', 'بستن پیام');
    close.onclick = () => this.hideTriggerBubble();
    this.triggerEl.replaceChildren(open, close);
    if (!this.panel.classList.contains('mira-open')) this.triggerEl.classList.add('mira-open');
  }

  hideTriggerBubble(): void {
    this.triggerEl.classList.remove('mira-open');
  }

  showCsatPrompt(onSubmit: (score: number, comment: string) => void): void {
    this.hideCsatPrompt();
    const card = this.doc.createElement('div');
    card.className = 'mira-csat';
    card.innerHTML =
      '<div>این گفتگو به پایان رسید. از پاسخ‌گویی چقدر راضی بودید؟</div><div class="mira-csat-stars" role="group" aria-label="امتیاز گفتگو"></div><button type="button" class="mira-csat-submit" disabled>ارسال امتیاز</button>';
    const starsEl = card.querySelector('.mira-csat-stars')!;
    const submitButton = card.querySelector('.mira-csat-submit') as HTMLButtonElement;
    let selectedScore = 0;
    for (let i = 1; i <= 5; i++) {
      const star = this.doc.createElement('button');
      star.type = 'button';
      star.className = 'mira-csat-star';
      star.textContent = '★';
      star.setAttribute('aria-label', `${i.toLocaleString('fa-IR')} از ۵`);
      star.setAttribute('aria-pressed', 'false');
      star.onclick = () => {
        selectedScore = i;
        submitButton.disabled = false;
        starsEl.querySelectorAll('.mira-csat-star').forEach((el, index) => {
          el.classList.toggle('mira-active', index < selectedScore);
          el.setAttribute('aria-pressed', String(index + 1 === selectedScore));
        });
      };
      starsEl.appendChild(star);
    }
    submitButton.onclick = () => {
      if (selectedScore < 1) return;
      onSubmit(selectedScore, '');
      card.textContent = 'از اینکه نظرتان را با ما در میان گذاشتید متشکریم.';
    };
    this.csatCardEl = card;
    this.messagesEl.appendChild(card);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  hideCsatPrompt(): void {
    this.csatCardEl?.remove();
    this.csatCardEl = null;
  }
}
