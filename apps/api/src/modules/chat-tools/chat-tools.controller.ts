import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import type { SaveChatFormDto } from '@mira/shared-types';
import { AgentJwtGuard } from '../../common/guards/agent-jwt.guard';
import { VisitorJwtGuard } from '../../common/guards/visitor-jwt.guard';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { CurrentVisitor } from '../../common/decorators/current-visitor.decorator';
import { AgentAccessTokenPayload, VisitorTokenPayload } from '../../common/token/token.service';
import { ChatToolsService } from './chat-tools.service';
@Controller('v1')
export class ChatToolsController {
  constructor(private readonly tools: ChatToolsService) {}
  @Get('chat-forms') @UseGuards(AgentJwtGuard) list(@CurrentAgent() a: AgentAccessTokenPayload) {
    return this.tools.list(a.siteId, a.sub);
  }
  @Post('chat-forms') @UseGuards(AgentJwtGuard) create(
    @CurrentAgent() a: AgentAccessTokenPayload,
    @Body() dto: SaveChatFormDto,
  ) {
    return this.tools.save(a.siteId, a.sub, dto);
  }
  @Patch('chat-forms/:id') @UseGuards(AgentJwtGuard) update(
    @CurrentAgent() a: AgentAccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveChatFormDto,
  ) {
    return this.tools.save(a.siteId, a.sub, dto, id);
  }
  @Delete('chat-forms/:id') @HttpCode(204) @UseGuards(AgentJwtGuard) archive(
    @CurrentAgent() a: AgentAccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tools.archive(a.siteId, a.sub, id);
  }
  @Post('conversations/:id/links') @HttpCode(200) @UseGuards(AgentJwtGuard) link(
    @CurrentAgent() a: AgentAccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { url: string; title?: string; description?: string; clientMessageId: string },
  ) {
    return this.tools.link(a.siteId, a.sub, id, dto);
  }
  @Post('conversations/:id/forms') @HttpCode(200) @UseGuards(AgentJwtGuard) form(
    @CurrentAgent() a: AgentAccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { templateId: string; clientMessageId: string },
  ) {
    return this.tools.form(a.siteId, a.sub, id, dto);
  }
  @Post('widget/conversations/:id/forms/:messageId/submit')
  @HttpCode(200)
  @UseGuards(VisitorJwtGuard)
  submit(
    @CurrentVisitor() v: VisitorTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: { answers: unknown; clientMessageId: string },
  ) {
    return this.tools.submit(v.siteId, v.sub, id, messageId, dto);
  }
}
