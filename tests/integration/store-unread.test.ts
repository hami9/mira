import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Repository } from 'typeorm';
import { ConversationsService } from '../../apps/api/src/modules/conversations/conversations.service';
import type {
  ConversationEntity,
  ConversationReadEntity,
  CsatRatingEntity,
} from '../../apps/api/src/database/entities';
import {
  cleanup,
  connect,
  createSite,
  createVisitor,
  createConversation,
  hasDatabase,
} from './helpers';

describe.skipIf(!hasDatabase)('store unread totals', () => {
  let db: Client;
  let site: string;
  let other: string;
  let agent: string;
  let colleague: string;
  let foreignAgent: string;
  let conversation: string;
  let service: ConversationsService;

  beforeAll(async () => {
    db = await connect();
    site = await createSite(db, 'Unread store', crypto.randomUUID());
    other = await createSite(db, 'Other unread store', crypto.randomUUID());
    const addAgent = async (siteId: string) =>
      (
        await db.query(
          `INSERT INTO agents ("siteId", email, "passwordHash", "fullName") VALUES ($1,$2,'fixture','fixture') RETURNING id`,
          [siteId, `${crypto.randomUUID()}@unread.test`],
        )
      ).rows[0].id;
    agent = await addAgent(site);
    colleague = await addAgent(site);
    foreignAgent = await addAgent(other);
    service = new ConversationsService(
      {
        manager: {
          query: (sql: string, params: unknown[]) => db.query(sql, params).then((r) => r.rows),
        },
      } as unknown as Repository<ConversationEntity>,
      {} as Repository<CsatRatingEntity>,
      {} as Repository<ConversationReadEntity>,
      new EventEmitter2(),
    );
    const visitor = await createVisitor(db, site);
    conversation = await createConversation(db, site, visitor);
    await db.query(
      `INSERT INTO conversations ("siteId", "visitorId") SELECT $1,$2 FROM generate_series(1,35)`,
      [site, visitor],
    );
    await db.query(
      `INSERT INTO messages ("siteId", "conversationId", "senderType", content) SELECT $1, id, 'visitor', 'fixture' FROM conversations WHERE "siteId"=$1`,
      [site],
    );
    await db.query(
      `INSERT INTO messages ("siteId", "conversationId", "senderType", content) VALUES ($1,$2,'bot','fixture'), ($1,$2,'agent','fixture')`,
      [site, conversation],
    );
    const foreignConversation = await createConversation(db, other, await createVisitor(db, other));
    await db.query(
      `INSERT INTO messages ("siteId", "conversationId", "senderType", content) VALUES ($1,$2,'visitor','foreign')`,
      [other, foreignConversation],
    );
  });

  afterAll(async () => {
    if (db) {
      await cleanup(db, [site, other].filter(Boolean));
      await db.end();
    }
  });

  it('counts every conversation beyond the list page and excludes operator messages and other stores', async () => {
    expect(await service.unreadForSite(site, agent)).toEqual({ unreadCount: 37 });
    expect(await service.unreadForSite(other, foreignAgent)).toEqual({ unreadCount: 1 });
  });

  it('keeps read markers specific to each operator', async () => {
    await db.query(
      `INSERT INTO conversation_reads ("conversationId", "agentId", "lastReadAt") VALUES ($1,$2,now())`,
      [conversation, agent],
    );
    expect(await service.unreadForSite(site, agent)).toEqual({ unreadCount: 35 });
    expect(await service.unreadForSite(site, colleague)).toEqual({ unreadCount: 37 });
  });

  it('rejects a mismatched or deleted operator', async () => {
    await expect(service.unreadForSite(site, foreignAgent)).rejects.toThrow();
    await expect(service.unreadForSite(site, crypto.randomUUID())).rejects.toThrow();
  });
});
