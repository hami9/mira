import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CreateAutomationRuleDto, UpdateAutomationRuleDto } from '@mira/shared-types';
import { AgentJwtGuard } from '../../common/guards/agent-jwt.guard';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';
import { RequirePermission } from '../../common/guards/require-permission.decorator';
import { AutomationService } from './automation.service';

@Controller('v1/automation-rules')
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  // دیدن قوانین برای همه بازه — اپراتور باید بفهمه چرا مکالمه‌ای خودکار به دپارتمانش رسیده
  @Get()
  @UseGuards(AgentJwtGuard)
  list(@CurrentAgent() agent: AgentAccessTokenPayload) {
    return this.automationService.listForSite(agent.siteId);
  }

  @Post()
  @RequirePermission('manageAutomation')
  create(@CurrentAgent() agent: AgentAccessTokenPayload, @Body() dto: CreateAutomationRuleDto) {
    return this.automationService.create(agent.siteId, dto);
  }

  @Patch(':id')
  @RequirePermission('manageAutomation')
  update(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationRuleDto,
  ) {
    return this.automationService.update(agent.siteId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('manageAutomation')
  delete(@CurrentAgent() agent: AgentAccessTokenPayload, @Param('id') id: string) {
    return this.automationService.delete(agent.siteId, id);
  }
}
