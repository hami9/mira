import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConversationEntry1737301000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE conversations ADD COLUMN "entryPage" jsonb`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE conversations DROP COLUMN "entryPage"`);
  }
}
