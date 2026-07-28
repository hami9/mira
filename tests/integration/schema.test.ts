import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Client } from 'pg';
import { connect, hasDatabase } from './helpers';

// این فایل ثابت می‌کند مایگریشن‌ها روی یک دیتابیس خالی واقعاً اجرا شده‌اند و اسکیمای
// مورد انتظار را ساخته‌اند. `synchronize` هرگز روشن نمی‌شود (قاعده‌ی ۱)، پس تنها راه
// رسیدن به این جدول‌ها اجرای مایگریشن است.
const EXPECTED_TABLES = [
  'sites',
  'agents',
  'visitors',
  'conversations',
  'messages',
  'canned_responses',
  'csat_ratings',
  'visitor_page_views',
  'conversation_reads',
  'knowledge_base_documents',
  'knowledge_base_chunks',
  'automation_rules',
  'internal_notes',
  'webhooks',
];

describe.skipIf(!hasDatabase)('database schema', () => {
  let client: Client;
  let tables: string[];

  beforeAll(async () => {
    client = await connect();
    const result = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    tables = result.rows.map((r) => r.table_name);
  });

  afterAll(async () => {
    await client.end();
  });

  it.each(EXPECTED_TABLES)('جدول %s وجود دارد', (table) => {
    expect(tables).toContain(table);
  });

  it('مایگریشن‌ها اجرا شده‌اند (جدول migrations پر است)', async () => {
    const result = await client.query<{ count: string }>(`SELECT COUNT(*) FROM migrations`);
    expect(Number(result.rows[0].count)).toBeGreaterThan(0);
  });

  it('افزونه‌ی pgvector فعال است — پایگاه دانش بدون آن کار نمی‌کند', async () => {
    const result = await client.query(`SELECT 1 FROM pg_extension WHERE extname = 'vector'`);
    expect(result.rowCount).toBe(1);
  });

  it('بعد بردار embedding دقیقاً ۷۶۸ است (تله‌ی BYO-AI — بخش ۱.۱ نقشه‌راه)', async () => {
    // اگر روزی پرووایدر embedding عوض شود، این تست شکست می‌خورد و یادآوری می‌کند که
    // باید مهاجرت/re-index انجام شود، نه این‌که بی‌صدا بردار بی‌معنی ذخیره شود.
    const result = await client.query<{ atttypmod: number }>(
      `SELECT a.atttypmod FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       WHERE c.relname = 'knowledge_base_chunks' AND a.attname = 'embedding'`,
    );
    expect(result.rows[0]?.atttypmod).toBe(768);
  });

  it('هر جدول چندمستأجری ستون siteId دارد', async () => {
    const multiTenant = ['conversations', 'messages', 'visitors', 'agents'];
    for (const table of multiTenant) {
      const result = await client.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_name = $1 AND column_name = 'siteId'`,
        [table],
      );
      expect(result.rowCount, `${table}.siteId`).toBe(1);
    }
  });
});
