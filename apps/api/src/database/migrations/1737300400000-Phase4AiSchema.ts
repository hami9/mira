import { MigrationInterface, QueryRunner } from 'typeorm';

// اسکیمای فاز ۴: ربات پاسخ‌گو با RAG، Copilot اپراتور، خلاصه‌سازی و escalation
export class Phase4AiSchema1737300400000 implements MigrationInterface {
  name = 'Phase4AiSchema1737300400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // بعد پیش‌فرض جدول InitSchema (1536) مخصوص embedding مدل‌های OpenAI بود؛ چون پرووایدر
    // واقعی این استقرار Gemini (مدل text-embedding-004) با بعد ۷۶۸ است، ستون رو منطبق می‌کنیم.
    // جدول تا این لحظه خالیه (فاز ۴ تازه شروع می‌شه) پس تغییر بعد بدون از دست رفتن داده‌ست.
    await queryRunner.query(`ALTER TABLE "knowledge_base_chunks" ALTER COLUMN "embedding" TYPE vector(768)`);

    await queryRunner.query(`
      ALTER TABLE "knowledge_base_documents"
        ADD COLUMN "content" text NOT NULL DEFAULT '',
        ADD COLUMN "status" varchar(10) NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'ready', 'failed'))
    `);

    await queryRunner.query(`
      ALTER TABLE "sites"
        ADD COLUMN "aiEnabled" boolean NOT NULL DEFAULT true,
        ADD COLUMN "aiSystemPrompt" text,
        ADD COLUMN "aiConfidenceThreshold" real NOT NULL DEFAULT 0.6
    `);

    await queryRunner.query(`
      ALTER TABLE "conversations"
        ADD COLUMN "priority" varchar(10) NOT NULL DEFAULT 'normal' CHECK ("priority" IN ('normal', 'high')),
        ADD COLUMN "summary" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "conversations"
        DROP COLUMN "priority",
        DROP COLUMN "summary"
    `);
    await queryRunner.query(`
      ALTER TABLE "sites"
        DROP COLUMN "aiEnabled",
        DROP COLUMN "aiSystemPrompt",
        DROP COLUMN "aiConfidenceThreshold"
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_base_documents"
        DROP COLUMN "content",
        DROP COLUMN "status"
    `);
    await queryRunner.query(`ALTER TABLE "knowledge_base_chunks" ALTER COLUMN "embedding" TYPE vector(1536)`);
  }
}
