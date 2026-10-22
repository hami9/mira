// نام صف‌های BullMQ — بین api (producer) و worker (consumer) مشترک است تا از اختلاف تایپی جلوگیری شود
export const AI_QUEUE_NAMES = {
  BotReply: 'ai-bot-reply',
  EmbedDocument: 'ai-embed-document',
  SuggestReply: 'ai-suggest-reply',
  SummarizeConversation: 'ai-summarize-conversation',
} as const;

export interface AiBotReplyJobData {
  siteId: string;
  conversationId: string;
  visitorMessageId: string;
}

export interface AiEmbedDocumentJobData {
  siteId: string;
  documentId: string;
}

export interface AiSuggestReplyJobData {
  siteId: string;
  conversationId: string;
  agentId: string;
}

export interface AiSummarizeConversationJobData {
  siteId: string;
  conversationId: string;
}

export type KnowledgeDocumentStatus = 'pending' | 'ready' | 'failed';

export interface KnowledgeDocumentDto {
  id: string;
  title: string;
  content: string;
  status: KnowledgeDocumentStatus;
  chunkCount: number;
  createdAt: string;
}

export interface CreateKnowledgeDocumentDto {
  title: string;
  content: string;
}

export interface AiPolicy {
  useKnowledgeBase: boolean;
  useWebsite: boolean;
  useProducts: boolean;
  showSources: boolean;
  minSimilarity: number;
  maxProducts: number;
  maxInputChars: number;
  blockedTopics: string[];
  serverContext: string;
  model: string;
  quickReplies: string[];
}

export const DEFAULT_AI_POLICY: AiPolicy = {
  useKnowledgeBase: true,
  useWebsite: false,
  useProducts: false,
  showSources: true,
  minSimilarity: 0.35,
  maxProducts: 3,
  maxInputChars: 2000,
  blockedTopics: [],
  serverContext: '',
  model: '',
  quickReplies: ['راهنمای انتخاب محصول', 'شرایط ارسال سفارش', 'گفتگو با پشتیبان'],
};

export interface AiProduct {
  priceIsMinimum?: boolean;
  description?: string;
  id: string;
  name: string;
  url: string;
  imageUrl: string | null;
  price: string;
  currency: string;
  inStock: boolean;
}

export interface AiSource {
  id: string;
  title: string;
  url?: string;
}

export interface AiMessageMetadata {
  products: AiProduct[];
  sources: AiSource[];
  handoff?: boolean;
}

export interface AiStatusPayload {
  conversationId: string;
  messageId: string;
  stage: 'retrieving' | 'thinking' | 'idle' | 'handoff';
}

export const AI_STATUS_LABELS: Record<AiStatusPayload['stage'], string> = {
  retrieving: 'در حال بررسی منابع فروشگاه',
  thinking: 'در حال آماده‌سازی پاسخ',
  idle: '',
  handoff: 'گفتگو به پشتیبان سپرده شد',
};

export interface WidgetAssistant {
  siteName?: string;
  avatarUrl?: string | null;
  enabled: boolean;
  name: string;
  greeting: string | null;
  quickReplies: string[];
}

export function formatProductPrice(product: AiProduct): string {
  const currency =
    product.currency === 'IRT' ? 'تومان' : product.currency === 'IRR' ? 'ریال' : product.currency;
  return `${product.priceIsMinimum ? 'از ' : ''}${Number(product.price).toLocaleString('fa-IR', { maximumFractionDigits: 6 })} ${currency}`;
}

export function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
