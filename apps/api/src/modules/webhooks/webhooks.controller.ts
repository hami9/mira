import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AgentRole, CreateWebhookDto, UpdateWebhookDto } from '@mira/shared-types';
import { AgentJwtGuard } from '../../common/guards/agent-jwt.guard';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';
import { WebhooksService } from './webhooks.service';

// مدیریت وب‌هوک فقط با ادمین است — شامل سکرت امضای درخواست خروجی
@Controller('v1/webhooks')
@UseGuards(AgentJwtGuard)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  list(@CurrentAgent() agent: AgentAccessTokenPayload) {
    this.assertAdmin(agent);
    return this.webhooksService.listForSite(agent.siteId);
  }

  @Post()
  create(@CurrentAgent() agent: AgentAccessTokenPayload, @Body() dto: CreateWebhookDto) {
    this.assertAdmin(agent);
    return this.webhooksService.create(agent.siteId, dto);
  }

  @Patch(':id')
  update(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    this.assertAdmin(agent);
    return this.webhooksService.update(agent.siteId, id, dto);
  }

  @Delete(':id')
  delete(@CurrentAgent() agent: AgentAccessTokenPayload, @Param('id') id: string) {
    this.assertAdmin(agent);
    return this.webhooksService.delete(agent.siteId, id);
  }

  private assertAdmin(agent: AgentAccessTokenPayload): void {
    if (agent.role !== AgentRole.ADMIN) {
      throw new ForbiddenException('فقط ادمین می‌تواند وب‌هوک‌ها را مدیریت کند');
    }
  }
}
