import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { VisitorListItemDto, VisitorProfileDto, VisitorStatsDto } from '@mira/shared-types';
import { parseUserAgent } from '../../common/user-agent/parse-user-agent.util';

// «آنلاین» یعنی در این بازه فعالیتی داشته — ویجت با هر page-view و هر پیام lastSeenAt را تازه می‌کند
const ONLINE_WINDOW_MINUTES = 5;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Injectable()
export class VisitorsDirectoryService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getStats(siteId: string): Promise<VisitorStatsDto> {
    const [row] = await this.dataSource.query(
      `SELECT
         COUNT(*) FILTER (WHERE "lastSeenAt" > now() - ($2 || ' minutes')::interval)::int AS "onlineNow",
         COUNT(*) FILTER (WHERE "lastSeenAt" >= date_trunc('day', now()))::int AS "seenToday",
         COUNT(*)::int AS "totalVisitors"
       FROM visitors WHERE "siteId" = $1`,
      [siteId, String(ONLINE_WINDOW_MINUTES)],
    );
    return {
      onlineNow: row?.onlineNow ?? 0,
      seenToday: row?.seenToday ?? 0,
      totalVisitors: row?.totalVisitors ?? 0,
    };
  }

  async list(
    siteId: string,
    options: { onlineOnly?: boolean; search?: string; limit?: number },
  ): Promise<VisitorListItemDto[]> {
    const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const params: unknown[] = [siteId, String(ONLINE_WINDOW_MINUTES)];
    const filters: string[] = [];

    if (options.onlineOnly) {
      filters.push(`v."lastSeenAt" > now() - ($2 || ' minutes')::interval`);
    }
    if (options.search) {
      params.push(`%${options.search}%`);
      filters.push(
        `(v.name ILIKE $${params.length} OR v.email ILIKE $${params.length} OR v."visitorRef" ILIKE $${params.length})`,
      );
    }
    params.push(limit);

    // آخرین صفحه‌ی بازدیدشده با LATERAL گرفته می‌شود تا به‌ازای هر بازدیدکننده فقط یک ردیف
    // برگردد (نه fan-out روی همه‌ی page-viewها که تعداد را خراب می‌کرد)
    const rows = await this.dataSource.query(
      `SELECT
         v.id, v."visitorRef", v.name, v.email, v."firstSeenAt", v."lastSeenAt",
         (v."lastSeenAt" > now() - ($2 || ' minutes')::interval) AS "isOnline",
         (SELECT COUNT(*) FROM conversations c WHERE c."visitorId" = v.id AND c."siteId"=$1)::int AS "conversationCount",
         lastc.id AS "latestConversationId", lastc."entryPage",
         lastpv."visitedAt" AS "currentPageVisitedAt",
         lastpv.url AS "currentPageUrl",
         lastpv.title AS "currentPageTitle"
       FROM visitors v
       LEFT JOIN LATERAL (
         SELECT pv.url, pv.title, pv."visitedAt" FROM visitor_page_views pv
         WHERE pv."visitorId" = v.id AND pv."siteId"=$1 ORDER BY pv."visitedAt" DESC LIMIT 1
       ) lastpv ON true
       LEFT JOIN LATERAL (
         SELECT c.id,c."entryPage" FROM conversations c WHERE c."visitorId"=v.id AND c."siteId"=$1 ORDER BY c."createdAt" DESC LIMIT 1
       ) lastc ON true
       WHERE v."siteId" = $1 ${filters.length ? 'AND ' + filters.join(' AND ') : ''}
       ORDER BY v."lastSeenAt" DESC
       LIMIT $${params.length}`,
      params,
    );

    return rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      visitorRef: row.visitorRef as string,
      name: row.name as string | null,
      email: row.email as string | null,
      firstSeenAt: (row.firstSeenAt as Date).toISOString(),
      lastSeenAt: (row.lastSeenAt as Date).toISOString(),
      isOnline: row.isOnline as boolean,
      conversationCount: row.conversationCount as number,
      currentPageUrl: (row.currentPageUrl as string | null) ?? null,
      currentPageTitle: (row.currentPageTitle as string | null) ?? null,
      currentPageVisitedAt: row.currentPageVisitedAt
        ? (row.currentPageVisitedAt as Date).toISOString()
        : null,
      latestConversationId: (row.latestConversationId as string | null) ?? null,
      entryPage: (row.entryPage as VisitorListItemDto['entryPage']) ?? null,
    }));
  }

  // حذف کامل داده‌ی یک بازدیدکننده برای درخواست‌های حریم خصوصی (فاز ۷).
  // مکالمات/پیام‌ها/CSAT/page-viewها همگی با ON DELETE CASCADE پاک می‌شوند، پس یک DELETE کافی است.
  async deleteVisitorData(siteId: string, visitorId: string): Promise<{ deleted: boolean }> {
    const result = await this.dataSource.query(
      `DELETE FROM visitors WHERE id = $1 AND "siteId" = $2 RETURNING id`,
      [visitorId, siteId],
    );
    if (result.length === 0) {
      throw new NotFoundException('بازدیدکننده پیدا نشد');
    }
    return { deleted: true };
  }

  async getProfile(siteId: string, visitorId: string): Promise<VisitorProfileDto> {
    const [visitor] = await this.dataSource.query(
      `SELECT id, "visitorRef", name, email, "userAgent", "firstSeenAt", "lastSeenAt",
              ("lastSeenAt" > now() - ($3 || ' minutes')::interval) AS "isOnline"
       FROM visitors WHERE id = $1 AND "siteId" = $2`,
      [visitorId, siteId, String(ONLINE_WINDOW_MINUTES)],
    );
    if (!visitor) {
      throw new NotFoundException('بازدیدکننده پیدا نشد');
    }

    const conversations = await this.dataSource.query(
      `SELECT c.id, c.status, c.department, c.priority, c."createdAt", c."resolvedAt", c."entryPage",
              (SELECT COUNT(*) FROM messages m WHERE m."conversationId" = c.id AND m."siteId"=$2)::int AS "messageCount",
              cs.score AS "csatScore"
       FROM conversations c
       LEFT JOIN csat_ratings cs ON cs."conversationId" = c.id AND cs."siteId"=$2
       WHERE c."visitorId" = $1 AND c."siteId"=$2
       ORDER BY c."createdAt" DESC`,
      [visitorId, siteId],
    );

    const pageViews = await this.dataSource.query(
      `SELECT url, title, "visitedAt" FROM visitor_page_views
       WHERE "visitorId" = $1 AND "siteId"=$2 ORDER BY "visitedAt" DESC LIMIT 50`,
      [visitorId, siteId],
    );

    const { browser, os, deviceType } = parseUserAgent(visitor.userAgent);

    return {
      id: visitor.id,
      visitorRef: visitor.visitorRef,
      name: visitor.name,
      email: visitor.email,
      userAgent: visitor.userAgent,
      browser,
      os,
      deviceType,
      firstSeenAt: visitor.firstSeenAt.toISOString(),
      lastSeenAt: visitor.lastSeenAt.toISOString(),
      isOnline: visitor.isOnline,
      conversations: conversations.map((row: Record<string, unknown>) => ({
        entryPage: (row.entryPage as VisitorListItemDto['entryPage']) ?? null,
        id: row.id as string,
        status: row.status as string,
        department: row.department as string | null,
        priority: row.priority as string,
        createdAt: (row.createdAt as Date).toISOString(),
        resolvedAt: row.resolvedAt ? (row.resolvedAt as Date).toISOString() : null,
        messageCount: row.messageCount as number,
        csatScore: (row.csatScore as number | null) ?? null,
      })),
      pageViews: pageViews.map((row: Record<string, unknown>) => ({
        url: row.url as string,
        title: (row.title as string | null) ?? null,
        visitedAt: (row.visitedAt as Date).toISOString(),
      })),
    };
  }
}
