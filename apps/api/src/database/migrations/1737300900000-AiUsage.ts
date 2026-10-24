import { MigrationInterface, QueryRunner } from 'typeorm';

export class AiUsage1737300900000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE ai_usage (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "siteId" uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      "conversationId" uuid REFERENCES conversations(id) ON DELETE SET NULL,
      "visitorId" uuid REFERENCES visitors(id) ON DELETE SET NULL,
      "agentId" uuid REFERENCES agents(id) ON DELETE SET NULL,
      kind varchar(20) NOT NULL,
      model varchar(150) NOT NULL,
      provider varchar(20) NOT NULL,
      status varchar(10) NOT NULL CHECK (status IN ('success', 'failed')),
      "inputTokens" integer CHECK ("inputTokens" >= 0),
      "outputTokens" integer CHECK ("outputTokens" >= 0),
      "totalTokens" integer CHECK ("totalTokens" >= 0),
      "requestId" varchar(150),
      "costUsd" numeric(20,10) CHECK ("costUsd" >= 0),
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(
      `CREATE INDEX idx_ai_usage_site_time ON ai_usage ("siteId", "createdAt" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_ai_usage_visitor ON ai_usage ("siteId", "visitorId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX idx_ai_usage_request ON ai_usage ("siteId", "requestId") WHERE "requestId" IS NOT NULL`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE ai_usage');
  }
}
