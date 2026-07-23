import { MigrationInterface, QueryRunner } from 'typeorm';

// اسکیمای فاز ۲: تنظیمات ساعت کاری/پیام محرک روی سایت + ردیابی صفحات بازدیدشده بازدیدکننده
export class Phase2Schema1737300100000 implements MigrationInterface {
  name = 'Phase2Schema1737300100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sites"
        ADD COLUMN "offlineMessage" text,
        ADD COLUMN "triggerMessage" jsonb NOT NULL DEFAULT '{"enabled": false, "delaySeconds": 30, "text": ""}'
    `);

    await queryRunner.query(`
      CREATE TABLE "visitor_page_views" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "siteId" uuid NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
        "visitorId" uuid NOT NULL REFERENCES "visitors"("id") ON DELETE CASCADE,
        "url" varchar(1024) NOT NULL,
        "title" varchar(255),
        "visitedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_page_views_site" ON "visitor_page_views" ("siteId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_page_views_visitor" ON "visitor_page_views" ("visitorId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "visitor_page_views"`);
    await queryRunner.query(`
      ALTER TABLE "sites"
        DROP COLUMN "offlineMessage",
        DROP COLUMN "triggerMessage"
    `);
  }
}
