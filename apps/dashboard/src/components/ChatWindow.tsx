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
import { VisitorModerationControl } from './VisitorControls';
import { conversationName, ModerationBadges, VisitorFlags } from './VisitorLabels';
import { ChatTools } from './ChatTools';
import { ToolMessage } from './ToolMessage';

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
  canModerate?: boolean;
  canDelete?: boolean;
  canResolve?: boolean;
  onTrashed?: (conversation: ConversationDto) => void;
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
  canModerate = false,
  canDelete = false,
  canResolve = false,
  onTrashed,
}: ChatWindowProps) {
  const apiClient = useApiClient();
  const [messages, setMessages] = useState<MessagePayload[]>([]);
  const [draft, setDraft] = useState('');
  const [connected, setConnected] = useState(socket?.connected ?? false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyRetry, setHistoryRetry] = useState(0);
  const [suggestion, setSuggestion] = useState('');
  const [suggestionError, setSuggestionError] = useState('');
  const pendingSend = useRef<{ content: string; id: string } | null>(null);
  const [isVisitorTyping, setIsVisitorTyping] = useState(false);
  const [suggestingReply, setSuggestingReply] = useState(false);
  const [aiStage, setAiStage] = useState<AiStatusPayload['stage']>('idle');
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashBusy, setTrashBusy] = useState(false);
  const [trashError, setTrashError] = useState('');
  const trashDialog = useRef<HTMLDialogElement>(null);
  const messageLog = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const composer = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (trashOpen && trashDialog.current && !trashDialog.current.open)
      trashDialog.current.showModal();
    else if (!trashOpen) trashDialog.current?.close();
  }, [trashOpen]);
  async function trash() {
    setTrashBusy(true);
    setTrashError('');
    try {
      const updated = await apiClient.trashConversation(conversation.id);
      setTrashOpen(false);
      onTrashed?.(updated);
    } catch {
      setTrashError('انتقال به زباله‌دان انجام نشد؛ دسترسی و اتصال را بررسی کنید.');
    } finally {
      setTrashBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setHistoryError(false);
    setHistoryLoading(true);
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
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    socket?.emit(SocketEvent.ConversationJoin, { conversationId: conversation.id });
    return () => {
      cancelled = true;
    };
  }, [apiClient, conversation.id, socket, historyRetry]);

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
      setSuggestionError('');
      setSuggestion(payload.suggestion);
    }

    socket.on(SocketEvent.MessageNew, onMessage);
    const onMessageUpdated = (message: MessagePayload) => {
      if (message.conversationId === conversation.id)
        setMessages((current) => current.map((item) => (item.id === message.id ? message : item)));
    };
    socket.on(SocketEvent.MessageUpdated, onMessageUpdated);
    socket.on(SocketEvent.AiStatus, onAiStatus);
    socket.on('disconnect', onDisconnect);
    socket.on('connect', onConnect);
    socket.on(SocketEvent.Typing, onTyping);
    socket.on(SocketEvent.AiReplySuggested, onAiSuggestion);
    return () => {
      clearTimeout(aiTimeout);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (suggestionTimeoutRef.current) clearTimeout(suggestionTimeoutRef.current);
      socket.off(SocketEvent.AiStatus, onAiStatus);
      socket.off('disconnect', onDisconnect);
      socket.off('connect', onConnect);
      socket.off(SocketEvent.MessageNew, onMessage);
      socket.off(SocketEvent.MessageUpdated, onMessageUpdated);
      socket.off(SocketEvent.Typing, onTyping);
      socket.off(SocketEvent.AiReplySuggested, onAiSuggestion);
    };
  }, [socket, conversation.id]);

  useEffect(() => {
    const log = messageLog.current;
    if (log && followLatest.current) log.scrollTop = log.scrollHeight;
  }, [messages, aiStage]);

  function insertReply(content: string): void {
    const input = composer.current;
    if (!input) return;
    const end = input.selectionEnd;
    // متن ابزار در محل نشانگر اضافه می‌شود و پیش‌نویس موجود باقی می‌ماند.
    const prefix = input.value.slice(0, end);
    const after = input.value.slice(end);
    const inserted = (prefix && !/\s$/.test(prefix) ? '\n' : '') + content;
    handleDraftChange(prefix + inserted + (after && !/^\s/.test(after) ? '\n' : '') + after);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(prefix.length + inserted.length, prefix.length + inserted.length);
    });
  }

  async function handleSend(): Promise<void> {
    const content = draft.trim();
    if (!content || !socket?.connected || sending) return;
    // پیام خودمون رو اینجا رندر نمی‌کنیم؛ سرور همون پیام رو به اتاق مکالمه پخش می‌کنه
    if (pendingSend.current?.content !== content)
      pendingSend.current = { content, id: crypto.randomUUID() };
    setSending(true);
    followLatest.current = true;
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
    setSuggestion('');
    setSuggestionError('');
    suggestionTimeoutRef.current = setTimeout(() => {
      setSuggestingReply(false);
      setSuggestionError('پیشنهادی دریافت نشد. دوباره تلاش کنید.');
    }, SUGGESTION_TIMEOUT_MS);
    try {
      await apiClient.suggestReply(conversation.id);
    } catch {
      clearTimeout(suggestionTimeoutRef.current ?? undefined);
      setSuggestingReply(false);
      setSuggestionError('دریافت پیشنهاد انجام نشد. دوباره تلاش کنید.');
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
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 lg:hidden"
            aria-label="بازگشت به فهرست گفتگوها"
          >
            →
          </button>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-xs font-bold text-primary-600">
            {conversationName(conversation).slice(0, 2)}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-gray-800">
              {conversationName(conversation)}
            </h2>
            <p className="mt-0.5 truncate text-[10px] text-gray-400">{siteName}</p>
            <VisitorFlags flags={conversation.visitorFlags} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!connected && (
            <span
              role="status"
              className="rounded-full bg-amber-50 px-2 py-1 text-[11px] text-amber-800"
            >
              در حال اتصال…
            </span>
          )}
          <button
            type="button"
            onClick={onToggleDetails}
            aria-expanded={showDetails}
            className="control-button"
          >
            اطلاعات و مسیر بازدید
          </button>
        </div>
      </header>
      {(canModerate || canDelete) && (
        <details className="border-b border-slate-100 px-3 py-1">
          <summary className="control-button cursor-pointer">
            <span aria-hidden="true">⋯</span>
            مدیریت گفتگو
            <ModerationBadges moderation={conversation.visitorModeration} />
          </summary>
          <div className="my-2 flex flex-wrap items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <VisitorModerationControl
              visitorId={conversation.visitorId}
              name={conversationName(conversation)}
              moderation={conversation.visitorModeration}
              allowed={canModerate}
            />
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  setTrashError('');
                  setTrashOpen(true);
                }}
                className="control-button control-button-danger"
              >
                انتقال به زباله‌دان
              </button>
            )}
          </div>
        </details>
      )}
      {!canModerate && !canDelete && (
        <ModerationBadges moderation={conversation.visitorModeration} />
      )}
      <dialog
        ref={trashDialog}
        onCancel={(event) => {
          if (trashBusy) event.preventDefault();
          else setTrashOpen(false);
        }}
        aria-labelledby={`trash-${conversation.id}`}
        className="w-[min(440px,calc(100vw-32px))] rounded-2xl border border-slate-200 bg-white p-5 text-right text-slate-800 shadow-xl backdrop:bg-slate-900/40"
      >
        <h3 id={`trash-${conversation.id}`} className="font-bold">
          انتقال گفتگو به زباله‌دان
        </h3>
        <p className="mt-3 text-sm font-bold">{conversationName(conversation)}</p>
        <p className="mt-2 text-xs leading-6 text-slate-500">
          این گفتگو از صندوق فعال کنار می‌رود و ارسال پیام در آن متوقف می‌شود. پیام‌ها حذف دائمی
          نمی‌شوند و از زباله‌دان قابل بازگردانی است.
        </p>
        {trashError && (
          <p role="alert" className="mt-3 text-xs text-red-700">
            {trashError}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={trashBusy}
            onClick={() => setTrashOpen(false)}
            className="min-h-11 rounded-xl border px-3 text-xs"
          >
            انصراف
          </button>
          <button
            type="button"
            disabled={trashBusy}
            onClick={() => void trash()}
            className="min-h-11 rounded-xl bg-red-700 px-3 text-xs text-white disabled:opacity-50"
          >
            {trashBusy ? 'در حال انتقال…' : 'تأیید انتقال به زباله‌دان'}
          </button>
        </div>
      </dialog>
      <ConversationMeta
        conversation={conversation}
        onUpdated={onConversationUpdated}
        canResolve={canResolve}
      />
      <div
        ref={messageLog}
        onScroll={(event) => {
          const log = event.currentTarget;
          followLatest.current = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
        }}
        role="log"
        aria-label="پیام‌های گفتگو"
        aria-busy={historyLoading}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-4 md:p-6"
      >
        {historyError && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800"
          >
            دریافت تاریخچه ناموفق بود.
            <button
              type="button"
              className="control-button"
              onClick={() => setHistoryRetry((current) => current + 1)}
            >
              دریافت دوباره
            </button>
          </div>
        )}
        {historyLoading && (
          <p role="status" className="text-xs text-slate-600">
            در حال دریافت پیام‌ها…
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
            <ToolMessage message={message} messages={messages} />
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
        {aiStage !== 'idle' && (
          <div role="status" className="flex items-center gap-2 p-3 text-xs text-teal-700">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-100 border-t-teal-600 motion-reduce:animate-none" />
            {AI_STATUS_LABELS[aiStage]}
          </div>
        )}
      </div>
      <div className="h-5 px-4 text-xs text-gray-500">
        {isVisitorTyping ? (
          <span className="animate-pulse-soft">بازدیدکننده در حال تایپ است…</span>
        ) : (
          ''
        )}
      </div>
      <InternalNotesPanel conversationId={conversation.id} />
      <div className="border-t border-gray-100 bg-white p-3">
        <div
          role="group"
          aria-label="ابزارهای پاسخ"
          className="mb-2 flex flex-wrap items-center gap-2"
        >
          <ChatTools
            draft={draft}
            conversationId={conversation.id}
            onSent={(message) =>
              setMessages((current) =>
                current.some((item) => item.id === message.id) ? current : [...current, message],
              )
            }
          />
          <CannedResponsesPicker onPick={insertReply} />
          <button
            type="button"
            onClick={handleSuggestReply}
            disabled={suggestingReply}
            title="پیشنهاد پاسخ با هوش مصنوعی"
            className="control-button"
          >
            {suggestingReply ? 'در حال آماده‌سازی…' : 'پیشنهاد پاسخ'}
          </button>
        </div>
        {suggestionError && (
          <p role="alert" className="mb-2 text-xs text-red-700">
            {suggestionError}
          </p>
        )}
        {suggestion && (
          <div className="mb-2 rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs leading-6 text-teal-800">
            <p role="status" className="font-bold">
              پیشنهاد پاسخ آماده است
            </p>
            <p className="my-2 max-h-24 overflow-y-auto whitespace-pre-wrap break-words">
              {suggestion}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="control-button"
                onClick={() => {
                  insertReply(suggestion);
                  setSuggestion('');
                }}
              >
                افزودن به پیش‌نویس
              </button>
              <button type="button" className="control-button" onClick={() => setSuggestion('')}>
                بستن پیشنهاد
              </button>
            </div>
          </div>
        )}
        <div className="flex items-end gap-2 rounded-xl border border-gray-200 bg-gray-50/60 p-2 focus-within:border-primary-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary-50">
          <textarea
            ref={composer}
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="پاسخ خود را بنویسید…"
            aria-label="پاسخ به بازدیدکننده"
            rows={2}
            className="min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-6 outline-none"
          />
          <button
            type="button"
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
