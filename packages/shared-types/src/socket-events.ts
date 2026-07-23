import { MessageSenderType, ConversationStatus } from './enums';

// نام رویدادهای Socket.io مشترک بین api/dashboard/widget — تغییرشون فقط باید اینجا انجام شه
export enum SocketEvent {
  // client -> server
  ConversationJoin = 'conversation:join',
  MessageSend = 'message:send',
  TypingStart = 'typing:start',
  TypingStop = 'typing:stop',
  // server -> client
  MessageNew = 'message:new',
  Typing = 'typing',
  ConversationCreated = 'conversation:created',
  ConversationUpdated = 'conversation:updated',
  ConnectionError = 'connection:error',
  // server -> client: پاسخ پیشنهادی Copilot برای اپراتور (نتیجه‌ی صف ai-suggest-reply) آماده شد
  AiReplySuggested = 'ai:reply-suggested',
}

export interface MessagePayload {
  id: string;
  conversationId: string;
  senderType: MessageSenderType;
  senderId: string | null;
  content: string;
  createdAt: string;
}

export interface TypingPayload {
  conversationId: string;
  senderType: MessageSenderType;
  isTyping: boolean;
}

export interface ConversationSummary {
  id: string;
  siteId: string;
  status: ConversationStatus;
  assignedAgentId: string | null;
  visitorId: string;
  lastMessageAt: string | null;
  createdAt: string;
}

// یک event مشترک برای هر تغییر مرتبط با مکالمه که نیاز به MessageNew نداره:
// - lastMessage: پیام تازه‌ی یک بازدیدکننده (برای تازه‌سازی لیست/بج در داشبورد، بدون تکرار در پنجره چت)
// - status: تغییر وضعیت مکالمه (مثلاً resolved — برای نمایش پرامپت CSAT در ویجت)
export interface ConversationUpdatedPayload {
  conversationId: string;
  status?: ConversationStatus;
  lastMessage?: MessagePayload;
  // پیام بازدیدکننده حاوی کلمات مرتبط با نارضایتی/فوریت بود — برای برجسته‌سازی در لیست داشبورد
  priority?: 'normal' | 'high';
}

export interface AiSuggestionPayload {
  conversationId: string;
  suggestion: string;
}
