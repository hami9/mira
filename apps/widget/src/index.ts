import { ConversationStatus, SocketEvent } from '@mira/shared-types';
import type { Socket } from 'socket.io-client';
import { WidgetApi } from './api';
import { connectWidgetSocket } from './socket';
import { WidgetUi } from './ui';
import { getStoredVisitorRef, storeVisitorRef } from './storage';

interface WidgetConfig {
  widgetKey: string;
  apiUrl: string;
  color?: string;
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
  const position = scriptEl?.dataset.position === 'bottom-left' ? 'bottom-left' : 'bottom-right';
  return {
    widgetKey,
    apiUrl,
    color: scriptEl?.dataset.color || undefined,
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
        try {
          if (!conversationId) {
            const started = await api.startConversation(visitorToken);
            conversationId = started.conversationId;
            socket?.emit(SocketEvent.ConversationJoin, { conversationId });
          }
          // پیام خودمون رو اینجا رندر نمی‌کنیم؛ سرور همون پیام رو به همین اتاق پخش می‌کنه (تک منبع حقیقت)
          socket?.emit(SocketEvent.MessageSend, { conversationId, content });
        } catch {
          ui.showError('ارسال پیام ناموفق بود، دوباره تلاش کنید');
        }
      },
      onTypingChange: (isTyping) => {
        if (!conversationId || !socket) return;
        socket.emit(isTyping ? SocketEvent.TypingStart : SocketEvent.TypingStop, { conversationId });
      },
    },
    { color: config.color, position: config.position },
  );

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
    storeVisitorRef(session.visitorRef);
    conversationId = session.activeConversationId ?? session.pendingRatingConversationId;

    // گزارش صفحه‌ی فعلی برای پنل اطلاعات بازدیدکننده در داشبورد (خطای این درخواست بی‌اهمیته)
    api
      .reportPageView(visitorToken, { url: window.location.href, title: document.title })
      .catch(() => undefined);

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
      onMessage: (message) => {
        if (message.conversationId !== conversationId) return;
        ui.hideCsatPrompt(); // پیام تازه یعنی گفتگو ادامه داره؛ پرامپت امتیازدهی قبلی دیگه معتبر نیست
        ui.appendMessage(message.content, message.senderType);
      },
      onTyping: (payload) => {
        if (payload.conversationId !== conversationId) return;
        ui.setTypingIndicator(payload.isTyping);
      },
      onConversationUpdated: (payload) => {
        if (payload.conversationId !== conversationId) return;
        if (payload.status === ConversationStatus.RESOLVED) {
          showCsatPromptFor(payload.conversationId);
        } else if (payload.status === ConversationStatus.OPEN) {
          ui.hideCsatPrompt();
        }
      },
      onError: (message) => ui.showError(message),
    });

    socket.on('connect', async () => {
      if (conversationId) {
        socket?.emit(SocketEvent.ConversationJoin, { conversationId });
        try {
          const history = await api.getMessages(visitorToken, conversationId);
          for (const message of history) {
            ui.appendMessage(message.content, message.senderType);
          }
          if (session.pendingRatingConversationId === conversationId) {
            showCsatPromptFor(conversationId);
          }
        } catch {
          ui.showError('بارگذاری تاریخچه مکالمه ناموفق بود');
        }
      }
    });
  } catch {
    ui.showError('اتصال به سرور پشتیبانی برقرار نشد');
  }
}

main();
