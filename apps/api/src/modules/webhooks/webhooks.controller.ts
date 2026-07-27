import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateWebhookDto, UpdateWebhookDto } from '@mira/shared-types';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';
import { RequirePermission } from '../../common/guards/require-permission.decorator';
import { WebhooksService } from './webhooks.service';

// شامل سکرت امضای درخواست خروجی است، پس حتی خواندنش هم نیاز به دسترسی صریح دارد
@Controller('v1/webhooks')
@RequirePermission('manageWebhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  list(@CurrentAgent() agent: AgentAccessTokenPayload) {
    return this.webhooksService.listForSite(agent.siteId);
  }

  @Post()
  create(@CurrentAgent() agent: AgentAccessTokenPayload, @Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(agent.siteId, dto);
  }

  @Patch(':id')
  update(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooksService.update(agent.siteId, id, dto);
  }

  @Delete(':id')
  delete(@CurrentAgent() agent: AgentAccessTokenPayload, @Param('id') id: string) {
    return this.webhooksService.delete(agent.siteId, id);
  }
}
