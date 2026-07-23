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
