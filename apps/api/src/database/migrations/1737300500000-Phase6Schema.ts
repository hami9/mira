import { MigrationInterface, QueryRunner } from 'typeorm';

// اسکیمای فاز ۶: اتوماسیون ساده، یادداشت داخلی، API عمومی + وب‌هوک، 2FA اپراتور
export class Phase6Schema1737300500000 implements MigrationInterface {
  name = 'Phase6Schema1737300500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "automation_rules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "siteId" uuid NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
        "name" varchar(255) NOT NULL,
        "triggerType" varchar(30) NOT NULL DEFAULT 'keyword_in_message' CHECK ("triggerType" IN ('keyword_in_message')),
        "triggerValue" text NOT NULL,
        "actionType" varchar(30) NOT NULL CHECK ("actionType" IN ('set_department', 'add_tag', 'set_priority_high')),
        "actionValue" varchar(255),
        "enabled" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_automation_rules_site" ON "automation_rules" ("siteId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "internal_notes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "siteId" uuid NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
        "conversationId" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
        "agentId" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
        "content" text NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_internal_notes_conversation" ON "internal_notes" ("conversationId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "webhooks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "siteId" uuid NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
        "url" varchar(1024) NOT NULL,
        "secret" varchar(64) NOT NULL,
        "events" text[] NOT NULL DEFAULT '{}',
        "enabled" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_webhooks_site" ON "webhooks" ("siteId")`);

    await queryRunner.query(`
      ALTER TABLE "agents"
        ADD COLUMN "twoFactorSecret" varchar(64),
        ADD COLUMN "twoFactorEnabled" boolean NOT NULL DEFAULT false
    `);

    // فقط hash کلید API نگه داشته می‌شه (مثل passwordHash اپراتور)؛ prefix صرفاً برای نمایش در UI است
    await queryRunner.query(`
      ALTER TABLE "sites"
        ADD COLUMN "apiKeyHash" varchar(64),
        ADD COLUMN "apiKeyPrefix" varchar(12),
        ADD COLUMN "apiKeyCreatedAt" timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sites"
        DROP COLUMN "apiKeyHash",
        DROP COLUMN "apiKeyPrefix",
        DROP COLUMN "apiKeyCreatedAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "agents"
        DROP COLUMN "twoFactorSecret",
        DROP COLUMN "twoFactorEnabled"
    `);
    await queryRunner.query(`DROP TABLE "webhooks"`);
    await queryRunner.query(`DROP TABLE "internal_notes"`);
    await queryRunner.query(`DROP TABLE "automation_rules"`);
  }
}
