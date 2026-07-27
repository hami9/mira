import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AgentJwtGuard } from '../../common/guards/agent-jwt.guard';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';
import { RequirePermission } from '../../common/guards/require-permission.decorator';
import { KnowledgeBaseService } from './knowledge-base.service';
import { CreateKnowledgeDocumentRequestDto } from './dto/create-knowledge-document.dto';

@Controller('v1/knowledge-base')
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  // خواندن فهرست برای همه‌ی اپراتورها بازه — باید بدونن ربات از چه منابعی جواب می‌ده
  @Get()
  @UseGuards(AgentJwtGuard)
  list(@CurrentAgent() agent: AgentAccessTokenPayload) {
    return this.knowledgeBaseService.listForSite(agent.siteId);
  }

  @Post()
  @RequirePermission('manageKnowledgeBase')
  create(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Body() dto: CreateKnowledgeDocumentRequestDto,
  ) {
    return this.knowledgeBaseService.create(agent.siteId, dto);
  }

  @Delete(':id')
  @RequirePermission('manageKnowledgeBase')
  delete(@CurrentAgent() agent: AgentAccessTokenPayload, @Param('id') id: string) {
    return this.knowledgeBaseService.delete(agent.siteId, id);
  }
}
