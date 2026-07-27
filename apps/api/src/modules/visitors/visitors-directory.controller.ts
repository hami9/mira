import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';
import { RequirePermission } from '../../common/guards/require-permission.decorator';
import { VisitorsDirectoryService } from './visitors-directory.service';

// صفحات بازدیدکنندگان در داشبورد — پشت دسترسی «مشاهده بازدیدکنندگان» (ادمین همیشه دارد)
@Controller('v1/visitors')
export class VisitorsDirectoryController {
  constructor(private readonly directoryService: VisitorsDirectoryService) {}

  @Get('stats')
  @RequirePermission('viewVisitors')
  getStats(@CurrentAgent() agent: AgentAccessTokenPayload) {
    return this.directoryService.getStats(agent.siteId);
  }

  @Get()
  @RequirePermission('viewVisitors')
  list(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Query('online') online?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.directoryService.list(agent.siteId, {
      onlineOnly: online === 'true',
      search: search?.trim() || undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @RequirePermission('viewVisitors')
  getProfile(@CurrentAgent() agent: AgentAccessTokenPayload, @Param('id') id: string) {
    return this.directoryService.getProfile(agent.siteId, id);
  }

  // حذف کامل و برگشت‌ناپذیر — دسترسی جداگانه‌ای از «مشاهده» دارد
  @Delete(':id')
  @RequirePermission('deleteVisitorData')
  deleteVisitorData(@CurrentAgent() agent: AgentAccessTokenPayload, @Param('id') id: string) {
    return this.directoryService.deleteVisitorData(agent.siteId, id);
  }
}
