import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  VisitorListItemDto,
  VisitorProfileDto,
  VisitorStatsDto,
} from '@mira/shared-types';
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
      filters.push(`(v.name ILIKE $${params.length} OR v.email ILIKE $${params.length} OR v."visitorRef" ILIKE $${params.length})`);
    }
    params.push(limit);

    // آخرین صفحه‌ی بازدیدشده با LATERAL گرفته می‌شود تا به‌ازای هر بازدیدکننده فقط یک ردیف
    // برگردد (نه fan-out روی همه‌ی page-viewها که تعداد را خراب می‌کرد)
    const rows = await this.dataSource.query(
      `SELECT
         v.id, v."visitorRef", v.name, v.email, v."firstSeenAt", v."lastSeenAt",
         (v."lastSeenAt" > now() - ($2 || ' minutes')::interval) AS "isOnline",
         (SELECT COUNT(*) FROM conversations c WHERE c."visitorId" = v.id)::int AS "conversationCount",
         lastpv.url AS "currentPageUrl",
         lastpv.title AS "currentPageTitle"
       FROM visitors v
       LEFT JOIN LATERAL (
         SELECT pv.url, pv.title FROM visitor_page_views pv
         WHERE pv."visitorId" = v.id ORDER BY pv."visitedAt" DESC LIMIT 1
       ) lastpv ON true
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
    }));
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
      `SELECT c.id, c.status, c.department, c.priority, c."createdAt", c."resolvedAt",
              (SELECT COUNT(*) FROM messages m WHERE m."conversationId" = c.id)::int AS "messageCount",
              cs.score AS "csatScore"
       FROM conversations c
       LEFT JOIN csat_ratings cs ON cs."conversationId" = c.id
       WHERE c."visitorId" = $1
       ORDER BY c."createdAt" DESC`,
      [visitorId],
    );

    const pageViews = await this.dataSource.query(
      `SELECT url, title, "visitedAt" FROM visitor_page_views
       WHERE "visitorId" = $1 ORDER BY "visitedAt" DESC LIMIT 50`,
      [visitorId],
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
