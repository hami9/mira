import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AgentJwtGuard } from '../../common/guards/agent-jwt.guard';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';
import { CannedResponsesService } from './canned-responses.service';
import { CreateCannedResponseRequestDto } from './dto/create-canned-response.dto';
import { UpdateCannedResponseRequestDto } from './dto/update-canned-response.dto';

@Controller('v1/canned-responses')
@UseGuards(AgentJwtGuard)
export class CannedResponsesController {
  constructor(private readonly service: CannedResponsesService) {}

  @Get()
  list(@CurrentAgent() agent: AgentAccessTokenPayload) {
    return this.service.listForSite(agent.siteId);
  }

  @Post()
  create(@CurrentAgent() agent: AgentAccessTokenPayload, @Body() dto: CreateCannedResponseRequestDto) {
    return this.service.create(agent.siteId, dto);
  }

  @Patch(':id')
  update(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCannedResponseRequestDto,
  ) {
    return this.service.update(id, agent.siteId, dto);
  }

  @Delete(':id')
  remove(@CurrentAgent() agent: AgentAccessTokenPayload, @Param('id') id: string) {
    return this.service.remove(id, agent.siteId);
  }
}
