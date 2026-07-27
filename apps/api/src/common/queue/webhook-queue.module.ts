import { Global, Module } from '@nestjs/common';
import { WebhookQueueService } from './webhook-queue.service';

// Global چون تولیدکننده‌ی این صف از چند نقطه (ChatGateway برای message.created،
// ConversationsService/ChatGateway برای conversation.resolved) ممکنه صدا زده بشه
@Global()
@Module({
  providers: [WebhookQueueService],
  exports: [WebhookQueueService],
})
export class WebhookQueueModule {}
