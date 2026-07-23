import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AgentJwtGuard } from '../../common/guards/agent-jwt.guard';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from './messages.service';

@Controller('v1/conversations/:conversationId/messages')
@UseGuards(AgentJwtGuard)
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
  ) {}

  @Get()
  async list(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Param('conversationId') conversationId: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    // اطمینان از اینکه مکالمه متعلق به همون سایتِ اپراتور است (جلوگیری از نشت داده بین سایت‌ها)
    await this.conversationsService.findByIdForSite(conversationId, agent.siteId);
    return this.messagesService.listForConversation(conversationId, {
      before,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
