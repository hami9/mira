import 'reflect-metadata';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as entities from '../../apps/api/src/database/entities';
import { ConversationsService } from '../../apps/api/src/modules/conversations/conversations.service';
import { VisitorsService } from '../../apps/api/src/modules/visitors/visitors.service';
import { VisitorsDirectoryService } from '../../apps/api/src/modules/visitors/visitors-directory.service';
import {
  connect,
  cleanup,
  createSite,
  createVisitor,
  hasDatabase,
  TEST_DATABASE_URL,
} from './helpers';

describe.skipIf(!hasDatabase)('visitor activity and operator conversations', () => {
  let db: Client;
  let source: DataSource;
  let site: string;
  let other: string;
  let agent: string;
  let foreignAgent: string;
  let visitor: string;
  let conversations: ConversationsService;
  let visitors: VisitorsService;
  let directory: VisitorsDirectoryService;
  const entry = { url: 'https://store.test/product/one', title: 'محصول اول' };
  beforeAll(async () => {
    db = await connect();
    site = await createSite(db, 'Activity store', crypto.randomUUID());
    other = await createSite(db, 'Foreign activity store', crypto.randomUUID());
    visitor = await createVisitor(db, site);
    const addAgent = async (siteId: string) =>
      (
        await db.query(
          `INSERT INTO agents ("siteId",email,"passwordHash","fullName") VALUES ($1,$2,'fixture','fixture') RETURNING id`,
          [siteId, `${crypto.randomUUID()}@activity.test`],
        )
      ).rows[0].id;
    agent = await addAgent(site);
    foreignAgent = await addAgent(other);
    source = new DataSource({
      type: 'postgres',
      url: TEST_DATABASE_URL,
      entities: Object.values(entities),
      synchronize: false,
      extra: { max: 5 },
    });
    await source.initialize();
    conversations = new ConversationsService(
      source.getRepository(entities.ConversationEntity),
      source.getRepository(entities.CsatRatingEntity),
      source.getRepository(entities.ConversationReadEntity),
      new EventEmitter2(),
    );
    visitors = new VisitorsService(
      source.getRepository(entities.VisitorEntity),
      source.getRepository(entities.VisitorPageViewEntity),
    );
    directory = new VisitorsDirectoryService(source);
  });
  afterAll(async () => {
    if (source?.isInitialized) await source.destroy();
    if (db) {
      await cleanup(db, [site, other].filter(Boolean));
      await db.end();
    }
  });
  it('refreshes activity without adding duplicate page views', async () => {
    await db.query(
      `UPDATE visitors SET "lastSeenAt"=now()-interval '1 hour' WHERE id=$1 AND "siteId"=$2`,
      [visitor, site],
    );
    await visitors.recordPageView(site, visitor, entry.url, entry.title);
    await visitors.recordPageView(site, visitor, entry.url, entry.title);
    const rows = await db.query(
      `SELECT COUNT(*)::int AS count FROM visitor_page_views WHERE "visitorId"=$1 AND "siteId"=$2`,
      [visitor, site],
    );
    expect(rows.rows[0].count).toBe(1);
    expect((await directory.list(site, { onlineOnly: true })).some((v) => v.id === visitor)).toBe(
      true,
    );
  });
  it('serializes simultaneous operator and visitor starts into one active conversation', async () => {
    const opened = await Promise.all([
      conversations.openForVisitor(site, visitor, agent),
      conversations.createConversation(site, visitor, entry),
      conversations.openForVisitor(site, visitor, agent),
    ]);
    expect(new Set(opened.map((c) => c.id)).size).toBe(1);
    expect(opened[0].entryPage).toEqual(entry);
    expect(
      (
        await db.query(
          `SELECT COUNT(*)::int AS count FROM conversations WHERE "siteId"=$1 AND "visitorId"=$2`,
          [site, visitor],
        )
      ).rows[0].count,
    ).toBe(1);
  });
  it('keeps the entry page stable when the current page changes', async () => {
    await visitors.recordPageView(site, visitor, 'https://store.test/cart', 'سبد خرید');
    const list = await directory.list(site, {});
    expect(list[0].currentPageUrl).toBe('https://store.test/cart');
    expect(list[0].entryPage).toEqual(entry);
    const profile = await directory.getProfile(site, visitor);
    expect(profile.pageViews[0].title).toBe('سبد خرید');
    expect(profile.conversations[0].entryPage).toEqual(entry);
    const reopened = await conversations.openForVisitor(site, visitor, agent);
    expect(reopened.entryPage).toEqual(entry);
  });
  it('rejects foreign visitors and agents and hides their page history', async () => {
    await expect(conversations.openForVisitor(other, visitor, foreignAgent)).rejects.toThrow();
    await expect(conversations.openForVisitor(site, visitor, foreignAgent)).rejects.toThrow();
    expect(await visitors.listRecentPageViews(visitor, other)).toEqual([]);
    await expect(directory.getProfile(other, visitor)).rejects.toThrow();
  });
});
