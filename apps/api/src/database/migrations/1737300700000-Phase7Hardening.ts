import { MigrationInterface, QueryRunner } from 'typeorm';

// سخت‌سازی فاز ۷: idempotency ارسال پیام + ایندکس‌های مسیرهای پرکوئری
export class Phase7Hardening1737300700000 implements MigrationInterface {
  name = 'Phase7Hardening1737300700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // شناسه‌ای که خودِ کلاینت تولید می‌کند؛ اگر پاسخ سرور به‌خاطر قطعی شبکه به کلاینت نرسید و
    // کلاینت دوباره فرستاد، سرور همان پیام قبلی را برمی‌گرداند به‌جای ساختن پیام تکراری.
    await queryRunner.query(`ALTER TABLE "messages" ADD COLUMN "clientMessageId" varchar(64)`);
    // ایندکس یکتای جزئی: فقط روی پیام‌هایی که clientMessageId دارند (پیام‌های ربات و قدیمی NULL‌اند)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_messages_client_id"
        ON "messages" ("conversationId", "clientMessageId")
        WHERE "clientMessageId" IS NOT NULL
    `);

    // مسیر داغ «فهرست مکالمات یک سایت مرتب بر اساس زمان» — قبلاً فقط siteId ایندکس داشت
    await queryRunner.query(
      `CREATE INDEX "idx_conversations_site_created" ON "conversations" ("siteId", "createdAt" DESC)`,
    );
    // مسیر داغ «پیام‌های یک مکالمه به ترتیب زمان» و صفحه‌بندی با before
    await queryRunner.query(
      `CREATE INDEX "idx_messages_conversation_created" ON "messages" ("conversationId", "createdAt" DESC)`,
    );
    // صفحه‌ی بازدیدکنندگان آنلاین/همه که همیشه بر اساس lastSeenAt مرتب می‌شود
    await queryRunner.query(
      `CREATE INDEX "idx_visitors_site_lastseen" ON "visitors" ("siteId", "lastSeenAt" DESC)`,
    );
    // آخرین صفحه‌ی بازدیدشده‌ی هر بازدیدکننده (LEFT JOIN LATERAL در فهرست بازدیدکنندگان)
    await queryRunner.query(
      `CREATE INDEX "idx_page_views_visitor_visited" ON "visitor_page_views" ("visitorId", "visitedAt" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_page_views_visitor_visited"`);
    await queryRunner.query(`DROP INDEX "idx_visitors_site_lastseen"`);
    await queryRunner.query(`DROP INDEX "idx_messages_conversation_created"`);
    await queryRunner.query(`DROP INDEX "idx_conversations_site_created"`);
    await queryRunner.query(`DROP INDEX "idx_messages_client_id"`);
    await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "clientMessageId"`);
  }
}
