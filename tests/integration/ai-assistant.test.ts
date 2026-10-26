import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from 'pg';
import { DEFAULT_AI_POLICY } from '@mira/shared-types';
import {
  cleanup,
  connect,
  createConversation,
  createSite,
  createVisitor,
  hasDatabase,
} from './helpers';

const model = vi.hoisted(() => vi.fn());
const events = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const embedding = vi.hoisted(() => vi.fn());
const siteContext = vi.hoisted(() => vi.fn());
vi.mock('../../apps/worker/src/ai/chat', () => ({ chatCompletion: model }));
vi.mock('../../apps/worker/src/ai/embeddings', () => ({ embedTexts: embedding }));
vi.mock('../../apps/worker/src/redis-bridge', () => ({ publishSocketEvent: events }));
vi.mock('../../apps/worker/src/ai/site-context', () => ({ getSiteContext: siteContext }));
import { processBotReply } from '../../apps/worker/src/jobs/bot-reply';
import { pool } from '../../apps/worker/src/db';

describe.skipIf(!hasDatabase)('AI assistant with real Postgres', () => {
  let db: Client;
  const sites: string[] = [];
  let siteId: string;
  let conversationId: string;
  let visitorMessageId: string;
  const reply = () =>
    JSON.stringify({
      confidence: 0.95,
      answer: 'ارسال سفارش دو روز زمان می‌برد.',
      productIds: [],
      sourceIds: ['server:approved'],
    });
  const job = () => ({ siteId, conversationId, visitorMessageId });
  const messages = async () =>
    (
      await db.query(
        `SELECT * FROM messages WHERE "siteId" = $1 AND "conversationId" = $2 AND "senderType" = 'bot'`,
        [siteId, conversationId],
      )
    ).rows;

  beforeAll(async () => {
    db = await connect();
  });
  beforeEach(async () => {
    model.mockReset().mockResolvedValue(reply());
    events.mockClear();
    siteContext.mockReset();
    embedding.mockReset();
    siteId = await createSite(db, 'AI integration', `ai-${crypto.randomUUID()}`);
    sites.push(siteId);
    conversationId = await createConversation(db, siteId, await createVisitor(db, siteId));
    visitorMessageId = (
      await db.query(
        `INSERT INTO messages ("siteId", "conversationId", "senderType", content) VALUES ($1, $2, 'visitor', 'شرایط ارسال چیست؟') RETURNING id`,
        [siteId, conversationId],
      )
    ).rows[0].id;
    await db.query(`UPDATE sites SET "aiPolicy" = $2 WHERE id = $1`, [
      siteId,
      {
        ...DEFAULT_AI_POLICY,
        useKnowledgeBase: false,
        serverContext: 'ارسال سفارش دو روز زمان می‌برد.',
      },
    ]);
  });
  afterAll(async () => {
    await cleanup(db, sites);
    await db.end();
    await pool.end();
  });

  it('persists a grounded answer and only public source metadata', async () => {
    await processBotReply(job());
    const rows = await messages();
    expect(rows).toHaveLength(1);
    expect(rows[0].aiMetadata.sources).toEqual([
      { id: 'server:approved', title: 'اطلاعات تأییدشده فروشگاه' },
    ]);
    expect(
      events.mock.calls.filter((call) => call[1] === 'ai:status').map((call) => call[2].stage),
    ).toEqual(['retrieving', 'thinking', 'idle']);
  });
  it('keeps two stores names and approved context separate', async () => {
    await db.query('UPDATE sites SET name = $2 WHERE id = $1', [siteId, 'فروشگاه آبی']);
    const other = await createSite(db, 'فروشگاه سبز', crypto.randomUUID());
    sites.push(other);
    const otherConversation = await createConversation(db, other, await createVisitor(db, other));
    const otherMessage = (
      await db.query(
        `INSERT INTO messages ("siteId", "conversationId", "senderType", content) VALUES ($1, $2, 'visitor', 'شرایط ارسال چیست؟') RETURNING id`,
        [other, otherConversation],
      )
    ).rows[0].id;
    await db.query(`UPDATE sites SET "aiPolicy" = $2 WHERE id = $1`, [
      other,
      {
        ...DEFAULT_AI_POLICY,
        useKnowledgeBase: false,
        serverContext: 'ارسال هفت روز زمان می‌برد.',
      },
    ]);
    model.mockImplementation(async (turns) => {
      const context = JSON.parse(turns[1].content);
      return JSON.stringify({
        confidence: 0.95,
        answer: `${context.storeName}: ${context.sources[0].content}`,
        productIds: [],
        sourceIds: ['server:approved'],
      });
    });
    await processBotReply(job());
    await processBotReply({
      siteId: other,
      conversationId: otherConversation,
      visitorMessageId: otherMessage,
    });
    const [first, second] = model.mock.calls.map((call) => call[0]);
    expect(first[0].content).toContain('فروشگاه آبی');
    expect(first[0].content).not.toContain('فروشگاه سبز');
    expect(second[0].content).toContain('فروشگاه سبز');
    expect(JSON.parse(second[1].content).sources[0].content).toContain('هفت روز');
    expect((await messages())[0].content).toContain('فروشگاه آبی');
    expect((await messages())[0].content).not.toContain('هفت روز');
    const otherReply = (
      await db.query(
        `SELECT content FROM messages WHERE "siteId" = $1 AND "conversationId" = $2 AND "senderType" = 'bot'`,
        [other, otherConversation],
      )
    ).rows[0];
    expect(otherReply.content).toContain('فروشگاه سبز');
    expect(otherReply.content).not.toContain('فروشگاه آبی');
  });
  it('serializes duplicate jobs without a second model call or message', async () => {
    await Promise.all([processBotReply(job()), processBotReply(job())]);
    expect(await messages()).toHaveLength(1);
    expect(model).toHaveBeenCalledTimes(1);
  });
  it('greets without sources, model calls or pausing the assistant', async () => {
    await db.query(
      `UPDATE sites SET "aiPolicy"=$2,"aiGreetingMessage"='سلام، به فروشگاه خوش آمدید.' WHERE id=$1`,
      [siteId, { ...DEFAULT_AI_POLICY, useKnowledgeBase: false }],
    );
    await db.query(`UPDATE messages SET content='سلام وقت بخیر' WHERE id=$1 AND "siteId"=$2`, [
      visitorMessageId,
      siteId,
    ]);
    await processBotReply(job());
    expect(model).not.toHaveBeenCalled();
    expect(embedding).not.toHaveBeenCalled();
    expect(siteContext).not.toHaveBeenCalled();
    expect(await messages()).toHaveLength(1);
    expect((await messages())[0].content).toBe('سلام، به فروشگاه خوش آمدید.');
    expect((await messages())[0].aiMetadata.handoff).not.toBe(true);
    expect(
      (
        await db.query('SELECT "aiPaused" FROM conversations WHERE id=$1 AND "siteId"=$2', [
          conversationId,
          siteId,
        ])
      ).rows[0].aiPaused,
    ).toBe(false);
  });
  it('rejects a conversation or message from another tenant', async () => {
    const foreign = await createSite(db, 'Other', `other-${crypto.randomUUID()}`);
    sites.push(foreign);
    await processBotReply({ ...job(), siteId: foreign });
    expect(model).not.toHaveBeenCalled();
    expect(await messages()).toHaveLength(0);
  });
  it('hands off permanently on human request', async () => {
    await db.query(`UPDATE messages SET content = 'اپراتور' WHERE id = $1`, [visitorMessageId]);
    await processBotReply(job());
    visitorMessageId = (
      await db.query(
        `INSERT INTO messages ("siteId", "conversationId", "senderType", content) VALUES ($1, $2, 'visitor', 'سلام') RETURNING id`,
        [siteId, conversationId],
      )
    ).rows[0].id;
    await processBotReply(job());
    expect(await messages()).toHaveLength(1);
    expect(model).not.toHaveBeenCalled();
    expect((await messages())[0].aiMetadata.handoff).toBe(true);
    expect(
      (await db.query(`SELECT "aiPaused" FROM conversations WHERE id = $1`, [conversationId]))
        .rows[0].aiPaused,
    ).toBe(true);
  });
  it('does not answer during business hours when restricted', async () => {
    await db.query(`UPDATE sites SET "aiReplyOnlyOutsideBusinessHours" = true WHERE id = $1`, [
      siteId,
    ]);
    await processBotReply(job());
    expect(model).not.toHaveBeenCalled();
    expect(await messages()).toHaveLength(0);
  });
  it('fails closed and clears thinking on provider errors', async () => {
    model.mockRejectedValueOnce(new Error('provider failed'));
    await processBotReply(job());
    expect((await messages())[0].aiMetadata.handoff).toBe(true);
    expect(events.mock.calls.at(-1)?.[2].stage).toBe('idle');
  });
  it('does not post if the conversation is resolved while generating', async () => {
    model.mockImplementationOnce(async () => {
      await db.query(
        `UPDATE conversations SET status = 'resolved' WHERE id = $1 AND "siteId" = $2`,
        [conversationId, siteId],
      );
      return reply();
    });
    await processBotReply(job());
    expect(await messages()).toHaveLength(0);
  });
  it('does not post after a newer visitor message arrives', async () => {
    model.mockImplementationOnce(async () => {
      await db.query(
        `INSERT INTO messages ("siteId", "conversationId", "senderType", content) VALUES ($1, $2, 'visitor', 'پرسش جدید')`,
        [siteId, conversationId],
      );
      return reply();
    });
    await processBotReply(job());
    expect(await messages()).toHaveLength(0);
  });
  it('respects disabling AI during generation', async () => {
    model.mockImplementationOnce(async () => {
      await db.query(`UPDATE sites SET "aiEnabled" = false WHERE id = $1`, [siteId]);
      return reply();
    });
    await processBotReply(job());
    expect(await messages()).toHaveLength(0);
  });
  it('hands off on missing evidence without a model call', async () => {
    await db.query(`UPDATE sites SET "aiPolicy" = $2 WHERE id = $1`, [
      siteId,
      { ...DEFAULT_AI_POLICY, useKnowledgeBase: false },
    ]);
    await processBotReply(job());
    expect(model).not.toHaveBeenCalled();
    expect((await messages())[0].aiMetadata.handoff).toBe(true);
  });
  it('enforces reply limits before calling the provider', async () => {
    await db.query(`UPDATE sites SET "aiMaxRepliesPerConversation" = 1 WHERE id = $1`, [siteId]);
    await db.query(
      `INSERT INTO messages ("siteId", "conversationId", "senderType", content) VALUES ($1, $2, 'bot', 'قبلی')`,
      [siteId, conversationId],
    );
    await processBotReply(job());
    expect(model).not.toHaveBeenCalled();
    expect((await messages()).some((m) => m.aiMetadata?.handoff)).toBe(true);
  });

  it('persists only validated live product cards', async () => {
    const product = {
      id: 'product:1',
      name: 'کابل',
      url: 'https://shop.test/cable',
      imageUrl: null,
      price: '125000',
      currency: 'IRT',
      inStock: true,
    };
    siteContext.mockResolvedValueOnce({ products: [product], documents: [] });
    await db.query(
      `UPDATE sites SET "wordpressSiteUrl" = 'https://shop.test', "wordpressApiKey" = 'fixture-only', "aiPolicy" = $2 WHERE id = $1`,
      [siteId, { ...DEFAULT_AI_POLICY, useKnowledgeBase: false, useProducts: true }],
    );
    model.mockResolvedValueOnce(
      JSON.stringify({
        confidence: 0.9,
        answer: 'این کابل را بررسی کنید.',
        productIds: ['product:1'],
        sourceIds: [],
      }),
    );
    await processBotReply(job());
    expect((await messages())[0].aiMetadata.products).toEqual([product]);
  });

  it.each([true, false])(
    'retrieves enabled ready knowledge and counts its use with visible citations=%s',
    async (showSources) => {
      const vector = (axis: number) =>
        `[${Array.from({ length: 768 }, (_, i) => (i === axis ? 1 : 0)).join(',')}]`;
      const otherSite = await createSite(db, 'Other knowledge', `kb-${crypto.randomUUID()}`);
      sites.push(otherSite);
      const chunkIds: string[] = [];
      for (const [owner, title, axis, state] of [
        [siteId, 'مرتبط', 0, 'ready'],
        [siteId, 'نامرتبط', 1, 'ready'],
        [otherSite, 'خصوصی سایت دیگر', 0, 'ready'],
        [siteId, 'هنوز آماده نیست', 0, 'pending'],
        [siteId, 'غیرفعال', 0, 'ready'],
      ] as const) {
        const doc = (
          await db.query(
            `INSERT INTO knowledge_base_documents ("siteId", title, content, status) VALUES ($1, $2, 'راهنمای ارسال', $3) RETURNING id`,
            [owner, title, state],
          )
        ).rows[0].id;
        if (title === 'غیرفعال')
          await db.query(
            `UPDATE knowledge_base_documents SET enabled=false WHERE id=$1 AND "siteId"=$2`,
            [doc, owner],
          );
        chunkIds.push(
          (
            await db.query(
              `INSERT INTO knowledge_base_chunks ("siteId", "documentId", content, embedding) VALUES ($1, $2, 'راهنمای ارسال', $3::vector) RETURNING id`,
              [owner, doc, vector(axis)],
            )
          ).rows[0].id,
        );
      }
      embedding.mockResolvedValueOnce([JSON.parse(vector(0))]);
      await db.query(`UPDATE sites SET "aiPolicy" = $2 WHERE id = $1`, [
        siteId,
        { ...DEFAULT_AI_POLICY, minSimilarity: 0.5, showSources },
      ]);
      model.mockResolvedValueOnce(
        JSON.stringify({
          confidence: 0.9,
          answer: 'راهنمای ارسال را بررسی کردم.',
          productIds: [],
          sourceIds: [`kb:${chunkIds[0]}`],
        }),
      );
      await processBotReply(job());
      const context = JSON.parse(model.mock.calls[0][0][1].content);
      expect(context.sources.map((s: { title: string }) => s.title)).toEqual(['مرتبط']);
      if (showSources)
        expect((await messages())[0].aiMetadata.sources[0].id).toBe(`kb:${chunkIds[0]}`);
      else expect((await messages())[0].aiMetadata.sources).toEqual([]);
      await processBotReply(job());
      const stats = await db.query(
        `SELECT d."usageCount",d."lastUsedAt" FROM knowledge_base_documents d JOIN knowledge_base_chunks c ON c."documentId"=d.id AND c."siteId"=d."siteId" WHERE c.id=$1 AND d."siteId"=$2`,
        [chunkIds[0], siteId],
      );
      expect(stats.rows[0].usageCount).toBe(1);
      expect(stats.rows[0].lastUsedAt).not.toBeNull();
    },
  );

  it('hands off instead of posting knowledge disabled during generation', async () => {
    const vector = [1, ...Array(767).fill(0)];
    const document = (
      await db.query(
        `INSERT INTO knowledge_base_documents ("siteId",title,content,status) VALUES ($1,'آزمون توقف منبع','ارسال دو روز کاری','ready') RETURNING id`,
        [siteId],
      )
    ).rows[0].id;
    const chunk = (
      await db.query(
        `INSERT INTO knowledge_base_chunks ("siteId","documentId",content,embedding) VALUES ($1,$2,'ارسال دو روز کاری',$3::vector) RETURNING id`,
        [siteId, document, JSON.stringify(vector)],
      )
    ).rows[0].id;
    await db.query(`UPDATE sites SET "aiPolicy"=$2 WHERE id=$1`, [
      siteId,
      { ...DEFAULT_AI_POLICY },
    ]);
    embedding.mockResolvedValueOnce([vector]);
    model.mockImplementationOnce(async () => {
      await db.query(
        `UPDATE knowledge_base_documents SET enabled=false WHERE id=$1 AND "siteId"=$2`,
        [document, siteId],
      );
      return JSON.stringify({
        confidence: 0.95,
        answer: 'ارسال دو روز کاری',
        productIds: [],
        sourceIds: [`kb:${chunk}`],
      });
    });
    await processBotReply(job());
    const rows = await messages();
    expect(rows).toHaveLength(1);
    expect(rows[0].aiMetadata.handoff).toBe(true);
    expect(rows[0].aiMetadata.sources).toEqual([]);
    expect(
      (
        await db.query(
          `SELECT "usageCount" FROM knowledge_base_documents WHERE id=$1 AND "siteId"=$2`,
          [document, siteId],
        )
      ).rows[0].usageCount,
    ).toBe(0);
  });

  it('disables configured topics and confidence thresholds only when the store switch is off', async () => {
    await db.query(`UPDATE sites SET "aiPolicy"=$2 WHERE id=$1`, [
      siteId,
      {
        ...DEFAULT_AI_POLICY,
        useKnowledgeBase: false,
        serverContext: 'ارسال سفارش دو روز زمان می‌برد.',
        blockedTopics: ['ارسال'],
        guardrailsEnabled: false,
      },
    ]);
    model.mockResolvedValueOnce(JSON.stringify({ ...JSON.parse(reply()), confidence: 0.1 }));
    await processBotReply(job());
    expect(model).toHaveBeenCalledTimes(1);
    expect((await messages())[0].aiMetadata.handoff).not.toBe(true);
  });

  it('does not post after an agent takes ownership during generation', async () => {
    const agent = (
      await db.query(
        `INSERT INTO agents ("siteId", email, "passwordHash", "fullName") VALUES ($1, $2, 'fixture-only', 'آزمون') RETURNING id`,
        [siteId, `${crypto.randomUUID()}@fixture.test`],
      )
    ).rows[0].id;
    model.mockImplementationOnce(async () => {
      await db.query(
        `UPDATE conversations SET "assignedAgentId" = $3 WHERE id = $1 AND "siteId" = $2`,
        [conversationId, siteId, agent],
      );
      return reply();
    });
    await processBotReply(job());
    expect(await messages()).toHaveLength(0);
  });
});
