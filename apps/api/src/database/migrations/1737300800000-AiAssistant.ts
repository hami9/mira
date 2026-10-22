import { MigrationInterface, QueryRunner } from 'typeorm';

export class AiAssistant1737300800000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE sites ADD COLUMN "aiPolicy" jsonb NOT NULL DEFAULT '{}'`);
    await queryRunner.query(
      `ALTER TABLE conversations ADD COLUMN "aiPaused" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE messages ADD COLUMN "aiMetadata" jsonb`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN "aiMetadata"`);
    await queryRunner.query(`ALTER TABLE conversations DROP COLUMN "aiPaused"`);
    await queryRunner.query(`ALTER TABLE sites DROP COLUMN "aiPolicy"`);
  }
}
