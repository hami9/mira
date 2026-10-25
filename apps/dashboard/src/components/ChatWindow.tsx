import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import {
  AiSuggestionPayload,
  MessagePayload,
  MessageSenderType,
  SocketEvent,
  AiStatusPayload,
  AI_STATUS_LABELS,
  safeHttpUrl,
  formatProductPrice,
} from '@mira/shared-types';
import { ConversationDto } from '../api';
import { useApiClient } from '../api-context';
import { ConversationMeta } from './ConversationMeta';
import { CannedResponsesPicker } from './CannedResponsesPicker';
import { InternalNotesPanel } from './InternalNotesPanel';

const SUGGESTION_TIMEOUT_MS = 20_000;

interface ChatWindowProps {
  siteName: string;
  onBack: () => void;
  showDetails: boolean;
  onToggleDetails: () => void;
  conversation: ConversationDto;
  socket: Socket | null;
  onConversationUpdated: (conversation: ConversationDto) => void;
  onMessageSeen: (conversationId: string) => void;
}

const SENDER_LABELS: Record<string, string> = {
  visitor: 'بازدیدکننده',
  agent: 'اپراتور',
  bot: 'ربات',
};

export function ChatWindow({
  siteName,
  onBack,
  showDetails,
  onToggleDetails,
  conversation,
  socket,
  onConversationUpdated,
  onMessageSeen,
}: ChatWindowProps) {
  const apiClient = useApiClient();
  const [messages, setMessages] = useState<MessagePayload[]>([]);
  const [draft, setDraft] = useState('');
  const [connected, setConnected] = useState(socket?.connected ?? false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const pendingSend = useRef<{ content: string; id: string } | null>(null);
  const [isVisitorTyping, setIsVisitorTyping] = useState(false);
  const [suggestingReply, setSuggestingReply] = useState(false);
  const [aiStage, setAiStage] = useState<AiStatusPayload['stage']>('idle');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    setHistoryError(false);
    apiClient
      .getMessages(conversation.id)
      .then((history) => {
        if (!cancelled) {
          const ids = new Set(history.map((message) => message.id));
          setMessages((current) => [
            ...history,
            ...current.filter((message) => !ids.has(message.id)),
          ]);
        }
      })
      .catch(() => {
        if (!cancelled) setHistoryError(true);
      });
    socket?.emit(SocketEvent.ConversationJoin, { conversationId: conversation.id });
    return () => {
      cancelled = true;
    };
  }, [conversation.id, socket]);

  useEffect(() => {
    if (!socket) return;

    let aiTimeout: ReturnType<typeof setTimeout> | undefined;
    let aiMessageId: string | undefined;
    setAiStage('idle');
    function onAiStatus(payload: AiStatusPayload): void {
      if (payload.conversationId !== conversation.id) return;
      if (payload.stage === 'idle' && aiMessageId !== payload.messageId) return;
      aiMessageId = payload.messageId;
      setAiStage(payload.stage);
      clearTimeout(aiTimeout);
      aiTimeout = setTimeout(() => setAiStage('idle'), 60_000);
    }
    function onDisconnect(): void {
      setAiStage('idle');
      setConnected(false);
    }
    const onConnect = () => setConnected(true);
    setConnected(socket.connected);

    function onMessage(message: MessagePayload): void {
      if (message.conversationId !== conversation.id) return;
      setMessages((prev) =>
        prev.some((item) => item.id === message.id) ? prev : [...prev, message],
      );
      if (message.senderType !== MessageSenderType.VISITOR) setAiStage('idle');
      // این پنجره همین الان بازه؛ اگه پیام از طرف بازدیدکننده/ربات باشه بلافاصله به‌عنوان خوانده‌شده علامت بزن
      if (message.senderType !== MessageSenderType.AGENT) {
        apiClient
          .markConversationRead(conversation.id)
          .then(() => onMessageSeen(conversation.id))
          .catch(() => {});
      }
    }

    function onTyping(payload: { conversationId: string; senderType: string; isTyping: boolean }) {
      if (payload.conversationId !== conversation.id || payload.senderType !== 'visitor') return;
      setIsVisitorTyping(payload.isTyping);
    }

    function onAiSuggestion(payload: AiSuggestionPayload): void {
      if (payload.conversationId !== conversation.id) return;
      if (suggestionTimeoutRef.current) clearTimeout(suggestionTimeoutRef.current);
      setSuggestingReply(false);
      setDraft(payload.suggestion);
    }

    socket.on(SocketEvent.MessageNew, onMessage);
    socket.on(SocketEvent.AiStatus, onAiStatus);
    socket.on('disconnect', onDisconnect);
    socket.on('connect', onConnect);
    socket.on(SocketEvent.Typing, onTyping);
    socket.on(SocketEvent.AiReplySuggested, onAiSuggestion);
    return () => {
      clearTimeout(aiTimeout);
      socket.off(SocketEvent.AiStatus, onAiStatus);
      socket.off('disconnect', onDisconnect);
      socket.off('connect', onConnect);
      socket.off(SocketEvent.MessageNew, onMessage);
      socket.off(SocketEvent.Typing, onTyping);
      socket.off(SocketEvent.AiReplySuggested, onAiSuggestion);
    };
  }, [socket, conversation.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(): Promise<void> {
    const content = draft.trim();
    if (!content || !socket?.connected || sending) return;
    // پیام خودمون رو اینجا رندر نمی‌کنیم؛ سرور همون پیام رو به اتاق مکالمه پخش می‌کنه
    if (pendingSend.current?.content !== content)
      pendingSend.current = { content, id: crypto.randomUUID() };
    setSending(true);
    setSendError(false);
    try {
      const ack = await socket.timeout(12_000).emitWithAck(SocketEvent.MessageSend, {
        conversationId: conversation.id,
        content,
        clientMessageId: pendingSend.current.id,
      });
      if (!ack?.id) throw new Error('ارسال ناموفق بود');
      setDraft((current) => (current.trim() === content ? '' : current));
      pendingSend.current = null;
      socket.emit(SocketEvent.TypingStop, { conversationId: conversation.id });
    } catch {
      setSendError(true);
    } finally {
      setSending(false);
    }
  }

  async function handleSuggestReply(): Promise<void> {
    if (suggestingReply) return;
    setSuggestingReply(true);
    try {
      await apiClient.suggestReply(conversation.id);
      // اگه worker جواب ندیم (کلید AI تنظیم نشده، خطای مدل و ...)، اسپینر برای همیشه گیر نکنه
      suggestionTimeoutRef.current = setTimeout(
        () => setSuggestingReply(false),
        SUGGESTION_TIMEOUT_MS,
      );
    } catch {
      setSuggestingReply(false);
    }
  }

  function handleDraftChange(value: string): void {
    setDraft(value);
    if (!socket) return;
    socket.emit(SocketEvent.TypingStart, { conversationId: conversation.id });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit(SocketEvent.TypingStop, { conversationId: conversation.id });
    }, 2000);
  }

  return (
    <section aria-label="پنجرهٔ گفتگو" className="flex min-w-0 flex-1 flex-col bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-500 lg:hidden"
            aria-label="بازگشت به فهرست گفتگوها"
          >
            →
          </button>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-xs font-bold text-primary-600">
            {conversation.visitorId.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-gray-800">
              بازدیدکننده #{conversation.visitorId.slice(0, 8)}
            </h2>
            <p className="mt-0.5 truncate text-[10px] text-gray-400">{siteName}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            title={connected ? 'متصل' : 'در حال اتصال'}
            className={`h-2 w-2 rounded-full ${connected ? 'bg-teal-500' : 'animate-pulse bg-amber-400'}`}
          />
          <button
            onClick={onToggleDetails}
            aria-expanded={showDetails}
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
          >
            اطلاعات و مسیر بازدید
          </button>
        </div>
      </header>
      <ConversationMeta conversation={conversation} onUpdated={onConversationUpdated} />
      <div
        role="log"
        aria-label="پیام‌های گفتگو"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-4 md:p-6"
      >
        {historyError && (
          <p role="alert" className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
            دریافت تاریخچه ناموفق بود؛ گفتگو را دوباره باز کنید.
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`w-fit max-w-[90%] animate-slide-up rounded-2xl px-4 py-3 text-sm leading-7 sm:max-w-[80%] ${
              message.senderType === MessageSenderType.AGENT
                ? 'mr-auto rounded-br-md bg-primary-600 text-white shadow-sm'
                : message.senderType === MessageSenderType.BOT
                  ? 'ml-auto rounded-bl-md border border-teal-200 bg-teal-50 text-teal-900'
                  : 'ml-auto rounded-bl-md border border-gray-200/70 bg-white text-gray-800 shadow-sm'
            }`}
          >
            <div className="mb-1 text-[10px] opacity-70">
              {message.senderType === MessageSenderType.BOT ? '✦ ' : ''}
              {SENDER_LABELS[message.senderType]}
            </div>
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
            <time
              dateTime={message.createdAt}
              className="mt-1 block text-left text-[10px] leading-4 opacity-50"
            >
              {new Date(message.createdAt).toLocaleTimeString('fa-IR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
            {message.senderType === MessageSenderType.BOT && message.aiMetadata && (
              <>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {message.aiMetadata.products.map(
                    (product) =>
                      safeHttpUrl(product.url) && (
                        <a
                          key={product.id}
                          href={safeHttpUrl(product.url)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl border border-teal-100 bg-white p-3 text-xs text-slate-800"
                        >
                          {product.imageUrl && safeHttpUrl(product.imageUrl) && (
                            <img
                              src={safeHttpUrl(product.imageUrl)!}
                              alt={product.name}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              className="mb-2 h-20 w-full object-contain"
                            />
                          )}
                          <strong>{product.name}</strong>
                          <div className="mt-2 text-teal-700">{formatProductPrice(product)}</div>
                          <div className="mt-1 text-[10px] text-slate-500">
                            {product.inStock ? 'موجود · مشاهده محصول ↗' : 'ناموجود'}
                          </div>
                        </a>
                      ),
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {message.aiMetadata.sources.map((source) =>
                    source.url && safeHttpUrl(source.url) ? (
                      <a
                        key={source.id}
                        href={safeHttpUrl(source.url)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded border border-teal-100 bg-white px-2 py-1 text-[10px]"
                      >
                        ↗ {source.title}
                      </a>
                    ) : (
                      <span
                        key={source.id}
                        className="rounded border border-teal-100 bg-white px-2 py-1 text-[10px]"
                      >
                        {source.title}
                      </span>
                    ),
                  )}
                </div>
                {message.aiMetadata.handoff && (
                  <div className="mt-2 text-[10px] font-bold text-amber-700">
                    در انتظار پشتیبان · پاسخ خودکار متوقف است
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
        {aiStage !== 'idle' && (
          <div role="status" className="flex items-center gap-2 p-3 text-xs text-teal-700">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-100 border-t-teal-600 motion-reduce:animate-none" />
            {AI_STATUS_LABELS[aiStage]}
          </div>
        )}
      </div>
      <div className="h-5 px-4 text-xs text-gray-500">
        {isVisitorTyping ? (
          <span className="animate-pulse-soft">بازدیدکننده در حال تایپ است...</span>
        ) : (
          ''
        )}
      </div>
      <InternalNotesPanel conversationId={conversation.id} />
      <div className="border-t border-gray-100 bg-white p-3">
        <div className="mb-2 flex items-center gap-2">
          <CannedResponsesPicker onPick={(content) => setDraft(content)} />
          <button
            onClick={handleSuggestReply}
            disabled={suggestingReply}
            title="پیشنهاد پاسخ با هوش مصنوعی"
            className="rounded-lg px-3 py-2 text-xs text-teal-600 hover:bg-teal-50 disabled:opacity-60"
          >
            {suggestingReply ? '...' : '✨ پیشنهاد پاسخ'}
          </button>
        </div>
        <div className="flex items-end gap-2 rounded-xl border border-gray-200 bg-gray-50/60 p-2 focus-within:border-primary-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary-50">
          <textarea
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="پاسخ خود را بنویسید..."
            aria-label="پاسخ به بازدیدکننده"
            rows={2}
            className="min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-6 outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || !connected || sending}
            className="btn-primary rounded-lg px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? 'در حال ارسال…' : 'ارسال'}
          </button>
        </div>
        <div className="mt-2 text-[10px] text-gray-400">
          Enter برای ارسال · Shift + Enter برای خط جدید
        </div>
        {sendError && (
          <p role="alert" className="mt-2 text-xs text-red-600">
            ارسال پیام ناموفق بود؛ متن حفظ شده است، دوباره ارسال کنید.
          </p>
        )}
      </div>
    </section>
  );
}
