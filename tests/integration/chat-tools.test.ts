import 'reflect-metadata';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import * as entities from '../../apps/api/src/database/entities';
import { ChatToolsService } from '../../apps/api/src/modules/chat-tools/chat-tools.service';
import { ModerationService } from '../../apps/api/src/modules/moderation/moderation.service';
import {
  connect,
  cleanup,
  createSite,
  createVisitor,
  createConversation,
  hasDatabase,
  TEST_DATABASE_URL,
} from './helpers';
import type { Client } from 'pg';
describe.skipIf(!hasDatabase)('chat tools with real Postgres', () => {
  let db: Client;
  let source: DataSource;
  let redis: Redis;
  let tools: ChatToolsService;
  let moderation: ModerationService;
  let site: string;
  let foreign: string;
  let agent: string;
  let otherAgent: string;
  let visitor: string;
  let conversation: string;
  beforeAll(async () => {
    db = await connect();
    site = await createSite(db, 'Tools fixture', crypto.randomUUID());
    foreign = await createSite(db, 'Foreign tools', crypto.randomUUID());
    visitor = await createVisitor(db, site);
    conversation = await createConversation(db, site, visitor);
    const add = async (s: string) =>
      (
        await db.query(
          `INSERT INTO agents("siteId",email,"passwordHash","fullName",role) VALUES($1,$2,'fixture','Tools operator','agent') RETURNING id`,
          [s, crypto.randomUUID() + '@tools.test'],
        )
      ).rows[0].id;
    agent = await add(site);
    otherAgent = await add(foreign);
    source = new DataSource({
      type: 'postgres',
      url: TEST_DATABASE_URL,
      entities: Object.values(entities),
      synchronize: false,
      extra: { max: 5 },
    });
    await source.initialize();
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379),
    });
    const events = new EventEmitter2();
    moderation = new ModerationService(source, events, redis);
    tools = new ChatToolsService(source, moderation, events);
  });
  afterAll(async () => {
    await redis?.quit();
    if (source?.isInitialized) await source.destroy();
    if (db) {
      await cleanup(db, [site, foreign].filter(Boolean));
      await db.end();
    }
  });
  it('persists links, validates immutable forms, serializes submissions and rejects restricted or foreign writes', async () => {
    const form = await tools.save(site, agent, {
      title: 'اطلاعات ارسال',
      fields: [{ id: 'email', label: 'ایمیل', type: 'email', required: true }],
    });
    await expect(
      tools.save(site, agent, {
        title: 'بد',
        fields: [{ id: '__proto__', label: 'بد', type: 'text', required: false }],
      }),
    ).rejects.toThrow();
    await expect(
      tools.form(foreign, otherAgent, conversation, {
        templateId: form.id,
        clientMessageId: crypto.randomUUID(),
      }),
    ).rejects.toThrow();
    expect(() =>
      tools.link(site, agent, conversation, {
        url: 'javascript:alert(1)',
        clientMessageId: crypto.randomUUID(),
      }),
    ).toThrow();
    const linkId = crypto.randomUUID();
    const first = await tools.link(site, agent, conversation, {
      url: 'https://store.test/product/item',
      title: 'محصول',
      clientMessageId: linkId,
    });
    expect(
      (
        await tools.link(site, agent, conversation, {
          url: 'https://store.test/other',
          clientMessageId: linkId,
        })
      ).id,
    ).toBe(first.id);
    const request = await tools.form(site, agent, conversation, {
      templateId: form.id,
      clientMessageId: crypto.randomUUID(),
    });
    await tools.save(
      site,
      agent,
      {
        title: 'نسخه تازه',
        fields: [{ id: 'other', label: 'جدید', type: 'text', required: true }],
      },
      form.id,
    );
    await tools.archive(site, agent, form.id);
    expect(await tools.list(site, agent)).toHaveLength(0);
    await expect(
      tools.submit(site, visitor, conversation, request.id, {
        answers: { email: 'bad' },
        clientMessageId: crypto.randomUUID(),
      }),
    ).rejects.toThrow();
    await expect(
      tools.submit(site, visitor, conversation, request.id, {
        answers: { other: 'x' },
        clientMessageId: crypto.randomUUID(),
      }),
    ).rejects.toThrow();
    const submitted = await Promise.all(
      [1, 2].map(() =>
        tools.submit(site, visitor, conversation, request.id, {
          answers: { email: 'valid@example.test' },
          clientMessageId: crypto.randomUUID(),
        }),
      ),
    );
    expect(submitted[0].id).toBe(submitted[1].id);
    expect(submitted[0].content).not.toContain('valid@example.test');
    expect(submitted[0].toolMetadata).toMatchObject({
      kind: 'form-response',
      answers: { email: 'valid@example.test' },
    });
    expect(
      (
        await db.query(`SELECT "toolMetadata" FROM messages WHERE id=$1 AND "siteId"=$2`, [
          request.id,
          site,
        ])
      ).rows[0].toolMetadata,
    ).toMatchObject({ title: 'اطلاعات ارسال', submittedAt: expect.any(String) });
    const next = await tools.save(site, agent, {
      title: 'تازه',
      fields: [{ id: 'name', label: 'نام', type: 'text', required: true }],
    });
    const pending = await tools.form(site, agent, conversation, {
      templateId: next.id,
      clientMessageId: crypto.randomUUID(),
    });
    await moderation.moderate(site, visitor, { action: 'mute', durationMinutes: 15 });
    await expect(
      tools.submit(site, visitor, conversation, pending.id, {
        answers: { name: 'نام' },
        clientMessageId: crypto.randomUUID(),
      }),
    ).rejects.toThrow();
    await moderation.moderate(site, visitor, { action: 'unmute' });
    await moderation.moderate(site, visitor, { action: 'block' });
    await expect(
      tools.submit(site, visitor, conversation, pending.id, {
        answers: { name: 'نام' },
        clientMessageId: crypto.randomUUID(),
      }),
    ).rejects.toThrow();
    await moderation.moderate(site, visitor, { action: 'unblock' });
    await db.query('UPDATE conversations SET "deletedAt"=now() WHERE id=$1 AND "siteId"=$2', [
      conversation,
      site,
    ]);
    await expect(
      tools.submit(site, visitor, conversation, pending.id, {
        answers: { name: 'نام' },
        clientMessageId: crypto.randomUUID(),
      }),
    ).rejects.toThrow();
    expect(
      (
        await db.query(
          `SELECT count(*)::int AS n FROM messages WHERE "siteId"=$1 AND "toolMetadata"->>'kind'='form-response'`,
          [site],
        )
      ).rows[0].n,
    ).toBe(1);
  });
});
