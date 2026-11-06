import { ConversationStatus, SocketEvent, type MessageAck } from '@mira/shared-types';
import type { Socket } from 'socket.io-client';
import { WidgetApi, WidgetApiError } from './api';
import { connectWidgetSocket } from './socket';
import { WidgetUi, WidgetSendError } from './ui';
import { getStoredVisitorRef, newClientMessageId, storeVisitorRef } from './storage';

interface WidgetConfig {
  autoOpen: boolean;
  fullscreen: boolean;
  widgetKey: string;
  apiUrl: string;
  fontUrl: string;
  color?: string;
  accentColor?: string;
  position?: 'bottom-right' | 'bottom-left';
  // این دو از افزونه‌ی وردپرس می‌آد: نام/ایمیل کاربر واردشده به وردپرس، برای پیش‌فرم خودکار (فاز ۳)
  visitorName?: string;
  visitorEmail?: string;
  // override پیام محرک برای سبد خرید رهاشده در صفحات ووکامرس (به‌جای پیام محرک عمومی سایت)
  triggerText?: string;
  triggerDelaySeconds?: number;
}

function readConfig(): WidgetConfig | null {
  const scriptEl = document.currentScript as HTMLScriptElement | null;
  const widgetKey = scriptEl?.dataset.widgetKey ?? '';
  if (!widgetKey) {
    console.error('[میرا] ویژگی data-widget-key روی تگ اسکریپت تنظیم نشده است');
    return null;
  }
  const apiUrl = scriptEl?.dataset.apiUrl ?? new URL(scriptEl!.src).origin;
  const triggerDelayRaw = scriptEl?.dataset.triggerDelay;
  const position = scriptEl?.dataset.position
    ? scriptEl.dataset.position === 'bottom-left'
      ? 'bottom-left'
      : 'bottom-right'
    : undefined;
  return {
    autoOpen: scriptEl?.dataset.autoOpen === 'true',
    fullscreen: scriptEl?.dataset.fullscreen === 'true',
    widgetKey,
    apiUrl,
    fontUrl: new URL('mira-font.woff2', scriptEl!.src).href,
    color: scriptEl?.dataset.color || undefined,
    accentColor: scriptEl?.dataset.accentColor || undefined,
    position,
    visitorName: scriptEl?.dataset.visitorName || undefined,
    visitorEmail: scriptEl?.dataset.visitorEmail || undefined,
    triggerText: scriptEl?.dataset.triggerText || undefined,
    triggerDelaySeconds: triggerDelayRaw ? Number(triggerDelayRaw) : undefined,
  };
}

