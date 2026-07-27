import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ConversationStatus } from '@mira/shared-types';
import { AgentJwtGuard } from '../../common/guards/agent-jwt.guard';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';
import { AiQueueService } from '../../common/queue/ai-queue.service';
import { RequirePermission } from '../../common/guards/require-permission.decorator';
import { ConversationsService } from './conversations.service';
import { UpdateConversationRequestDto } from './dto/update-conversation.dto';

@Controller('v1/conversations')
@UseGuards(AgentJwtGuard)
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly aiQueue: AiQueueService,
  ) {}

  @Get()
  list(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Query('status') status?: ConversationStatus,
    @Query('department') department?: string,
    @Query('search') search?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.conversationsService.listForSite(agent.siteId, agent.sub, {
      status,
      department,
      search,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  getOne(@CurrentAgent() agent: AgentAccessTokenPayload, @Param('id') id: string) {
    return this.conversationsService.findByIdForSite(id, agent.siteId);
  }

  @Patch(':id')
  update(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateConversationRequestDto,
  ) {
    return this.conversationsService.updateDetails(id, agent.siteId, dto);
  }

  @Post(':id/assign')
  assignToSelf(@CurrentAgent() agent: AgentAccessTokenPayload, @Param('id') id: string) {
    return this.conversationsService.assignAgent(id, agent.siteId, agent.sub);
  }

  @Post(':id/resolve')
  @RequirePermission('resolveConversations')
  resolve(@CurrentAgent() agent: AgentAccessTokenPayload, @Param('id') id: string) {
    return this.conversationsService.resolve(id, agent.siteId);
  }

  @Post(':id/read')
  @HttpCode(204)
  markAsRead(@CurrentAgent() agent: AgentAccessTokenPayload, @Param('id') id: string) {
    return this.conversationsService.markAsRead(id, agent.siteId, agent.sub);
  }

  // Copilot: پیشنهاد پاسخ — نتیجه سنکرون برنمی‌گرده، از طریق Socket.io (ai:reply-suggested) می‌رسه
  @Post(':id/suggest-reply')
  @HttpCode(202)
  async suggestReply(@CurrentAgent() agent: AgentAccessTokenPayload, @Param('id') id: string) {
    await this.conversationsService.findByIdForSite(id, agent.siteId);
    await this.aiQueue.enqueueSuggestReply({ siteId: agent.siteId, conversationId: id, agentId: agent.sub });
  }
}
