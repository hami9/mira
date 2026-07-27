import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CreateInternalNoteDto } from '@mira/shared-types';
import { AgentJwtGuard } from '../../common/guards/agent-jwt.guard';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';
import { ConversationsService } from '../conversations/conversations.service';
import { InternalNotesService } from './internal-notes.service';

// یادداشت داخلی فقط برای اپراتورهای همون سایت — هیچ endpoint یا سوکتی برای بازدیدکننده به این مسیر دسترسی نداره
@Controller('v1/conversations/:conversationId/notes')
@UseGuards(AgentJwtGuard)
export class InternalNotesController {
  constructor(
    private readonly notesService: InternalNotesService,
    private readonly conversationsService: ConversationsService,
  ) {}

  @Get()
  async list(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Param('conversationId') conversationId: string,
  ) {
    await this.conversationsService.findByIdForSite(conversationId, agent.siteId);
    return this.notesService.listForConversation(conversationId);
  }

  @Post()
  async create(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Param('conversationId') conversationId: string,
    @Body() dto: CreateInternalNoteDto,
  ) {
    await this.conversationsService.findByIdForSite(conversationId, agent.siteId);
    return this.notesService.create(agent.siteId, conversationId, agent.sub, dto.content.trim());
  }
}
