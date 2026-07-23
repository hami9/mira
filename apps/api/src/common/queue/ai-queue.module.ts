import { Global, Module } from '@nestjs/common';
import { AiQueueService } from './ai-queue.service';

// Global چون تولیدکننده‌ی صف AI از چند ماژول مختلف صدا زده می‌شه (ChatGateway، Conversations، KnowledgeBase)
@Global()
@Module({
  providers: [AiQueueService],
  exports: [AiQueueService],
})
export class AiQueueModule {}