async function main(): Promise<void> {
  const config = readConfig();
  if (!config) return;

  const api = new WidgetApi(config.apiUrl);
  let visitorToken = '';
  let conversationId: string | null = null;
  let socket: Socket | null = null;
  let triggerTimeout: ReturnType<typeof setTimeout> | null = null;
  let pendingSend: { content: string; id: string } | null = null;

  function cancelTrigger(): void {
    if (triggerTimeout) {
      clearTimeout(triggerTimeout);
      triggerTimeout = null;
    }
  }

  const ui = new WidgetUi(
    {
      onSend: async (content) => {
        cancelTrigger();
        if (!socket?.connected || !visitorToken) throw new Error('اتصال برقرار نیست');
        if (!conversationId) {
          const started = await api.startConversation(visitorToken).catch((error: unknown) => {
            if (error instanceof WidgetApiError) throw new WidgetSendError(error.message);
            throw error;
          });
          conversationId = started.conversationId;
          socket?.emit(SocketEvent.ConversationJoin, { conversationId });
        }
        // پیام خودمون رو اینجا رندر نمی‌کنیم؛ سرور همون پیام رو به همین اتاق پخش می‌کنه (تک منبع حقیقت)
        // clientMessageId برای idempotency: اگه سوکت وسط ارسال قطع/وصل شه و پیام دوباره
        // فرستاده شه، سرور پیام تکراری نمی‌سازه (فاز ۷)
        if (pendingSend?.content !== content) pendingSend = { content, id: newClientMessageId() };
        const targetId = conversationId;
        const ack = (await socket.timeout(12_000).emitWithAck(SocketEvent.MessageSend, {
          conversationId: targetId,
          content,
          clientMessageId: pendingSend.id,
        })) as MessageAck;
        if (!ack || !('id' in ack)) {
          if (ack && 'error' in ack) {
            if (ack.error.code === 'CONVERSATION_DELETED' && conversationId === targetId)
              forgetConversation();
            throw new WidgetSendError(ack.error.message);
          }
          throw new WidgetSendError('ارسال تأیید نشد. پیام شما حفظ شده؛ دوباره تلاش کنید.');
        }
        pendingSend = null;
      },
      onTypingChange: (isTyping) => {
        if (!conversationId || !socket) return;
        socket.emit(isTyping ? SocketEvent.TypingStart : SocketEvent.TypingStop, {
          conversationId,
        });
      },
    },
    {
      color: config.color,
      accentColor: config.accentColor,
      position: config.position,
      fullscreen: config.fullscreen,
      fontUrl: config.fontUrl,
    },
  );
  ui.setConnected(false);
  if (config.autoOpen || config.fullscreen) ui.openPanel();

  function forgetConversation(): void {
    conversationId = null;
    pendingSend = null;
    ui.resetConversation('این گفتگو حذف شده است. می‌توانید گفتگوی تازه‌ای شروع کنید.');
  }

  async function loadHistory(targetId: string, pendingRatingId?: string | null): Promise<void> {
    try {
      const history = await api.getMessages(visitorToken, targetId);
      if (conversationId !== targetId) return;
      for (const message of history) ui.appendMessage(message.content, message.senderType, message);
      if (pendingRatingId === targetId) showCsatPromptFor(targetId);
    } catch (error) {
      if (conversationId !== targetId) return;
      if (error instanceof WidgetApiError && error.status === 404) forgetConversation();
      else ui.showError('بارگذاری تاریخچه مکالمه ناموفق بود');
    }
  }

  function showCsatPromptFor(targetConversationId: string): void {
    ui.showCsatPrompt((score, comment) => {
      api
        .submitCsat(visitorToken, targetConversationId, { score, comment: comment || undefined })
        .catch(() => ui.showError('ثبت امتیاز ناموفق بود'));
    });
  }

  try {
    // اگه کاربر در وردپرس وارد شده باشه، افزونه نام/ایمیلش رو از قبل پاس می‌ده — دیگه لازم نیست بپرسیم
    const session = await api.createSession({
      widgetKey: config.widgetKey,
      visitorRef: getStoredVisitorRef() ?? undefined,
      name: config.visitorName,
      email: config.visitorEmail,
    });
    visitorToken = session.visitorToken;
    ui.setVisitorModeration(session.moderation);
    ui.configureAppearance({
      appearance: session.appearance,
      color: config.color || session.appearance?.color,
      accentColor: config.accentColor || session.appearance?.accentColor,
      position: config.position || session.appearance?.position,
    });
    ui.configureAssistant(session.assistant);
    storeVisitorRef(session.visitorRef);
    conversationId = session.activeConversationId ?? session.pendingRatingConversationId;

    // تغییر صفحه در سایت‌های SPA هم ثبت می‌شود؛ heartbeat فقط در تب نمایان است.
    let lastPage = '';
    let lastReportAt = 0;
    let reporting = false;
    const reportPage = async () => {
      if (document.visibilityState !== 'visible' || reporting) return;
      const page = `${window.location.href}\n${document.title}`;
      if (page === lastPage && Date.now() - lastReportAt < 45_000) return;
      reporting = true;
      try {
        await api.reportPageView(visitorToken, {
          url: window.location.href.slice(0, 1024),
          title: document.title.slice(0, 255),
        });
        lastPage = page;
        lastReportAt = Date.now();
      } catch {
        /* گزارش بازدید مسیر گفتگو را متوقف نمی‌کند. */
      } finally {
        reporting = false;
      }
    };
    void reportPage();
    const pageTimer = setInterval(() => {
      void reportPage();
    }, 5_000);
    document.addEventListener('visibilitychange', reportPage);
    window.addEventListener('pagehide', (event) => {
      if (!event.persisted) clearInterval(pageTimer);
    });

    // اولویت با پیام محرک اختصاصی صفحه (مثلاً سبد خرید رهاشده در ووکامرس)؛ اگه نبود، پیام محرک عمومی سایت
    const trigger = config.triggerText
      ? { text: config.triggerText, delaySeconds: config.triggerDelaySeconds ?? 60 }
      : session.triggerMessage;

    if (trigger) {
      triggerTimeout = setTimeout(() => {
        if (conversationId) return; // اگه بازدیدکننده قبلاً گفتگو رو شروع کرده، پیام محرک بی‌معنیه
        ui.showTriggerBubble(trigger.text, () => cancelTrigger());
      }, trigger.delaySeconds * 1000);
    }

    socket = connectWidgetSocket(config.apiUrl, visitorToken, {
      onConversationStarted: async (id) => {
        if (conversationId === id) return;
        conversationId = id;
        socket?.emit(SocketEvent.ConversationJoin, { conversationId: id });
        await loadHistory(id);
      },
      onMessage: (message) => {
        if (message.conversationId !== conversationId) return;
        if (message.senderType === 'agent') ui.openPanel();
        ui.hideCsatPrompt(); // پیام تازه یعنی گفتگو ادامه داره؛ پرامپت امتیازدهی قبلی دیگه معتبر نیست
        ui.appendMessage(message.content, message.senderType, message);
      },
      onAiStatus: (payload) => {
        if (payload.conversationId === conversationId) ui.setAiStatus(payload);
      },
      onTyping: (payload) => {
        if (payload.conversationId !== conversationId) return;
        ui.setTypingIndicator(payload.isTyping);
      },
      onConversationUpdated: (payload) => {
        if (payload.conversationId !== conversationId) return;
        if (payload.deleted) {
          forgetConversation();
          return;
        }
        if (payload.status === ConversationStatus.RESOLVED) {
          ui.clearAiStatus();
          showCsatPromptFor(payload.conversationId);
        } else if (payload.status === ConversationStatus.OPEN) {
          ui.hideCsatPrompt();
        }
      },
      onModeration: (payload) => ui.setVisitorModeration(payload),
      onError: (message) => ui.showError(message),
    });

    socket.on('connect', async () => {
      ui.setConnected(true);
      if (conversationId) {
        socket?.emit(SocketEvent.ConversationJoin, { conversationId });
        await loadHistory(conversationId, session.pendingRatingConversationId);
      }
    });
    socket.on('disconnect', () => ui.setConnected(false));
    socket.on('connect_error', () => ui.setConnected(false));
  } catch {
    ui.showError('اتصال به سرور پشتیبانی برقرار نشد');
  }
}

main();
