import { MigrationInterface, QueryRunner } from 'typeorm';

// پروفایل اپراتور، دسترسی‌های دقیق نقش‌محور، و تنظیمات گسترده‌ی هوش مصنوعی از داشبورد
export class Phase6bProfilesPermissionsAi1737300600000 implements MigrationInterface {
  name = 'Phase6bProfilesPermissionsAi1737300600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agents"
        ADD COLUMN "avatarUrl" varchar(1024),
        ADD COLUMN "phone" varchar(32),
        ADD COLUMN "bio" text,
        ADD COLUMN "permissions" jsonb NOT NULL DEFAULT '{}'
    `);

    await queryRunner.query(`
      ALTER TABLE "sites"
        ADD COLUMN "aiBotName" varchar(100) NOT NULL DEFAULT 'دستیار میرا',
        ADD COLUMN "aiBotAvatarUrl" varchar(1024),
        ADD COLUMN "aiGreetingMessage" text,
        ADD COLUMN "aiHandoffMessage" text,
        ADD COLUMN "aiTemperature" real NOT NULL DEFAULT 0.3,
        ADD COLUMN "aiMaxTokens" integer NOT NULL DEFAULT 700,
        ADD COLUMN "aiMaxRepliesPerConversation" integer NOT NULL DEFAULT 10,
        ADD COLUMN "aiReplyOnlyOutsideBusinessHours" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sites"
        DROP COLUMN "aiBotName",
        DROP COLUMN "aiBotAvatarUrl",
        DROP COLUMN "aiGreetingMessage",
        DROP COLUMN "aiHandoffMessage",
        DROP COLUMN "aiTemperature",
        DROP COLUMN "aiMaxTokens",
        DROP COLUMN "aiMaxRepliesPerConversation",
        DROP COLUMN "aiReplyOnlyOutsideBusinessHours"
    `);
    await queryRunner.query(`
      ALTER TABLE "agents"
        DROP COLUMN "avatarUrl",
        DROP COLUMN "phone",
        DROP COLUMN "bio",
        DROP COLUMN "permissions"
    `);
  }
}
