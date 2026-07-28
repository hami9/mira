import { Client } from 'pg';

// تست‌های یکپارچگی روی **دیتابیس واقعی** اجرا می‌شوند، نه ماک (قاعده‌ی ۸ پروژه:
// تقریباً همه‌ی باگ‌های واقعی این پروژه فقط با اجرای واقعی پیدا شدند).
// در CI با service containerهای Postgres و Redis اجرا می‌شوند؛ روی ماشین توسعه‌ای که
// دیتابیس ندارد، خودشان را skip می‌کنند تا `npm test` همه‌جا سبز بماند.
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
export const hasDatabase = Boolean(TEST_DATABASE_URL);

export async function connect(): Promise<Client> {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  return client;
}

/** یک سایت تستی می‌سازد و شناسه‌اش را برمی‌گرداند. */
export async function createSite(client: Client, name: string, widgetKey: string): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO sites (name, "widgetKey", "allowedDomains")
     VALUES ($1, $2, ARRAY['http://localhost:3000']) RETURNING id`,
    [name, widgetKey],
  );
  return result.rows[0].id;
}

/**
 * بازدیدکننده‌ی متصل به یک سایت.
 * `visitorRef` اجباری است (NOT NULL) و روی (`siteId`, `visitorRef`) ایندکس یکتا دارد —
 * همان شناسه‌ای که ویجت در مرورگر بازدیدکننده نگه می‌دارد.
 */
export async function createVisitor(client: Client, siteId: string): Promise<string> {
  const visitorRef = `test-${Math.random().toString(36).slice(2, 12)}`;
  const result = await client.query<{ id: string }>(
    `INSERT INTO visitors ("siteId", "visitorRef") VALUES ($1, $2) RETURNING id`,
    [siteId, visitorRef],
  );
  return result.rows[0].id;
}

/** مکالمه‌ی متصل به یک سایت و بازدیدکننده. */
export async function createConversation(
  client: Client,
  siteId: string,
  visitorId: string,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO conversations ("siteId", "visitorId") VALUES ($1, $2) RETURNING id`,
    [siteId, visitorId],
  );
  return result.rows[0].id;
}

/** پاکسازی کامل داده‌ی تست — بعد از هر تست اجرا می‌شود (الگوی ثابت پروژه). */
export async function cleanup(client: Client, siteIds: string[]): Promise<void> {
  if (siteIds.length === 0) return;
  await client.query(`DELETE FROM messages WHERE "siteId" = ANY($1::uuid[])`, [siteIds]);
  await client.query(`DELETE FROM conversations WHERE "siteId" = ANY($1::uuid[])`, [siteIds]);
  await client.query(`DELETE FROM visitors WHERE "siteId" = ANY($1::uuid[])`, [siteIds]);
  await client.query(`DELETE FROM agents WHERE "siteId" = ANY($1::uuid[])`, [siteIds]);
  await client.query(`DELETE FROM sites WHERE id = ANY($1::uuid[])`, [siteIds]);
}
