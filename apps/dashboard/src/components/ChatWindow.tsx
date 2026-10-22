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
import { apiClient, ConversationDto } from '../api';
import { ConversationMeta } from './ConversationMeta';
import { CannedResponsesPicker } from './CannedResponsesPicker';
import { InternalNotesPanel } from './InternalNotesPanel';

const SUGGESTION_TIMEOUT_MS = 20_000;

interface ChatWindowProps {
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
  conversation,
  socket,
  onConversationUpdated,
  onMessageSeen,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<MessagePayload[]>([]);
  const [draft, setDraft] = useState('');
  const [isVisitorTyping, setIsVisitorTyping] = useState(false);
  const [suggestingReply, setSuggestingReply] = useState(false);
  const [aiStage, setAiStage] = useState<AiStatusPayload['stage']>('idle');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    apiClient.getMessages(conversation.id).then((history) => {
      if (!cancelled) setMessages(history);
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
    }

    function onMessage(message: MessagePayload): void {
      if (message.conversationId !== conversation.id) return;
      setMessages((prev) =>
        prev.some((item) => item.id === message.id) ? prev : [...prev, message],
      );
      if (message.senderType !== MessageSenderType.VISITOR) setAiStage('idle');
      // این پنجره همین الان بازه؛ اگه پیام از طرف بازدیدکننده/ربات باشه بلافاصله به‌عنوان خوانده‌شده علامت بزن
      if (message.senderType !== MessageSenderType.AGENT) {
        apiClient.markConversationRead(conversation.id).catch(() => {});
        onMessageSeen(conversation.id);
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
    socket.on(SocketEvent.Typing, onTyping);
    socket.on(SocketEvent.AiReplySuggested, onAiSuggestion);
    return () => {
      clearTimeout(aiTimeout);
      socket.off(SocketEvent.AiStatus, onAiStatus);
      socket.off('disconnect', onDisconnect);
      socket.off(SocketEvent.MessageNew, onMessage);
      socket.off(SocketEvent.Typing, onTyping);
      socket.off(SocketEvent.AiReplySuggested, onAiSuggestion);
    };
  }, [socket, conversation.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend(): void {
    const content = draft.trim();
    if (!content || !socket) return;
    // پیام خودمون رو اینجا رندر نمی‌کنیم؛ سرور همون پیام رو به اتاق مکالمه پخش می‌کنه
    socket.emit(SocketEvent.MessageSend, { conversationId: conversation.id, content });
    setDraft('');
    socket.emit(SocketEvent.TypingStop, { conversationId: conversation.id });
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
    <div className="flex flex-1 flex-col">
      <ConversationMeta conversation={conversation} onUpdated={onConversationUpdated} />
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`mb-2 max-w-[70%] animate-slide-up rounded-xl px-3 py-2 text-sm ${
              message.senderType === MessageSenderType.AGENT
                ? 'mr-auto rounded-br-md bg-primary-600 text-white shadow-sm'
                : message.senderType === MessageSenderType.BOT
                  ? 'ml-auto rounded-bl-md border border-teal-200 bg-teal-50 text-teal-900'
                  : 'ml-auto rounded-bl-md bg-gray-200 text-gray-800'
            }`}
          >
            <div className="mb-1 text-[10px] opacity-70">
              {message.senderType === MessageSenderType.BOT ? '✦ ' : ''}
              {SENDER_LABELS[message.senderType]}
            </div>
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
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
      <div className="flex items-stretch border-t border-gray-200">
        <CannedResponsesPicker onPick={(content) => setDraft(content)} />
        <button
          onClick={handleSuggestReply}
          disabled={suggestingReply}
          title="پیشنهاد پاسخ با هوش مصنوعی"
          className="px-3 text-xs text-teal-600 hover:bg-teal-50 disabled:opacity-60"
        >
          {suggestingReply ? '...' : '✨ پیشنهاد پاسخ'}
        </button>
        <input
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="پاسخ خود را بنویسید..."
          className="flex-1 bg-white p-3 text-sm outline-none"
        />
        <button
          onClick={handleSend}
          className="bg-primary-600 px-5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          ارسال
        </button>
      </div>
    </div>
  );
}
