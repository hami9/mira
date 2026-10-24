import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AiUsageReport } from '@mira/shared-types';

@Injectable()
export class UsageService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async report(siteId: string, agentId: string, days: number): Promise<AiUsageReport> {
    const admin = await this.db.query(
      `SELECT id FROM agents WHERE id = $1 AND "siteId" = $2 AND role = 'admin'`,
      [agentId, siteId],
    );
    if (!admin.length) throw new ForbiddenException('گزارش مصرف فقط برای مدیر سایت مجاز است');
    const [totals] = await this.db.query(
      `SELECT count(*)::int AS requests,
      count(*) FILTER (WHERE status = 'failed')::int AS "failedRequests",
      sum("totalTokens")::float AS "totalTokens",
      count(*) FILTER (WHERE status = 'success' AND "totalTokens" IS NULL)::int AS "unknownRequests",
      count(DISTINCT "visitorId")::int AS users,
      sum("totalTokens") FILTER (WHERE "visitorId" IS NOT NULL)::float AS "userTokens",
      CASE WHEN count(*) FILTER (WHERE "visitorId" IS NOT NULL AND status = 'success' AND "totalTokens" IS NULL) = 0
        THEN sum("totalTokens") FILTER (WHERE "visitorId" IS NOT NULL)::float / nullif(count(DISTINCT "visitorId"), 0) END AS "averageTokensPerUser",
      sum("costUsd")::float AS "recordedCostUsd",
      count(*) FILTER (WHERE status = 'success' AND "costUsd" IS NULL)::int AS "pendingCosts"
      FROM ai_usage WHERE "siteId" = $1 AND "createdAt" >= now() - $2 * interval '1 day'`,
      [siteId, days],
    );
    const visitors = await this.db.query(
      `SELECT u."visitorId" AS id, coalesce(v.name, 'بازدیدکننده') AS name,
      count(*)::int AS requests, sum(u."inputTokens")::float AS "inputTokens", sum(u."outputTokens")::float AS "outputTokens",
      sum(u."totalTokens")::float AS "totalTokens", sum(u."costUsd")::float AS "costUsd",
      count(*) FILTER (WHERE u.status = 'success' AND u."costUsd" IS NULL)::int AS "pendingCosts"
      FROM ai_usage u LEFT JOIN visitors v ON v.id = u."visitorId" AND v."siteId" = u."siteId"
      WHERE u."siteId" = $1 AND u."visitorId" IS NOT NULL AND u."createdAt" >= now() - $2 * interval '1 day'
      GROUP BY u."visitorId", v.name ORDER BY sum(u."totalTokens") DESC NULLS LAST, u."visitorId" LIMIT 100`,
      [siteId, days],
    );
    return { ...totals, days, visitors };
  }
}
