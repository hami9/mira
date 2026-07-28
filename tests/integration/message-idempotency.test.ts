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

// idempotency ارسال پیام (سخت‌سازی فاز ۷): وقتی شبکه‌ی بازدیدکننده قطع و وصل می‌شود،
// کلاینت همان پیام را با همان `clientMessageId` دوباره می‌فرستد. سرویس اول با یک SELECT
// چک می‌کند و اگر رقابت هم‌زمان رخ دهد، **ایندکس یکتای دیتابیس** آخرین خط دفاع است.
// این تست همان ایندکس را روی دیتابیس واقعی می‌آزماید — نه منطق سرویس را با ماک.
describe.skipIf(!hasDatabase)('message idempotency', () => {
  let client: Client;
  let siteId: string;
  let conversationId: string;

  beforeAll(async () => {
    client = await connect();
    siteId = await createSite(client, 'Idempotency', `test-idem-${Date.now()}`);
    const visitorId = await createVisitor(client, siteId);
    conversationId = await createConversation(client, siteId, visitorId);
  });

  afterAll(async () => {
    await cleanup(client, [siteId]);
    await client.end();
  });

  async function insert(clientMessageId: string | null, content: string) {
    return client.query(
      `INSERT INTO messages ("siteId", "conversationId", "senderType", content, "clientMessageId")
       VALUES ($1, $2, 'visitor', $3, $4)`,
      [siteId, conversationId, content, clientMessageId],
    );
  }

  it('ایندکس یکتای clientMessageId وجود دارد', async () => {
    const result = await client.query(
      `SELECT 1 FROM pg_indexes WHERE tablename = 'messages' AND indexname = 'idx_messages_client_id'`,
    );
    expect(result.rowCount).toBe(1);
  });

  it('ارسال دوباره با همان clientMessageId پیام تکراری نمی‌سازد', async () => {
    const id = `dup-${Date.now()}`;
    await insert(id, 'سلام');
    await expect(insert(id, 'سلام')).rejects.toThrow(); // ایندکس یکتا جلویش را می‌گیرد

    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*) FROM messages WHERE "conversationId" = $1 AND "clientMessageId" = $2`,
      [conversationId, id],
    );
    expect(Number(result.rows[0].count)).toBe(1);
  });

  it('clientMessageIdهای متفاوت هر دو درج می‌شوند', async () => {
    const a = `a-${Date.now()}`;
    const b = `b-${Date.now()}`;
    await insert(a, 'پیام یک');
    await insert(b, 'پیام دو');

    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*) FROM messages WHERE "conversationId" = $1 AND "clientMessageId" = ANY($2)`,
      [conversationId, [a, b]],
    );
    expect(Number(result.rows[0].count)).toBe(2);
  });

  it('پیام‌های بدون clientMessageId محدود نمی‌شوند (NULL چندباره مجاز است)', async () => {
    // پیام اپراتور از داشبورد clientMessageId ندارد؛ ایندکس یکتا نباید مانعش شود
    await insert(null, 'پیام اول بدون شناسه');
    await insert(null, 'پیام دوم بدون شناسه');

    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*) FROM messages
       WHERE "conversationId" = $1 AND "clientMessageId" IS NULL`,
      [conversationId],
    );
    expect(Number(result.rows[0].count)).toBe(2);
  });
});
