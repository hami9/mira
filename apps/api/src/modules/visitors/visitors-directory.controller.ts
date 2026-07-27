import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';
import { RequirePermission } from '../../common/guards/require-permission.decorator';
import { VisitorsDirectoryService } from './visitors-directory.service';

// صفحات بازدیدکنندگان در داشبورد — پشت دسترسی «مشاهده بازدیدکنندگان» (ادمین همیشه دارد)
@Controller('v1/visitors')
@RequirePermission('viewVisitors')
export class VisitorsDirectoryController {
  constructor(private readonly directoryService: VisitorsDirectoryService) {}

  @Get('stats')
  getStats(@CurrentAgent() agent: AgentAccessTokenPayload) {
    return this.directoryService.getStats(agent.siteId);
  }

  @Get()
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
  getProfile(@CurrentAgent() agent: AgentAccessTokenPayload, @Param('id') id: string) {
    return this.directoryService.getProfile(agent.siteId, id);
  }
}
