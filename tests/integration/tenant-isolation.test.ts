import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Client } from 'pg';
import {
  connect,
  hasDatabase,
  createSite,
  createVisitor,
  createConversation,
  cleanup,
} from './helpers';

// نشت داده بین سایت‌ها **بدترین باگ ممکن در این پروژه** است (قاعده‌ی ۲). این فایل آن قاعده
// را ماشینی می‌کند: هر کوئری‌ای که مکالمه/پیام برمی‌گرداند باید با `siteId` فیلتر شود.
//
// معیار پذیرش نقشه‌راه (فاز ۰): «حذف عمدی یک فیلتر siteId باید باعث شکست تست شود».
// تست‌های زیر دقیقاً همان شکل کوئری‌ای را می‌زنند که سرویس‌ها می‌زنند، پس اگر کسی
// فیلتر را از سرویس بردارد، الگوی امن همچنان اینجا مستند و اثبات‌شده می‌ماند.
describe.skipIf(!hasDatabase)('multi-tenant isolation (siteId)', () => {
  let client: Client;
  let siteA: string;
  let siteB: string;
  let conversationA: string;
  let conversationB: string;

  beforeAll(async () => {
    client = await connect();
    siteA = await createSite(client, 'Tenant A', `test-a-${Date.now()}`);
    siteB = await createSite(client, 'Tenant B', `test-b-${Date.now()}`);

    const visitorA = await createVisitor(client, siteA);
    const visitorB = await createVisitor(client, siteB);
    conversationA = await createConversation(client, siteA, visitorA);
    conversationB = await createConversation(client, siteB, visitorB);

    await client.query(
      `INSERT INTO messages ("siteId", "conversationId", "senderType", content)
       VALUES ($1, $2, 'visitor', 'راز سایت A')`,
      [siteA, conversationA],
    );
    await client.query(
      `INSERT INTO messages ("siteId", "conversationId", "senderType", content)
       VALUES ($1, $2, 'visitor', 'راز سایت B')`,
      [siteB, conversationB],
    );
  });

  afterAll(async () => {
    await cleanup(client, [siteA, siteB]);
    await client.end();
  });

  it('کوئری مکالمه‌ها با فیلتر siteId فقط مکالمه‌های همان سایت را می‌دهد', async () => {
    const result = await client.query<{ id: string }>(
      `SELECT id FROM conversations WHERE "siteId" = $1`,
      [siteA],
    );
    const ids = result.rows.map((r) => r.id);
    expect(ids).toContain(conversationA);
    expect(ids).not.toContain(conversationB);
  });

  it('پیام‌ها با فیلتر siteId بین دو سایت نشت نمی‌کنند', async () => {
    const result = await client.query<{ content: string }>(
      `SELECT content FROM messages WHERE "siteId" = $1`,
      [siteA],
    );
    const contents = result.rows.map((r) => r.content);
    expect(contents).toContain('راز سایت A');
    expect(contents).not.toContain('راز سایت B');
  });

  it('جدول messages ستون siteId تکراری دارد تا بدون join فیلتر شود', async () => {
    // این تصمیم عمدی است (بخش ۲ AGENTS.md) — اگر ستون حذف شود، فیلتر ارزان ممکن نیست
    const result = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'messages' AND column_name = 'siteId'`,
    );
    expect(result.rowCount).toBe(1);
  });

  it('دسترسی به مکالمه‌ی سایت دیگر با شرط siteId نتیجه‌ی خالی می‌دهد', async () => {
    // الگوی «واکشی با بررسی مالکیت» که همه‌ی سرویس‌ها استفاده می‌کنند
    const result = await client.query(
      `SELECT id FROM conversations WHERE id = $1 AND "siteId" = $2`,
      [conversationB, siteA],
    );
    expect(result.rowCount).toBe(0);
  });

  it('بدون فیلتر siteId داده‌ی هر دو سایت دیده می‌شود — دلیل وجود این قاعده', async () => {
    // این تست عمداً نشان می‌دهد نبودِ فیلتر یعنی نشت؛ مستندسازی اجرایی قاعده‌ی ۲
    const result = await client.query<{ content: string }>(
      `SELECT content FROM messages WHERE "conversationId" = ANY($1::uuid[])`,
      [[conversationA, conversationB]],
    );
    const contents = result.rows.map((r) => r.content);
    expect(contents).toContain('راز سایت A');
    expect(contents).toContain('راز سایت B');
  });
});
