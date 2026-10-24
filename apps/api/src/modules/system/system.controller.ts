import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { AgentJwtGuard } from '../../common/guards/agent-jwt.guard';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';
import { SystemService } from './system.service';

@Controller('v1/system')
@UseGuards(AgentJwtGuard)
export class SystemController {
  constructor(private readonly system: SystemService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  status(@CurrentAgent() agent: AgentAccessTokenPayload) {
    return this.system.status(agent.siteId, agent.sub);
  }
}
