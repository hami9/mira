import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AgentRole } from '@mira/shared-types';
import { AgentJwtGuard } from '../../common/guards/agent-jwt.guard';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { CreateKnowledgeDocumentRequestDto } from './dto/create-knowledge-document.dto';

// مدیریت پایگاه دانش فقط با ادمین است — تعیین می‌کنه ربات RAG با چه اطلاعاتی پاسخ بده
@Controller('v1/knowledge-base')
@UseGuards(AgentJwtGuard)
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Get()
  list(@CurrentAgent() agent: AgentAccessTokenPayload) {
    return this.knowledgeBaseService.listForSite(agent.siteId);
  }

  @Post()
  create(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Body() dto: CreateKnowledgeDocumentRequestDto,
  ) {
    this.assertAdmin(agent);
    return this.knowledgeBaseService.create(agent.siteId, dto);
  }

  @Delete(':id')
  delete(@CurrentAgent() agent: AgentAccessTokenPayload, @Param('id') id: string) {
    this.assertAdmin(agent);
    return this.knowledgeBaseService.delete(agent.siteId, id);
  }

  private assertAdmin(agent: AgentAccessTokenPayload): void {
    if (agent.role !== AgentRole.ADMIN) {
      throw new ForbiddenException('فقط ادمین می‌تواند پایگاه دانش را تغییر دهد');
    }
  }
}
