import { Controller, ForbiddenException, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AgentRole } from '@mira/shared-types';
import { AgentJwtGuard } from '../../common/guards/agent-jwt.guard';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';
import { ReportsService } from './reports.service';

// گزارش‌گیری فقط برای ادمین — شامل عملکرد تک‌تکِ اپراتورها هم می‌شه، پس برای همه‌ی اپراتورها باز نیست
@Controller('v1/reports')
@UseGuards(AgentJwtGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  async overview(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.assertAdmin(agent);
    const range = this.reportsService.resolveRange(from, to);
    return this.reportsService.getOverview(agent.siteId, range);
  }

  @Get('agents')
  async agents(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.assertAdmin(agent);
    const range = this.reportsService.resolveRange(from, to);
    return this.reportsService.getAgentPerformance(agent.siteId, range);
  }

  @Get('export')
  async export(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<void> {
    this.assertAdmin(agent);
    const range = this.reportsService.resolveRange(from, to);
    const csv = await this.reportsService.exportAgentPerformanceCsv(agent.siteId, range);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="gozaresh-amalkard.csv"');
    res.send(csv);
  }

  private assertAdmin(agent: AgentAccessTokenPayload): void {
    if (agent.role !== AgentRole.ADMIN) {
      throw new ForbiddenException('فقط ادمین می‌تواند گزارش‌ها را ببیند');
    }
  }
}
