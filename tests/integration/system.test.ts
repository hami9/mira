import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import type { Client } from 'pg';
import Redis from 'ioredis';
import { SystemService } from '../../apps/api/src/modules/system/system.service';
import { cleanup, connect, createSite, hasDatabase } from './helpers';

describe.skipIf(!hasDatabase)('installation resource authorization', () => {
  let db: Client;
  let redis: Redis;
  let owner: string;
  let other: string;
  let admin: string;
  let otherAdmin: string;
  let service: SystemService;

  beforeAll(async () => {
    db = await connect();
    owner = await createSite(db, 'Resource owner', `system-${crypto.randomUUID()}`);
    other = await createSite(db, 'Other store', `system-${crypto.randomUUID()}`);
    const addAdmin = async (site: string) =>
      (
        await db.query(
          `INSERT INTO agents ("siteId", email, "passwordHash", "fullName", role) VALUES ($1, $2, 'fixture', 'fixture', 'admin') RETURNING id`,
          [site, `${crypto.randomUUID()}@system.test`],
        )
      ).rows[0].id;
    admin = await addAdmin(owner);
    otherAdmin = await addAdmin(other);
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379),
      maxRetriesPerRequest: 1,
    });
    service = new SystemService(
      new ConfigService({ SYSTEM_SITE_ID: owner, QUEUE_PREFIX: `system-test-${owner}` }),
      {
        query: (sql: string, params: unknown[]) => db.query(sql, params).then((r) => r.rows),
      } as unknown as DataSource,
      redis,
    );
  });

  afterAll(async () => {
    await redis?.quit();
    if (db) {
      await cleanup(db, [owner, other].filter(Boolean));
      await db.end();
    }
  });

  it('returns real database/process metrics only for the bound installation owner', async () => {
    const result = await service.status(owner, admin);
    expect(result.authorized).toBe(true);
    expect(result.api?.rssBytes).toBeGreaterThan(0);
    expect(result.databaseBytes).toBeGreaterThan(0);
    expect(result.worker).toBeNull();
    const hidden = await service.status(other, otherAdmin);
    expect(hidden.authorized).toBe(false);
    expect(hidden.api).toBeNull();
    expect(hidden.databaseBytes).toBeNull();
    expect(hidden.limits).toBeNull();
    await expect(service.status(owner, otherAdmin)).rejects.toThrow();
  });

  it('rechecks a revoked admin role instead of trusting previous requests', async () => {
    await db.query(`UPDATE agents SET role = 'agent' WHERE id = $1 AND "siteId" = $2`, [
      admin,
      owner,
    ]);
    try {
      await expect(service.status(owner, admin)).rejects.toThrow();
    } finally {
      await db.query(`UPDATE agents SET role = 'admin' WHERE id = $1 AND "siteId" = $2`, [
        admin,
        owner,
      ]);
    }
  });
});
