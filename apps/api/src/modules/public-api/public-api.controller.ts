import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CurrentPublicSite } from '../../common/decorators/current-public-site.decorator';
import { PublicApiService } from './public-api.service';

// API عمومی فقط-خواندنی (فاز ۶) — برای توسعه‌دهنده‌های بیرونی که می‌خوان مکالمات/پیام‌های
// سایت خودشون رو با کلید API بخونن (مثلاً برای همگام‌سازی با CRM). نوشتن/ارسال پیام از این
// مسیر پشتیبانی نمی‌شه — همون‌قدر که نقشه‌راه خواسته («API عمومی») بدون گسترش غیرضروری scope.
@Controller('v1/public')
@UseGuards(ApiKeyGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class PublicApiController {
  constructor(private readonly publicApiService: PublicApiService) {}

  @Get('conversations')
  listConversations(
    @CurrentPublicSite() siteId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.publicApiService.listConversations(siteId, {
      status,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('conversations/:id/messages')
  listMessages(@CurrentPublicSite() siteId: string, @Param('id') conversationId: string) {
    return this.publicApiService.listMessages(siteId, conversationId);
  }
}
