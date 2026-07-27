import { Body, Controller, Delete, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { SiteSettingsDto } from '@mira/shared-types';
import { AgentJwtGuard } from '../../common/guards/agent-jwt.guard';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';
import { RequirePermission } from '../../common/guards/require-permission.decorator';
import { SitesService } from './sites.service';
import { UpdateSiteSettingsRequestDto } from './dto/update-site-settings.dto';
import { SiteEntity } from '../../database/entities';

@Controller('v1/sites/me')
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  // خواندن تنظیمات برای همه‌ی اپراتورها بازه (ساعت کاری، نام سایت و ... را لازم دارند)
  @Get()
  @UseGuards(AgentJwtGuard)
  async getSettings(@CurrentAgent() agent: AgentAccessTokenPayload): Promise<SiteSettingsDto> {
    const site = await this.sitesService.findById(agent.siteId);
    return this.toSettingsDto(site);
  }

  @Patch()
  @RequirePermission('manageSiteSettings')
  async updateSettings(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Body() dto: UpdateSiteSettingsRequestDto,
  ): Promise<SiteSettingsDto> {
    const site = await this.sitesService.updateSettings(agent.siteId, dto);
    return this.toSettingsDto(site);
  }

  @Get('api-key')
  @RequirePermission('manageWebhooks')
  getApiKeyStatus(@CurrentAgent() agent: AgentAccessTokenPayload) {
    return this.sitesService.getApiKeyStatus(agent.siteId);
  }

  // کلید واقعی فقط همین یک بار در پاسخ همین درخواست برمی‌گرده؛ بعدش فقط prefix قابل‌مشاهده‌ست
  @Post('api-key')
  @RequirePermission('manageWebhooks')
  generateApiKey(@CurrentAgent() agent: AgentAccessTokenPayload) {
    return this.sitesService.generateApiKey(agent.siteId);
  }

  @Delete('api-key')
  @RequirePermission('manageWebhooks')
  revokeApiKey(@CurrentAgent() agent: AgentAccessTokenPayload) {
    return this.sitesService.revokeApiKey(agent.siteId);
  }

  private toSettingsDto(site: SiteEntity): SiteSettingsDto {
    return {
      id: site.id,
      name: site.name,
      widgetKey: site.widgetKey,
      allowedDomains: site.allowedDomains,
      appearance: site.appearance,
      businessHours: site.businessHours,
      offlineMessage: site.offlineMessage,
      triggerMessage: site.triggerMessage,
      wordpressSiteUrl: site.wordpressSiteUrl,
      wordpressApiKey: site.wordpressApiKey,
      aiEnabled: site.aiEnabled,
      aiSystemPrompt: site.aiSystemPrompt,
      aiConfidenceThreshold: site.aiConfidenceThreshold,
      aiBotName: site.aiBotName,
      aiBotAvatarUrl: site.aiBotAvatarUrl,
      aiGreetingMessage: site.aiGreetingMessage,
      aiHandoffMessage: site.aiHandoffMessage,
      aiTemperature: site.aiTemperature,
      aiMaxTokens: site.aiMaxTokens,
      aiMaxRepliesPerConversation: site.aiMaxRepliesPerConversation,
      aiReplyOnlyOutsideBusinessHours: site.aiReplyOnlyOutsideBusinessHours,
    };
  }
}
