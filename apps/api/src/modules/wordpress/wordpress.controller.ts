import { Controller, ForbiddenException, Get, Header } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Throttle } from '@nestjs/throttler';
import { AgentEntity, SiteEntity } from '../../database/entities';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { RequirePermission } from '../../common/guards/require-permission.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';
import { WordPressService } from './wordpress.service';

@Controller('v1/wordpress')
export class WordPressController {
  constructor(
    private readonly wordpress: WordPressService,
    @InjectRepository(SiteEntity) private readonly sites: Repository<SiteEntity>,
    @InjectRepository(AgentEntity) private readonly agents: Repository<AgentEntity>,
  ) {}

  @Get('status')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  @RequirePermission('manageSiteSettings')
  async status(@CurrentAgent() agent: AgentAccessTokenPayload) {
    if (!(await this.agents.existsBy({ id: agent.sub, siteId: agent.siteId })))
      throw new ForbiddenException('دسترسی این فروشگاه مجاز نیست');
    const site = await this.sites.findOneByOrFail({ id: agent.siteId });
    return this.wordpress.connectionStatus(site);
  }
}
