import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  MessageSenderType,
  WidgetSessionResponseDto,
  StartConversationResponseDto,
} from '@mira/shared-types';
import { VisitorJwtGuard } from '../../common/guards/visitor-jwt.guard';
import { CurrentVisitor } from '../../common/decorators/current-visitor.decorator';
import { VisitorTokenPayload, TokenService } from '../../common/token/token.service';
import { RedisRateLimiterService } from '../../common/rate-limit/redis-rate-limiter.service';
import { isWithinBusinessHours } from '../../common/business-hours/business-hours.util';
import { SitesService } from '../sites/sites.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../messages/messages.service';
import { VisitorsService } from './visitors.service';
import { WidgetSessionDto } from './dto/widget-session.dto';
import { ReportPageViewRequestDto } from './dto/report-page-view.dto';
import { SubmitCsatRequestDto } from './dto/submit-csat.dto';

@Controller('v1/widget')
export class VisitorsController {
  constructor(
    private readonly visitorsService: VisitorsService,
    private readonly sitesService: SitesService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly tokenService: TokenService,
    private readonly rateLimiter: RedisRateLimiterService,
  ) {}

  @Post('sessions')
  @HttpCode(200)
  async createSession(
    @Req() request: Request,
    @Body() dto: WidgetSessionDto,
  ): Promise<WidgetSessionResponseDto> {
    const allowed = await this.rateLimiter.consume(`widget-session:${request.ip}`, 30, 60);
    if (!allowed) {
      throw new HttpException('تعداد درخواست‌ها بیش از حد مجاز است', HttpStatus.TOO_MANY_REQUESTS);
    }

    const site = await this.sitesService.findByWidgetKey(dto.widgetKey);
    const origin = request.headers.origin ?? '';
    if (!origin || !this.sitesService.isDomainAllowed(site, origin)) {
      throw new ForbiddenException('این دامنه اجازه استفاده از این ویجت را ندارد');
    }

    const userAgentHeader = request.headers['user-agent'];
    const visitor = await this.visitorsService.findOrCreate({
      siteId: site.id,
      visitorRef: dto.visitorRef,
      name: dto.name,
      email: dto.email,
      userAgent: Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader,
    });

    const activeConversation = await this.conversationsService.findActiveForVisitor(visitor.id);
    const pendingRatingConversation = activeConversation
      ? null
      : await this.conversationsService.findPendingRatingForVisitor(visitor.id);

    const visitorToken = this.tokenService.signVisitorToken({
      sub: visitor.id,
      siteId: site.id,
      domain: origin,
    });

    return {
      visitorToken,
      visitorRef: visitor.visitorRef,
      siteId: site.id,
      activeConversationId: activeConversation?.id ?? null,
      pendingRatingConversationId: pendingRatingConversation?.id ?? null,
      triggerMessage: site.triggerMessage.enabled ? site.triggerMessage : null,
    };
  }

  @Post('conversations')
  @HttpCode(200)
  @UseGuards(VisitorJwtGuard)
  async startConversation(
    @CurrentVisitor() visitor: VisitorTokenPayload,
  ): Promise<StartConversationResponseDto> {
    const allowed = await this.rateLimiter.consume(`widget-start:${visitor.sub}`, 10, 60);
    if (!allowed) {
      throw new HttpException('تعداد درخواست‌ها بیش از حد مجاز است', HttpStatus.TOO_MANY_REQUESTS);
    }

    const existing = await this.conversationsService.findActiveForVisitor(visitor.sub);
    if (existing) {
      return { conversationId: existing.id, status: existing.status };
    }

    const conversation = await this.conversationsService.createConversation(
      visitor.siteId,
      visitor.sub,
    );

    // اگه خارج از ساعت کاری تنظیم‌شده‌ی سایت باشیم، همون اول یک پیام خودکار (bot) در مکالمه بگذار
    const site = await this.sitesService.findById(visitor.siteId);
    if (site.offlineMessage && !isWithinBusinessHours(site.businessHours)) {
      await this.messagesService.create({
        siteId: site.id,
        conversationId: conversation.id,
        senderType: MessageSenderType.BOT,
        senderId: null,
        rawContent: site.offlineMessage,
      });
    }

    return { conversationId: conversation.id, status: conversation.status };
  }

  @Get('conversations/:id/messages')
  @UseGuards(VisitorJwtGuard)
  async listMessages(
    @CurrentVisitor() visitor: VisitorTokenPayload,
    @Param('id') conversationId: string,
    @Query('before') before?: string,
  ) {
    // سقف روی خواندن تاریخچه هم لازم است تا کسی با توکن معتبر، تاریخچه را در حلقه نکشد
    const allowed = await this.rateLimiter.consume(`widget-history:${visitor.sub}`, 60, 60);
    if (!allowed) {
      throw new HttpException('درخواست بیش از حد مجاز', HttpStatus.TOO_MANY_REQUESTS);
    }
    await this.conversationsService.ensureVisitorOwnsConversation(conversationId, visitor.sub);
    return this.messagesService.listForConversation(conversationId, { before });
  }

  @Post('conversations/:id/csat')
  @HttpCode(204)
  @UseGuards(VisitorJwtGuard)
  async submitCsat(
    @CurrentVisitor() visitor: VisitorTokenPayload,
    @Param('id') conversationId: string,
    @Body() dto: SubmitCsatRequestDto,
  ): Promise<void> {
    const allowed = await this.rateLimiter.consume(`widget-csat:${visitor.sub}`, 10, 60);
    if (!allowed) {
      throw new HttpException('درخواست بیش از حد مجاز', HttpStatus.TOO_MANY_REQUESTS);
    }
    await this.conversationsService.submitCsatAsVisitor(
      conversationId,
      visitor.sub,
      dto.score,
      dto.comment,
    );
  }

  @Post('page-views')
  @HttpCode(204)
  @UseGuards(VisitorJwtGuard)
  async reportPageView(
    @CurrentVisitor() visitor: VisitorTokenPayload,
    @Body() dto: ReportPageViewRequestDto,
  ): Promise<void> {
    const allowed = await this.rateLimiter.consume(`widget-pageview:${visitor.sub}`, 60, 60);
    if (!allowed) return; // شمارش بازدید مهم‌تر از خطا دادن به کاربر نیست؛ فقط بی‌صدا نادیده بگیر

    await this.visitorsService.recordPageView(visitor.siteId, visitor.sub, dto.url, dto.title);
  }
}
