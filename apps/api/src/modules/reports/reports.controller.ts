import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';
import { RequirePermission } from '../../common/guards/require-permission.decorator';
import { ReportsService } from './reports.service';

// گزارش‌ها شامل عملکرد تک‌تکِ اپراتورهاست، پس به‌صورت پیش‌فرض بسته است و ادمین باید
// دسترسی «مشاهده گزارش‌ها» را صریحاً بدهد. خروجی CSV دسترسی جداگانه‌ی خودش را دارد.
@Controller('v1/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  @RequirePermission('viewReports')
  async overview(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const range = this.reportsService.resolveRange(from, to);
    return this.reportsService.getOverview(agent.siteId, range);
  }

  @Get('agents')
  @RequirePermission('viewReports')
  async agents(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const range = this.reportsService.resolveRange(from, to);
    return this.reportsService.getAgentPerformance(agent.siteId, range);
  }

  @Get('export')
  @RequirePermission('exportData')
  async export(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<void> {
    const range = this.reportsService.resolveRange(from, to);
    const csv = await this.reportsService.exportAgentPerformanceCsv(agent.siteId, range);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="gozaresh-amalkard.csv"');
    res.send(csv);
  }
}
