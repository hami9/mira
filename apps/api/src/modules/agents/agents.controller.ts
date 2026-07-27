import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  AgentRole,
  ChangePasswordDto,
  CreateAgentDto,
  UpdateAgentDto,
  UpdateMyProfileDto,
} from '@mira/shared-types';
import { AgentJwtGuard } from '../../common/guards/agent-jwt.guard';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';
import { AgentsManagementService } from './agents-management.service';

@Controller('v1/agents')
@UseGuards(AgentJwtGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsManagementService) {}

  // پروفایل خودِ اپراتور — قبل از مسیر ':id' تعریف شده تا 'me' به‌عنوان id تفسیر نشود
  @Get('me')
  getMyProfile(@CurrentAgent() agent: AgentAccessTokenPayload) {
    return this.agentsService.getProfile(agent.siteId, agent.sub);
  }

  @Patch('me')
  updateMyProfile(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Body() dto: UpdateMyProfileDto,
  ) {
    return this.agentsService.updateMyProfile(agent.sub, dto);
  }

  @Post('me/password')
  async changeMyPassword(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.agentsService.changeMyPassword(agent.sub, dto);
    return { ok: true };
  }

  // فهرست اپراتورها برای همه قابل مشاهده است (اپراتورها باید همکارانشان را بشناسند)،
  // ولی ساخت/ویرایش/حذف فقط دست ادمین است
  @Get()
  list(@CurrentAgent() agent: AgentAccessTokenPayload) {
    return this.agentsService.listForSite(agent.siteId);
  }

  @Get(':id')
  getProfile(@CurrentAgent() agent: AgentAccessTokenPayload, @Param('id') id: string) {
    return this.agentsService.getProfile(agent.siteId, id);
  }

  @Post()
  create(@CurrentAgent() agent: AgentAccessTokenPayload, @Body() dto: CreateAgentDto) {
    this.assertAdmin(agent);
    return this.agentsService.create(agent.siteId, dto);
  }

  @Patch(':id')
  update(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAgentDto,
  ) {
    this.assertAdmin(agent);
    return this.agentsService.update(agent.siteId, id, agent.sub, dto);
  }

  @Delete(':id')
  async delete(@CurrentAgent() agent: AgentAccessTokenPayload, @Param('id') id: string) {
    this.assertAdmin(agent);
    await this.agentsService.delete(agent.siteId, id, agent.sub);
    return { ok: true };
  }

  private assertAdmin(agent: AgentAccessTokenPayload): void {
    if (agent.role !== AgentRole.ADMIN) {
      throw new ForbiddenException('فقط ادمین می‌تواند اپراتورها را مدیریت کند');
    }
  }
}
