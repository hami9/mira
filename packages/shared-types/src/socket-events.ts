import { MessageSenderType, ConversationStatus } from './enums';
import type { AiMessageMetadata } from './ai';
import type { ChatToolMetadata } from './chat-tools';

// نام رویدادهای Socket.io مشترک بین api/dashboard/widget — تغییرشون فقط باید اینجا انجام شه
export enum SocketEvent {
  // client -> server
  ConversationJoin = 'conversation:join',
  MessageSend = 'message:send',
  TypingStart = 'typing:start',
  TypingStop = 'typing:stop',
  // server -> client
  MessageNew = 'message:new',
  MessageUpdated = 'message:updated',
  Typing = 'typing',
  ConversationCreated = 'conversation:created',
  ConversationStarted = 'conversation:started',
  ConversationUpdated = 'conversation:updated',
  ConnectionError = 'connection:error',
  VisitorUpdated = 'visitor:updated',
  VisitorModerationChanged = 'visitor:moderation',
  // server -> client: پاسخ پیشنهادی Copilot برای اپراتور (نتیجه‌ی صف ai-suggest-reply) آماده شد
  AiReplySuggested = 'ai:reply-suggested',
  AiStatus = 'ai:status',
}

export interface MessagePayload {
  toolMetadata?: ChatToolMetadata | null;
  aiMetadata?: AiMessageMetadata | null;
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
  deleted?: boolean;
  deletedAt?: string | null;
  restoredAsHistory?: boolean;
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
