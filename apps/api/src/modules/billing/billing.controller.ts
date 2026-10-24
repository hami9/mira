import { BadRequestException, Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { AgentJwtGuard } from '../../common/guards/agent-jwt.guard';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';
import { BillingService } from './billing.service';
import { UsageService } from './usage.service';

@Controller('v1/ai/billing')
@UseGuards(AgentJwtGuard)
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly usage: UsageService,
  ) {}
  @Get('usage')
  @Header('Cache-Control', 'no-store')
  report(@CurrentAgent() agent: AgentAccessTokenPayload, @Query('days') days = '7') {
    if (!['1', '7', '30'].includes(days))
      throw new BadRequestException('بازه گزارش باید ۱، ۷ یا ۳۰ روز باشد');
    return this.usage.report(agent.siteId, agent.sub, Number(days));
  }
  @Get()
  @Header('Cache-Control', 'no-store')
  overview(@CurrentAgent() agent: AgentAccessTokenPayload) {
    return this.billing.overview(agent.siteId, agent.sub);
  }
}
