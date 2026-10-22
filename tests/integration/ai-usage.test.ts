import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import type { DataSource } from 'typeorm';
import { UsageService } from '../../apps/api/src/modules/billing/usage.service';
import { recordAiUsage } from '../../apps/worker/src/ai/usage';
import { pool } from '../../apps/worker/src/db';
import {
  cleanup,
  connect,
  createConversation,
  createSite,
  createVisitor,
  hasDatabase,
} from './helpers';

describe.skipIf(!hasDatabase)('AI usage with real Postgres', () => {
  let db: Client;
  let siteId: string;
  let otherSite: string;
  let adminId: string;
  let conversationId: string;
  let service: UsageService;
  beforeAll(async () => {
    db = await connect();
    siteId = await createSite(db, 'Usage fixture', crypto.randomUUID());
    otherSite = await createSite(db, 'Other fixture', crypto.randomUUID());
    conversationId = await createConversation(db, siteId, await createVisitor(db, siteId));
    adminId = (
      await db.query(
        `INSERT INTO agents ("siteId", "fullName", email, "passwordHash", role) VALUES ($1, 'Fixture', $2, 'fixture', 'admin') RETURNING id`,
        [siteId, `${crypto.randomUUID()}@test.invalid`],
      )
    ).rows[0].id;
    service = new UsageService({
      query: async (sql: string, values: unknown[]) => (await db.query(sql, values)).rows,
    } as unknown as DataSource);
  });
  afterAll(async () => {
    await cleanup(db, [siteId, otherSite]);
    await db.end();
    await pool.end();
  });

  it('records usage, deduplicates request IDs and rejects foreign tenant references', async () => {
    const context = { siteId, conversationId, kind: 'reply' as const };
    const usage = {
      model: 'fixture',
      provider: 'avalai',
      status: 'success' as const,
      inputTokens: 100,
      outputTokens: 40,
      totalTokens: 140,
      requestId: crypto.randomUUID(),
    };
    await recordAiUsage(context, usage);
    await recordAiUsage(context, usage);
    await recordAiUsage({ ...context, siteId: otherSite }, usage);
    const report = await service.report(siteId, adminId, 7);
    expect(report.requests).toBe(1);
    expect(report.users).toBe(1);
    expect(report.totalTokens).toBe(140);
    expect(report.averageTokensPerUser).toBe(140);
    expect(report.pendingCosts).toBe(1);
    expect(report.recordedCostUsd).toBeNull();
    expect(report.visitors[0].inputTokens).toBe(100);
    expect(
      (await db.query(`SELECT count(*)::int AS n FROM ai_usage WHERE "siteId" = $1`, [otherSite]))
        .rows[0].n,
    ).toBe(0);
  });
  it('separates system usage, old records, unknown usage and final charges', async () => {
    await db.query(`DELETE FROM ai_usage WHERE "siteId" = $1`, [siteId]);
    const record = {
      model: 'fixture',
      provider: 'avalai',
      status: 'success' as const,
      totalTokens: 200,
    };
    await recordAiUsage({ siteId, conversationId, kind: 'reply' }, record);
    await recordAiUsage({ siteId, kind: 'document' }, { ...record, totalTokens: 300 });
    await recordAiUsage(
      { siteId, conversationId, kind: 'retrieval' },
      { ...record, totalTokens: undefined },
    );
    await recordAiUsage(
      { siteId, conversationId, kind: 'reply' },
      { ...record, status: 'failed', totalTokens: undefined },
    );
    await db.query(
      `UPDATE ai_usage SET "costUsd" = 0.001 WHERE "siteId" = $1 AND "totalTokens" = 200`,
      [siteId],
    );
    await db.query(
      `INSERT INTO ai_usage ("siteId", kind, model, provider, status, "totalTokens", "createdAt") VALUES ($1, 'document', 'old', 'avalai', 'success', 1000, now() - interval '8 days')`,
      [siteId],
    );
    const report = await service.report(siteId, adminId, 7);
    expect(report.requests).toBe(4);
    expect(report.failedRequests).toBe(1);
    expect(report.totalTokens).toBe(500);
    expect(report.userTokens).toBe(200);
    expect(report.unknownRequests).toBe(1);
    expect(report.averageTokensPerUser).toBeNull();
    expect(report.recordedCostUsd).toBeCloseTo(0.001);
    expect(report.pendingCosts).toBe(2);
    expect((await service.report(siteId, adminId, 30)).requests).toBe(5);
  });
  it('enforces fresh admin access and tenant scope', async () => {
    await expect(service.report(otherSite, adminId, 7)).rejects.toMatchObject({ status: 403 });
    await db.query(`UPDATE agents SET role = 'agent' WHERE id = $1 AND "siteId" = $2`, [
      adminId,
      siteId,
    ]);
    await expect(service.report(siteId, adminId, 7)).rejects.toMatchObject({ status: 403 });
  });
});
