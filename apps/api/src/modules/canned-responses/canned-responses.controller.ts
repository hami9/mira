import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AgentJwtGuard } from '../../common/guards/agent-jwt.guard';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';
import { RequirePermission } from '../../common/guards/require-permission.decorator';
import { CannedResponsesService } from './canned-responses.service';
import { CreateCannedResponseRequestDto } from './dto/create-canned-response.dto';
import { UpdateCannedResponseRequestDto } from './dto/update-canned-response.dto';

@Controller('v1/canned-responses')
export class CannedResponsesController {
  constructor(private readonly service: CannedResponsesService) {}

  // خواندن برای همه‌ی اپراتورها بازه — ابزار روزمره‌ی پاسخ‌دادن است
  @Get()
  @UseGuards(AgentJwtGuard)
  list(@CurrentAgent() agent: AgentAccessTokenPayload) {
    return this.service.listForSite(agent.siteId);
  }

  @Post()
  @RequirePermission('manageCannedResponses')
  create(@CurrentAgent() agent: AgentAccessTokenPayload, @Body() dto: CreateCannedResponseRequestDto) {
    return this.service.create(agent.siteId, dto);
  }

  @Patch(':id')
  @RequirePermission('manageCannedResponses')
  update(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCannedResponseRequestDto,
  ) {
    return this.service.update(id, agent.siteId, dto);
  }

  @Delete(':id')
  @RequirePermission('manageCannedResponses')
  remove(@CurrentAgent() agent: AgentAccessTokenPayload, @Param('id') id: string) {
    return this.service.remove(id, agent.siteId);
  }
}
