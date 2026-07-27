import { Module } from '@nestjs/common';
import { TokenModule } from '../../common/token/token.module';
import { RateLimitModule } from '../../common/rate-limit/rate-limit.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { AgentsModule } from '../agents/agents.module';
import { AutomationModule } from '../automation/automation.module';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [
    TokenModule,
    RateLimitModule,
    ConversationsModule,
    MessagesModule,
    AgentsModule,
    AutomationModule,
  ],
  providers: [ChatGateway],
})
export class ChatModule {}
