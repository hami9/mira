import 'reflect-metadata';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { DataSource } from 'typeorm';
import type { Client } from 'pg';
import * as entities from '../../apps/api/src/database/entities';
import { KnowledgeBaseService } from '../../apps/api/src/modules/knowledge-base/knowledge-base.service';
import type { AiQueueService } from '../../apps/api/src/common/queue/ai-queue.service';
import { connect, createSite, cleanup, hasDatabase, TEST_DATABASE_URL } from './helpers';

const embedding = vi.hoisted(() => vi.fn());
vi.mock('../../apps/worker/src/ai/embeddings', () => ({ embedTexts: embedding }));
import { processEmbedDocument } from '../../apps/worker/src/jobs/embed-document';
import { pool } from '../../apps/worker/src/db';

describe.skipIf(!hasDatabase)('knowledge source controls', () => {
  let db: Client;
  let source: DataSource;
  let site: string;
  let other: string;
  let documentId: string;
  let service: KnowledgeBaseService;
  const enqueue = vi.fn().mockResolvedValue(undefined);
  const vectors = (texts: string[]) => texts.map(() => [1, ...Array(767).fill(0)]);
  beforeAll(async () => {
    db = await connect();
    site = await createSite(db, 'Knowledge controls', crypto.randomUUID());
    other = await createSite(db, 'Other knowledge', crypto.randomUUID());
    source = new DataSource({
      type: 'postgres',
      url: TEST_DATABASE_URL,
      entities: Object.values(entities),
      synchronize: false,
      extra: { max: 3 },
    });
    await source.initialize();
    service = new KnowledgeBaseService(
      source.getRepository(entities.KnowledgeBaseDocumentEntity),
      source.getRepository(entities.KnowledgeBaseChunkEntity),
      { enqueueEmbedDocument: enqueue } as unknown as AiQueueService,
    );
    embedding.mockImplementation(vectors);
  });
  afterAll(async () => {
    if (source?.isInitialized) await source.destroy();
    if (db) {
      await cleanup(db, [site, other].filter(Boolean));
      await db.end();
    }
    await pool.end();
  });
  it('stores Markdown and keywords without embedding disabled sources or returning full text in lists', async () => {
    const document = await service.create(site, {
      title: 'راهنمای ارسال',
      content: '# ارسال\n\nارسال سفارش دو روز کاری زمان می‌برد.',
      sourceType: 'markdown',
      enabled: false,
      keywords: ['ارسال', 'ارسال', ' تحویل '],
    });
    documentId = document.id;
    expect(document.enabled).toBe(false);
    expect(document.keywords).toEqual(['ارسال', 'تحویل']);
    expect(enqueue).not.toHaveBeenCalled();
    const list = await service.listForSite(site);
    expect(list[0].content).toBeUndefined();
    expect(list[0].contentLength).toBeGreaterThan(10);
    expect(list[0].usageCount).toBe(0);
    expect((await service.get(site, documentId)).content).toContain('# ارسال');
  });
  it('activates a source and embeds its keywords and title through the worker', async () => {
    await service.update(site, documentId, { enabled: true });
    expect(enqueue).toHaveBeenCalledTimes(1);
    await processEmbedDocument({ siteId: site, documentId });
    expect(embedding.mock.calls[0][0][0]).toContain('تحویل');
    expect(embedding.mock.calls[0][0][0]).toContain('راهنمای ارسال');
    const document = await service.get(site, documentId);
    expect(document.status).toBe('ready');
    expect(document.chunkCount).toBeGreaterThan(0);
  });
  it('does not let an old embedding overwrite a newer edit', async () => {
    await service.update(site, documentId, { keywords: ['مرجوعی'] });
    embedding.mockImplementationOnce(async (texts: string[]) => {
      await service.update(site, documentId, {
        content: '# مرجوعی\n\nبرای مرجوعی تا هفت روز فرصت دارید.',
        keywords: ['بازگشت کالا'],
      });
      return vectors(texts);
    });
    await processEmbedDocument({ siteId: site, documentId });
    expect((await service.get(site, documentId)).status).toBe('pending');
    await processEmbedDocument({ siteId: site, documentId });
    const document = await service.get(site, documentId);
    expect(document.status).toBe('ready');
    const chunks = await db.query(
      `SELECT content FROM knowledge_base_chunks WHERE "siteId"=$1 AND "documentId"=$2`,
      [site, documentId],
    );
    expect(chunks.rows[0].content).toContain('هفت روز');
  });
  it('records provider failure and permits an explicit retry', async () => {
    await service.reindex(site, documentId);
    embedding.mockRejectedValueOnce(new Error('fixture provider failure'));
    await expect(processEmbedDocument({ siteId: site, documentId })).rejects.toThrow(
      'fixture provider failure',
    );
    expect((await service.get(site, documentId)).status).toBe('failed');
    await service.reindex(site, documentId);
    await processEmbedDocument({ siteId: site, documentId });
    expect((await service.get(site, documentId)).status).toBe('ready');
  });
  it('rejects foreign sources and does no provider work for disabled or outdated jobs', async () => {
    await expect(service.get(other, documentId)).rejects.toThrow();
    await expect(service.update(other, documentId, { enabled: false })).rejects.toThrow();
    await expect(service.delete(other, documentId)).rejects.toThrow();
    await expect(service.reindex(other, documentId)).rejects.toThrow();
    expect(await service.listForSite(other)).toEqual([]);
    embedding.mockClear();
    await processEmbedDocument({ siteId: site, documentId, revision: 0 });
    expect(embedding).not.toHaveBeenCalled();
    await service.update(site, documentId, { enabled: false });
    await processEmbedDocument({ siteId: site, documentId });
    expect(embedding).not.toHaveBeenCalled();
  });
});
