import {
  MessageSenderType,
  AI_STATUS_LABELS,
  safeHttpUrl,
  formatProductPrice,
} from '@mira/shared-types';
import type {
  MessagePayload,
  AiStatusPayload,
  WidgetAssistant,
  AiProduct,
} from '@mira/shared-types';
import { icons } from './icons';
import { injectStyles } from './styles';

export interface WidgetUiOptions {
  color?: string;
  // موقعیت فیزیکی حباب مستقل از جهت متن سایت میزبان است.
  position?: 'bottom-right' | 'bottom-left';
  fullscreen?: boolean;
  fontUrl?: string;
}

export interface WidgetUiCallbacks {
  onSend: (content: string) => Promise<void>;
  onTypingChange: (isTyping: boolean) => void;
}

const HUMAN_PROMPT = 'می‌خواهم با اپراتور انسانی صحبت کنم';

export class WidgetUi {
  readonly bubble: HTMLButtonElement;
  readonly panel: HTMLDivElement;
  private readonly messagesEl: HTMLDivElement;
  private readonly typingEl: HTMLDivElement;
  private readonly inputEl: HTMLTextAreaElement;
  private readonly errorEl: HTMLDivElement;
  private readonly triggerEl: HTMLDivElement;
  private readonly backdrop: HTMLDivElement;
  private csatCardEl: HTMLDivElement | null = null;
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly seenMessages = new Set<string>();
  private aiTimeout: ReturnType<typeof setTimeout> | null = null;
  private aiMessageId: string | null = null;
  private sending = false;
  private connected = false;
  private fullscreen = false;
  private bodyOverflow = '';
  private botName = 'دستیار میرا';
  private messageCount = 0;

  constructor(
    private readonly callbacks: WidgetUiCallbacks,
    options: WidgetUiOptions = {},
  ) {
    injectStyles();
    const fontUrl = options.fontUrl && safeHttpUrl(options.fontUrl);
    if (fontUrl && !document.getElementById('mira-widget-font')) {
      const font = document.createElement('style');
      font.id = 'mira-widget-font';
      font.textContent = `@font-face { font-family: MiraVazirmatn; src: url(${JSON.stringify(fontUrl)}) format('woff2'); font-weight: 100 900; font-style: normal; font-display: swap; } .mira-panel, .mira-bubble, .mira-trigger { font-family: MiraVazirmatn, Vazirmatn, Tahoma, Arial, sans-serif; }`;
      document.head.appendChild(font);
    }
    const positionClass = options.position === 'bottom-left' ? 'mira-pos-left' : 'mira-pos-right';
    this.bubble = document.createElement('button');
    this.bubble.type = 'button';
    this.bubble.className = `mira-bubble ${positionClass}`;
    this.bubble.setAttribute('aria-label', 'باز کردن گفتگوی پشتیبانی');
    this.bubble.setAttribute('aria-expanded', 'false');
    this.bubble.setAttribute('aria-controls', 'mira-chat-panel');
    this.bubble.innerHTML = `<span class="mira-icon mira-icon-chat">${icons.mark}</span><span class="mira-launcher-label">دستیار خرید میرا</span><span class="mira-icon mira-icon-close">${icons.close}</span>`;
    this.triggerEl = document.createElement('div');
    this.triggerEl.className = `mira-trigger ${positionClass}`;
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'mira-backdrop';
    this.backdrop.setAttribute('aria-hidden', 'true');
    this.panel = document.createElement('div');
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
    this.configureAppearance(options);
    this.bubble.addEventListener('click', () => this.togglePanel());
    this.panel.querySelector('.mira-send')!.addEventListener('click', () => void this.submit());
    this.panel
      .querySelector('.mira-header-close')!
      .addEventListener('click', () => this.closePanel());
    this.panel
      .querySelector('.mira-expand')!
      .addEventListener('click', () => this.setFullscreen(!this.fullscreen));
    this.backdrop.addEventListener('click', () => this.setFullscreen(false));
    this.panel
      .querySelector('.mira-human')!
      .addEventListener('click', () => this.sendPrompt(HUMAN_PROMPT));
    this.panel
      .querySelector('.mira-shopping')!
      .addEventListener('click', () =>
        this.sendPrompt('برای انتخاب محصول مناسب با نیاز و بودجه‌ام راهنمایی‌ام کن.'),
      );
    this.panel
      .querySelector('.mira-shipping')!
      .addEventListener('click', () => this.sendPrompt('شرایط و زمان ارسال سفارش چیست؟'));
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
    document.body.append(this.backdrop, this.bubble, this.triggerEl, this.panel);
    this.configureAssistant();
    if (options.fullscreen) this.setFullscreen(true);
  }

