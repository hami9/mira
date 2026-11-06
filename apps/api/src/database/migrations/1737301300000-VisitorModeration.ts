import { MigrationInterface, QueryRunner } from 'typeorm';
export class VisitorModeration1737301300000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      `ALTER TABLE visitors ADD "displayName" varchar(255), ADD flags jsonb NOT NULL DEFAULT '[]', ADD "blockedAt" timestamptz, ADD "blockedUntil" timestamptz, ADD "blockReason" varchar(500), ADD "blockSource" varchar(10), ADD "mutedUntil" timestamptz, ADD "moderationVersion" integer NOT NULL DEFAULT 0`,
    );
    await runner.query(
      `ALTER TABLE conversations ADD "deletedAt" timestamptz, ADD "deletedById" uuid, ADD "lifecycleVersion" integer NOT NULL DEFAULT 0`,
    );
    await runner.query(
      `ALTER TABLE sites ADD "moderationPolicy" jsonb NOT NULL DEFAULT '{"spamEnabled":true,"blockMinutes":10}'`,
    );
    await runner.query(
      `CREATE INDEX "IDX_conversations_active_site" ON conversations ("siteId", "createdAt" DESC) WHERE "deletedAt" IS NULL`,
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DROP INDEX "IDX_conversations_active_site"`);
    await runner.query(`ALTER TABLE sites DROP "moderationPolicy"`);
    await runner.query(
      `ALTER TABLE conversations DROP "deletedAt", DROP "deletedById", DROP "lifecycleVersion"`,
    );
    await runner.query(
      `ALTER TABLE visitors DROP "displayName", DROP flags, DROP "blockedAt", DROP "blockedUntil", DROP "blockReason", DROP "blockSource", DROP "mutedUntil", DROP "moderationVersion"`,
    );
  }
}
