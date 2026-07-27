import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AgentRole, CreateAutomationRuleDto, UpdateAutomationRuleDto } from '@mira/shared-types';
import { AgentJwtGuard } from '../../common/guards/agent-jwt.guard';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';
import { AutomationService } from './automation.service';

// مدیریت قوانین اتوماسیون فقط با ادمین است — روی مسیریابی/برچسب‌گذاری خودکار همه‌ی مکالمات سایت اثر می‌ذاره
@Controller('v1/automation-rules')
@UseGuards(AgentJwtGuard)
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Get()
  list(@CurrentAgent() agent: AgentAccessTokenPayload) {
    return this.automationService.listForSite(agent.siteId);
  }

  @Post()
  create(@CurrentAgent() agent: AgentAccessTokenPayload, @Body() dto: CreateAutomationRuleDto) {
    this.assertAdmin(agent);
    return this.automationService.create(agent.siteId, dto);
  }

  @Patch(':id')
  update(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationRuleDto,
  ) {
    this.assertAdmin(agent);
    return this.automationService.update(agent.siteId, id, dto);
  }

  @Delete(':id')
  delete(@CurrentAgent() agent: AgentAccessTokenPayload, @Param('id') id: string) {
    this.assertAdmin(agent);
    return this.automationService.delete(agent.siteId, id);
  }

  private assertAdmin(agent: AgentAccessTokenPayload): void {
    if (agent.role !== AgentRole.ADMIN) {
      throw new ForbiddenException('فقط ادمین می‌تواند قوانین اتوماسیون را مدیریت کند');
    }
  }
}
