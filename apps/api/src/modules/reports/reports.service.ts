import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AgentPerformanceDto, ReportsOverviewDto } from '@mira/shared-types';

export interface DateRange {
  from: Date;
  to: Date;
}

const DEFAULT_RANGE_DAYS = 30;

@Injectable()
export class ReportsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  resolveRange(from?: string, to?: string): DateRange {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from
      ? new Date(from)
      : new Date(toDate.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
    return { from: fromDate, to: toDate };
  }

  async getOverview(siteId: string, range: DateRange): Promise<ReportsOverviewDto> {
    const dailyRows: { day: string; count: string }[] = await this.dataSource.query(
      `SELECT to_char("createdAt", 'YYYY-MM-DD') as day, COUNT(*)::int as count
       FROM conversations
       WHERE "siteId" = $1 AND "createdAt" >= $2 AND "createdAt" < $3
       GROUP BY day
       ORDER BY day`,
      [siteId, range.from, range.to],
    );

    const [firstResponseRow] = await this.dataSource.query(
      `WITH first_msgs AS (
         SELECT m."conversationId",
           MIN(m."createdAt") FILTER (WHERE m."senderType" != 'agent') AS first_visitor_at,
           MIN(m."createdAt") FILTER (WHERE m."senderType" = 'agent') AS first_agent_at
         FROM messages m
         JOIN conversations c ON c.id = m."conversationId"
         WHERE c."siteId" = $1 AND c."createdAt" >= $2 AND c."createdAt" < $3
         GROUP BY m."conversationId"
       )
       SELECT AVG(EXTRACT(EPOCH FROM (first_agent_at - first_visitor_at)) / 60)::float AS avg_minutes
       FROM first_msgs
       WHERE first_agent_at IS NOT NULL AND first_visitor_at IS NOT NULL AND first_agent_at > first_visitor_at`,
      [siteId, range.from, range.to],
    );

    const [csatRow] = await this.dataSource.query(
      `SELECT
         AVG(score)::float AS average,
         COUNT(*)::int AS total,
         (COUNT(*) FILTER (WHERE score >= 4) * 100.0 / NULLIF(COUNT(*), 0))::float AS positive_percent
       FROM csat_ratings
       WHERE "siteId" = $1 AND "createdAt" >= $2 AND "createdAt" < $3`,
      [siteId, range.from, range.to],
    );

    const dailyCounts = dailyRows.map((row) => ({ date: row.day, count: Number(row.count) }));

    return {
      totalConversations: dailyCounts.reduce((sum, row) => sum + row.count, 0),
      dailyCounts,
      avgFirstResponseMinutes: firstResponseRow?.avg_minutes ?? null,
      csat: {
        average: csatRow?.average ?? null,
        totalRatings: Number(csatRow?.total ?? 0),
        positivePercent: csatRow?.positive_percent ?? null,
      },
    };
  }

  async getAgentPerformance(siteId: string, range: DateRange): Promise<AgentPerformanceDto[]> {
    const rows = await this.dataSource.query(
      `WITH first_msgs AS (
         SELECT m."conversationId",
           MIN(m."createdAt") FILTER (WHERE m."senderType" != 'agent') AS first_visitor_at,
           MIN(m."createdAt") FILTER (WHERE m."senderType" = 'agent') AS first_agent_at
         FROM messages m
         GROUP BY m."conversationId"
       ),
       conv_in_range AS (
         SELECT c.id, c."assignedAgentId"
         FROM conversations c
         WHERE c."siteId" = $1 AND c."createdAt" >= $2 AND c."createdAt" < $3
           AND c."assignedAgentId" IS NOT NULL
       )
       SELECT
         a.id AS "agentId",
         a."fullName" AS "agentName",
         COUNT(DISTINCT cr.id)::int AS "conversationsHandled",
         AVG(EXTRACT(EPOCH FROM (fm.first_agent_at - fm.first_visitor_at)) / 60) FILTER (
           WHERE fm.first_agent_at IS NOT NULL AND fm.first_visitor_at IS NOT NULL
             AND fm.first_agent_at > fm.first_visitor_at
         )::float AS "avgFirstResponseMinutes",
         AVG(csat.score)::float AS "avgCsatScore"
       FROM agents a
       LEFT JOIN conv_in_range cr ON cr."assignedAgentId" = a.id
       LEFT JOIN first_msgs fm ON fm."conversationId" = cr.id
       LEFT JOIN csat_ratings csat ON csat."conversationId" = cr.id
       WHERE a."siteId" = $1
       GROUP BY a.id, a."fullName"
       ORDER BY "conversationsHandled" DESC`,
      [siteId, range.from, range.to],
    );

    return rows.map((row: AgentPerformanceDto) => ({
      agentId: row.agentId,
      agentName: row.agentName,
      conversationsHandled: Number(row.conversationsHandled),
      avgFirstResponseMinutes: row.avgFirstResponseMinutes,
      avgCsatScore: row.avgCsatScore,
    }));
  }

  async exportAgentPerformanceCsv(siteId: string, range: DateRange): Promise<string> {
    const rows = await this.getAgentPerformance(siteId, range);
    const header = 'اپراتور,تعداد گفتگوی رسیدگی‌شده,میانگین زمان اولین پاسخ (دقیقه),میانگین امتیاز CSAT';
    const lines = rows.map((row) =>
      [
        csvEscape(row.agentName),
        row.conversationsHandled,
        row.avgFirstResponseMinutes !== null ? row.avgFirstResponseMinutes.toFixed(1) : '',
        row.avgCsatScore !== null ? row.avgCsatScore.toFixed(2) : '',
      ].join(','),
    );
    // BOM برای اینکه اکسل فارسی رو درست UTF-8 تشخیص بده
    return '﻿' + [header, ...lines].join('\r\n');
  }
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
