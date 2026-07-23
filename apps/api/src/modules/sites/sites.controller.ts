import { Body, Controller, ForbiddenException, Get, Patch, UseGuards } from '@nestjs/common';
import { AgentRole, SiteSettingsDto } from '@mira/shared-types';
import { AgentJwtGuard } from '../../common/guards/agent-jwt.guard';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';
import { SitesService } from './sites.service';
import { UpdateSiteSettingsRequestDto } from './dto/update-site-settings.dto';
import { SiteEntity } from '../../database/entities';

@Controller('v1/sites/me')
@UseGuards(AgentJwtGuard)
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Get()
  async getSettings(@CurrentAgent() agent: AgentAccessTokenPayload): Promise<SiteSettingsDto> {
    const site = await this.sitesService.findById(agent.siteId);
    return this.toSettingsDto(site);
  }

  @Patch()
  async updateSettings(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Body() dto: UpdateSiteSettingsRequestDto,
  ): Promise<SiteSettingsDto> {
    // فقط ادمین اجازه‌ی تغییر تنظیمات سایت (ساعت کاری، دامنه‌ها و ...) رو داره
    if (agent.role !== AgentRole.ADMIN) {
      throw new ForbiddenException('فقط ادمین می‌تواند تنظیمات سایت را تغییر دهد');
    }
    const site = await this.sitesService.updateSettings(agent.siteId, dto);
    return this.toSettingsDto(site);
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
    };
  }
}
