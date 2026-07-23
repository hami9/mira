import { MigrationInterface, QueryRunner } from 'typeorm';

// اسکیمای اولیه میرا — جدول‌های هسته چت (فاز ۱) + جدول‌های فازهای بعدی (فقط ساختار، بدون منطق سرویس)
// طبق الزام امنیتی چندمستأجری: هر جدول وابسته به یک سایت، ستون site_id دارد و ایندکس می‌شود
export class InitSchema1737300000000 implements MigrationInterface {
  name = 'InitSchema1737300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "vector"`);

    await queryRunner.query(`
      CREATE TABLE "sites" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "widgetKey" varchar(64) NOT NULL UNIQUE,
        "allowedDomains" text[] NOT NULL DEFAULT '{}',
        "appearance" jsonb NOT NULL DEFAULT '{}',
        "businessHours" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "agents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "siteId" uuid NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
        "email" varchar(255) NOT NULL UNIQUE,
        "passwordHash" varchar(255) NOT NULL,
        "fullName" varchar(255) NOT NULL,
        "role" varchar(20) NOT NULL DEFAULT 'agent' CHECK ("role" IN ('admin', 'agent')),
        "status" varchar(20) NOT NULL DEFAULT 'offline' CHECK ("status" IN ('online', 'busy', 'offline')),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_agents_site" ON "agents" ("siteId")`);

    await queryRunner.query(`
      CREATE TABLE "visitors" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "siteId" uuid NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
        "visitorRef" varchar(64) NOT NULL,
        "externalId" varchar(64),
        "name" varchar(255),
        "email" varchar(255),
        "userAgent" varchar(512),
        "firstSeenAt" timestamptz NOT NULL DEFAULT now(),
        "lastSeenAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_visitors_site" ON "visitors" ("siteId")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_visitors_ref" ON "visitors" ("siteId", "visitorRef")`,
    );

    await queryRunner.query(`
      CREATE TABLE "conversations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "siteId" uuid NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
        "visitorId" uuid NOT NULL REFERENCES "visitors"("id") ON DELETE CASCADE,
        "assignedAgentId" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
        "status" varchar(20) NOT NULL DEFAULT 'open' CHECK ("status" IN ('open', 'pending', 'resolved')),
        "department" varchar(100),
        "tags" text[] NOT NULL DEFAULT '{}',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "resolvedAt" timestamptz
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_conversations_site" ON "conversations" ("siteId")`);
    await queryRunner.query(
      `CREATE INDEX "idx_conversations_visitor" ON "conversations" ("visitorId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conversations_status" ON "conversations" ("status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "siteId" uuid NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
        "conversationId" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
        "senderType" varchar(20) NOT NULL CHECK ("senderType" IN ('visitor', 'agent', 'bot')),
        "senderId" uuid,
        "content" text NOT NULL,
        "attachmentUrl" varchar(1024),
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_messages_site" ON "messages" ("siteId")`);
    await queryRunner.query(
      `CREATE INDEX "idx_messages_conversation" ON "messages" ("conversationId")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_messages_created" ON "messages" ("createdAt")`);

    // --- جدول‌های فازهای بعدی: ساختار از حالا موجوده، منطق سرویس در فاز مربوطه اضافه می‌شه ---

    await queryRunner.query(`
      CREATE TABLE "canned_responses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "siteId" uuid NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
        "shortcut" varchar(64) NOT NULL,
        "title" varchar(255) NOT NULL,
        "content" text NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_canned_responses_site" ON "canned_responses" ("siteId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "knowledge_base_documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "siteId" uuid NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
        "title" varchar(255) NOT NULL,
        "sourceType" varchar(20) NOT NULL DEFAULT 'file' CHECK ("sourceType" IN ('file', 'url', 'text')),
        "sourceUrl" varchar(1024),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_kb_documents_site" ON "knowledge_base_documents" ("siteId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "knowledge_base_chunks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "siteId" uuid NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
        "documentId" uuid NOT NULL REFERENCES "knowledge_base_documents"("id") ON DELETE CASCADE,
        "content" text NOT NULL,
        "embedding" vector(1536),
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_kb_chunks_site" ON "knowledge_base_chunks" ("siteId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_kb_chunks_document" ON "knowledge_base_chunks" ("documentId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "csat_ratings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "siteId" uuid NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
        "conversationId" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
        "score" smallint NOT NULL CHECK ("score" BETWEEN 1 AND 5),
        "comment" text,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_csat_site" ON "csat_ratings" ("siteId")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_csat_conversation" ON "csat_ratings" ("conversationId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "csat_ratings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_base_chunks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_base_documents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "canned_responses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "conversations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "visitors"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "agents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sites"`);
  }
}
