import { MigrationInterface, QueryRunner } from 'typeorm';

export class KnowledgeControls1737301100000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE knowledge_base_documents DROP CONSTRAINT "knowledge_base_documents_sourceType_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE knowledge_base_documents ADD CONSTRAINT "knowledge_base_documents_sourceType_check" CHECK ("sourceType" IN ('file','url','text','markdown'))`,
    );
    await queryRunner.query(`ALTER TABLE knowledge_base_documents
      ADD COLUMN enabled boolean NOT NULL DEFAULT true,
      ADD COLUMN keywords text[] NOT NULL DEFAULT '{}',
      ADD COLUMN revision integer NOT NULL DEFAULT 1,
      ADD COLUMN "usageCount" integer NOT NULL DEFAULT 0,
      ADD COLUMN "lastUsedAt" timestamptz`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE knowledge_base_documents DROP CONSTRAINT "knowledge_base_documents_sourceType_check"`,
    );
    await queryRunner.query(
      `UPDATE knowledge_base_documents SET "sourceType"='file' WHERE "sourceType"='markdown'`,
    );
    await queryRunner.query(
      `ALTER TABLE knowledge_base_documents ADD CONSTRAINT "knowledge_base_documents_sourceType_check" CHECK ("sourceType" IN ('file','url','text'))`,
    );
    await queryRunner.query(
      `ALTER TABLE knowledge_base_documents DROP COLUMN enabled, DROP COLUMN keywords, DROP COLUMN revision, DROP COLUMN "usageCount", DROP COLUMN "lastUsedAt"`,
    );
  }
}
