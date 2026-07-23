import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  AI_QUEUE_NAMES,
  AiBotReplyJobData,
  AiEmbedDocumentJobData,
  AiSuggestReplyJobData,
  AiSummarizeConversationJobData,
} from '@mira/shared-types';

// این سرویس فقط job اضافه می‌کنه (producer) — پردازش واقعی (فراخوانی AI) در apps/worker انجام
// می‌شه تا مسیر درخواست/رویداد زنده‌ی api هیچ‌وقت منتظر پاسخ کند مدل زبانی نمونه.
@Injectable()
export class AiQueueService implements OnModuleDestroy {
  private readonly botReplyQueue: Queue<AiBotReplyJobData>;
  private readonly embedDocumentQueue: Queue<AiEmbedDocumentJobData>;
  private readonly suggestReplyQueue: Queue<AiSuggestReplyJobData>;
  private readonly summarizeConversationQueue: Queue<AiSummarizeConversationJobData>;

  constructor(private readonly config: ConfigService) {
    const connection = {
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      maxRetriesPerRequest: null,
    };
    const prefix = this.config.get<string>('QUEUE_PREFIX', 'mira');

    this.botReplyQueue = new Queue(AI_QUEUE_NAMES.BotReply, { connection, prefix });
    this.embedDocumentQueue = new Queue(AI_QUEUE_NAMES.EmbedDocument, { connection, prefix });
    this.suggestReplyQueue = new Queue(AI_QUEUE_NAMES.SuggestReply, { connection, prefix });
    this.summarizeConversationQueue = new Queue(AI_QUEUE_NAMES.SummarizeConversation, {
      connection,
      prefix,
    });
  }

  async enqueueBotReply(data: AiBotReplyJobData): Promise<void> {
    // اگه ربات جواب نده مشکلی نیست (مکالمه دست‌نخورده برای اپراتور می‌مونه)، پس retry زیاد لازم نیست
    await this.botReplyQueue.add('reply', data, { attempts: 1, removeOnComplete: true, removeOnFail: 100 });
  }

  async enqueueEmbedDocument(data: AiEmbedDocumentJobData): Promise<void> {
    await this.embedDocumentQueue.add('embed', data, { attempts: 2, removeOnComplete: true, removeOnFail: 50 });
  }

  async enqueueSuggestReply(data: AiSuggestReplyJobData): Promise<void> {
    await this.suggestReplyQueue.add('suggest', data, { attempts: 1, removeOnComplete: true, removeOnFail: 50 });
  }

  async enqueueSummarizeConversation(data: AiSummarizeConversationJobData): Promise<void> {
    await this.summarizeConversationQueue.add('summarize', data, {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: 50,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.botReplyQueue.close(),
      this.embedDocumentQueue.close(),
      this.suggestReplyQueue.close(),
      this.summarizeConversationQueue.close(),
    ]);
  }
}