  openPanel(): void {
    this.panel.classList.add('mira-open');
    this.panel.inert = false;
    this.bubble.classList.add('mira-bubble-open');
    this.bubble.setAttribute('aria-expanded', 'true');
    this.bubble.setAttribute('aria-label', 'بستن گفتگوی پشتیبانی');
    this.hideTriggerBubble();
    // در موبایل باز شدن چت نباید با نمایش صفحه‌کلید، مسیرهای شروع را بپوشاند.
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches)
      this.inputEl.focus({ preventScroll: true });
  }

  private closePanel(): void {
    if (this.fullscreen) this.setFullscreen(false);
    this.panel.classList.remove('mira-open');
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
      this.bodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      this.openPanel();
    } else {
      document.body.style.overflow = this.bodyOverflow;
      expand.focus({ preventScroll: true });
    }
  }

  configureAppearance(options: WidgetUiOptions): void {
    for (const element of [this.bubble, this.triggerEl, this.panel]) {
      if (options.color) {
        element.style.setProperty('--mira-color', options.color);
        element.style.setProperty('--mira-gradient', options.color);
      }
      if (options.position) {
        element.classList.toggle('mira-pos-left', options.position === 'bottom-left');
        element.classList.toggle('mira-pos-right', options.position === 'bottom-right');
      }
    }
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
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
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
    if (!value || this.sending || !this.connected) return;
    this.sending = true;
    this.showError('');
    this.updateSendButton();
    try {
      await this.callbacks.onSend(value);
      if (this.inputEl.value.trim() === value) this.inputEl.value = '';
      this.resizeInput();
      this.callbacks.onTypingChange(false);
    } catch {
      this.showError('ارسال انجام نشد. پیام شما حفظ شده؛ دوباره ارسال کنید.');
    } finally {
      this.sending = false;
      this.updateSendButton();
    }
  }

  private handleTyping(): void {
    if (!this.connected) return;
    this.callbacks.onTypingChange(Boolean(this.inputEl.value.trim()));
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => this.callbacks.onTypingChange(false), 2000);
  }

  private resizeInput(): void {
    this.inputEl.style.height = 'auto';
    this.inputEl.style.height = `${Math.min(120, this.inputEl.scrollHeight)}px`;
  }

  appendMessage(content: string, senderType: MessageSenderType, message?: MessagePayload): void {
    if (message && this.seenMessages.has(message.id)) return;
    if (message) this.seenMessages.add(message.id);
    this.messageCount++;
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
      copy.type = 'button';
      copy.className = 'mira-copy';
      copy.innerHTML = `${icons.copy}<span>کپی پاسخ</span>`;
      copy.setAttribute('aria-label', 'کپی پاسخ');
      copy.onclick = async () => {
        try {
          if (!navigator.clipboard) throw new Error('clipboard unavailable');
          await navigator.clipboard.writeText(content);
          copy.querySelector('span')!.textContent = 'کپی شد';
        } catch {
          this.showError('کپی متن در این مرورگر ممکن نیست');
        }
      };
      meta.appendChild(copy);
    }
    el.appendChild(meta);
    const body = document.createElement('div');
    body.className = 'mira-msg-body';
    body.textContent = content;
    el.appendChild(body);
    if (message?.aiMetadata && senderType === MessageSenderType.BOT) {
      this.appendProducts(el, message.aiMetadata.products ?? []);
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

  private appendProducts(parent: HTMLElement, products: AiProduct[]): void {
    const safeProducts = products.filter((product) => safeHttpUrl(product.url));
    if (!safeProducts.length) return;
    const result = document.createElement('section');
    result.className = 'mira-product-result';
    result.setAttribute('aria-label', 'محصولات پیشنهادی این پاسخ');
    const heading = document.createElement('div');
    heading.className = 'mira-product-heading';
    heading.innerHTML = `${icons.box}<span>پیشنهادهای این پاسخ</span><small>${safeProducts.length.toLocaleString('fa-IR')} محصول</small>`;
    result.appendChild(heading);
    const cards = document.createElement('div');
    cards.className = 'mira-products';
    cards.setAttribute('aria-label', 'مرور محصولات پیشنهادی');
    const controls = document.createElement('div');
    controls.className = 'mira-product-controls';
    const sortLabel = document.createElement('label');
    sortLabel.textContent = 'مرتب‌سازی';
    const sort = document.createElement('select');
    sort.className = 'mira-product-sort';
    sort.setAttribute('aria-label', 'مرتب‌سازی پیشنهادهای این پاسخ');
    for (const [value, title] of [
      ['relevant', 'ترتیب پیشنهاد'],
      ['price-asc', 'قیمت کمتر'],
      ['price-desc', 'قیمت بیشتر'],
    ]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = title;
      sort.appendChild(option);
    }
    sortLabel.appendChild(sort);
    const stockLabel = document.createElement('label');
    const stock = document.createElement('input');
    stock.type = 'checkbox';
    stock.className = 'mira-stock-filter';
    stockLabel.append(stock, document.createTextNode('فقط موجودها'));
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
        const empty = document.createElement('div');
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
    const card = document.createElement('a');
    card.className = 'mira-product';
    card.href = safeHttpUrl(product.url)!;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    const media = document.createElement('span');
    media.className = 'mira-product-icon';
    media.innerHTML = icons.box;
    media.setAttribute('aria-hidden', 'true');
    const imageUrl = product.imageUrl && safeHttpUrl(product.imageUrl);
    if (imageUrl) {
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = product.name;
      image.width = 220;
      image.height = 164;
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      image.addEventListener('error', () => image.replaceWith(media), { once: true });
      card.appendChild(image);
    } else card.appendChild(media);
    const name = document.createElement('strong');
    name.textContent = product.name;
    const stock = document.createElement('small');
    stock.textContent = product.inStock ? 'موجود در فروشگاه' : 'در حال حاضر ناموجود';
    if (!product.inStock) stock.className = 'mira-out-of-stock';
    const price = document.createElement('b');
    price.textContent = formatProductPrice(product);
    const view = document.createElement('span');
    view.className = 'mira-product-link';
    view.innerHTML = `مشاهده در فروشگاه ${icons.external}`;
    card.append(name, stock, price, view);
    return card;
  }

  configureAssistant(assistant?: WidgetAssistant): void {
    const store = assistant?.siteName?.trim() || 'فروشگاه';
    if (assistant?.enabled) this.botName = assistant.name;
    const logo = this.panel.querySelector('.mira-header-logo')!;
    logo.innerHTML = icons.mark;
    if (assistant?.enabled && assistant.avatarUrl && safeHttpUrl(assistant.avatarUrl)) {
      const avatar = document.createElement('img');
      avatar.src = safeHttpUrl(assistant.avatarUrl)!;
      avatar.alt = '';
      avatar.width = 46;
      avatar.height = 46;
      avatar.referrerPolicy = 'no-referrer';
      logo.replaceChildren(avatar);
    }
    this.panel.querySelector('.mira-header-title')!.textContent = assistant?.enabled
      ? this.botName
      : `پشتیبانی ${store}`;
    this.panel.querySelector('.mira-header-sub')!.textContent = assistant?.enabled
      ? `دستیار ${store} · همراه با پشتیبان انسانی`
      : `${store} · پاسخ‌گوی شما`;
    this.bubble.querySelector('.mira-launcher-label')!.textContent = assistant?.enabled
      ? 'دستیار خرید'
      : 'گفتگو با پشتیبانی';
    (this.panel.querySelector('.mira-shopping') as HTMLButtonElement).hidden = !assistant?.enabled;
    if (this.messageCount) return;
    this.messagesEl.querySelector('.mira-welcome')?.remove();
    const welcome = document.createElement('div');
    welcome.className = 'mira-welcome';
    welcome.innerHTML = `<div class="mira-welcome-eyebrow">${icons.spark}<span>یک گفتگو، یک انتخاب بهتر</span></div><h1>سلام، خوش آمدید<br/><span>از کجا شروع کنیم؟</span></h1>`;
    const text = document.createElement('p');
    text.textContent = assistant?.enabled
      ? assistant.greeting ||
        'از پیدا کردن محصول مناسب تا پاسخ به سوال‌ها؛ قدم‌به‌قدم کنارتان هستم.'
      : 'سوالتان را بنویسید تا همکاران ما راهنمایی‌تان کنند.';
    welcome.appendChild(text);
    const intents = document.createElement('div');
    intents.className = 'mira-intents';
    const choices = assistant?.enabled
      ? [
          [
            'box',
            'محصول مناسب من',
            'با توجه به نیاز و بودجه شما',
            'برای انتخاب محصول مناسب با نیاز و بودجه‌ام راهنمایی‌ام کن.',
          ],
          [
            'compare',
            'مقایسه محصولات',
            'تفاوت‌ها را ببینید، راحت‌تر انتخاب کنید',
            'می‌خواهم چند محصول را مقایسه کنم. برای شروع راهنمایی‌ام کن.',
          ],
          ['truck', 'خرید و ارسال', 'پاسخ سوال‌های پیش از خرید', 'شرایط و زمان ارسال سفارش چیست؟'],
        ]
      : [
          ['headset', 'گفتگو با پشتیبان', 'سوالتان را با همکاران ما مطرح کنید', HUMAN_PROMPT],
          ['truck', 'شرایط ارسال', 'راهنمای خرید و دریافت سفارش', 'شرایط و زمان ارسال سفارش چیست؟'],
        ];
    for (const [icon, title, hint, prompt] of choices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mira-intent';
      button.innerHTML = `<span class="mira-intent-icon">${icons[icon as keyof typeof icons]}</span><span class="mira-intent-copy"><strong></strong><small></small></span>${icons.arrow}`;
      button.querySelector('strong')!.textContent = title;
      button.querySelector('small')!.textContent = hint;
      button.onclick = () => this.sendPrompt(prompt);
      intents.appendChild(button);
    }
    welcome.appendChild(intents);
    if (assistant?.enabled && assistant.quickReplies.length) {
      const quickTitle = document.createElement('div');
      quickTitle.className = 'mira-quick-title';
      quickTitle.textContent = 'یا با یک سوال شروع کنید';
      const quick = document.createElement('div');
      quick.className = 'mira-quick';
      for (const prompt of assistant.quickReplies) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = prompt;
        button.onclick = () => this.sendPrompt(prompt);
        quick.appendChild(button);
      }
      welcome.append(quickTitle, quick);
    }
    this.messagesEl.appendChild(welcome);
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
      !this.connected || this.sending || !this.inputEl.value.trim();
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
    const spinner = document.createElement('span');
    spinner.className = 'mira-thinking';
    spinner.textContent = '✦';
    spinner.setAttribute('aria-hidden', 'true');
    el.append(spinner, document.createTextNode(AI_STATUS_LABELS[payload.stage]));
    const dots = document.createElement('span');
    dots.className = 'mira-dots';
    dots.setAttribute('aria-hidden', 'true');
    dots.innerHTML = '<i></i><i></i><i></i>';
    el.appendChild(dots);
    this.aiTimeout = setTimeout(() => this.clearAiStatus(), 60_000);
  }

  clearAiStatus(): void {
    if (this.aiTimeout) clearTimeout(this.aiTimeout);
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
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'mira-trigger-open';
    open.textContent = text;
    open.onclick = () => {
      this.openPanel();
      onOpen();
    };
    const close = document.createElement('button');
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
    const card = document.createElement('div');
    card.className = 'mira-csat';
    card.innerHTML =
      '<div>این گفتگو به پایان رسید. از پاسخ‌گویی چقدر راضی بودید؟</div><div class="mira-csat-stars" role="group" aria-label="امتیاز گفتگو"></div><button type="button" class="mira-csat-submit" disabled>ارسال امتیاز</button>';
    const starsEl = card.querySelector('.mira-csat-stars')!;
    const submitButton = card.querySelector('.mira-csat-submit') as HTMLButtonElement;
    let selectedScore = 0;
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('button');
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
