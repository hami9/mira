import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CustomerContextDto, VisitorInfoDto } from '@mira/shared-types';
import { AgentJwtGuard } from '../../common/guards/agent-jwt.guard';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';
import { parseUserAgent } from '../../common/user-agent/parse-user-agent.util';
import { ConversationsService } from '../conversations/conversations.service';
import { SitesService } from '../sites/sites.service';
import { WordPressService } from '../wordpress/wordpress.service';
import { VisitorsService } from './visitors.service';

// این کنترلر عمداً داخل VisitorsModule ثبت می‌شه (نه ConversationsModule) چون
// VisitorsModule از قبل به ConversationsModule وابسته است؛ اگه برعکس می‌کردیم
// (ConversationsModule -> VisitorsModule) یک وابستگی حلقوی بین دو ماژول ایجاد می‌شد.
@Controller('v1/conversations')
@UseGuards(AgentJwtGuard)
export class VisitorInfoController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly visitorsService: VisitorsService,
    private readonly sitesService: SitesService,
    private readonly wordPressService: WordPressService,
  ) {}

  @Get(':conversationId/visitor-info')
  async getVisitorInfo(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Param('conversationId') conversationId: string,
  ): Promise<VisitorInfoDto> {
    const conversation = await this.conversationsService.findByIdForSite(
      conversationId,
      agent.siteId,
    );
    const visitor = await this.visitorsService.findByIdForSite(
      conversation.visitorId,
      agent.siteId,
    );
    const pageViews = await this.visitorsService.listRecentPageViews(visitor.id);
    const { browser, os, deviceType } = parseUserAgent(visitor.userAgent);

    return {
      id: visitor.id,
      name: visitor.name,
      email: visitor.email,
      browser,
      os,
      deviceType,
      firstSeenAt: visitor.firstSeenAt.toISOString(),
      lastSeenAt: visitor.lastSeenAt.toISOString(),
      pages: pageViews.map((pageView) => ({
        url: pageView.url,
        title: pageView.title,
        visitedAt: pageView.visitedAt.toISOString(),
      })),
    };
  }

  // پنل مشتری ووکامرس کنار گفتگو (فاز ۳) — اگه سایت به وردپرس متصل نباشه یا بازدیدکننده
  // ایمیل نداشته باشه، found:false برمی‌گرده (نه خطا) تا داشبورد به‌سادگی این بخش رو مخفی کنه
  @Get(':conversationId/customer-context')
  async getCustomerContext(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Param('conversationId') conversationId: string,
  ): Promise<CustomerContextDto> {
    const conversation = await this.conversationsService.findByIdForSite(
      conversationId,
      agent.siteId,
    );
    const visitor = await this.visitorsService.findByIdForSite(
      conversation.visitorId,
      agent.siteId,
    );
    const site = await this.sitesService.findById(agent.siteId);
    const context = await this.wordPressService.fetchCustomerContext(site, visitor);

    return (
      context ?? {
        found: false,
        customerName: null,
        totalSpent: 0,
        currency: 'IRR',
        lastOrderStatus: null,
        lastOrderDate: null,
        recentOrders: [],
        currentCart: null,
      }
    );
  }
}
