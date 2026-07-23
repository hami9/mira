import { MigrationInterface, QueryRunner } from 'typeorm';

// وضعیت «خواندن» هر مکالمه به‌ازای هر اپراتور — پایه‌ی badge تعداد پیام نخوانده در داشبورد
export class ConversationReads1737300300000 implements MigrationInterface {
  name = 'ConversationReads1737300300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "conversation_reads" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "conversationId" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
        "agentId" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
        "lastReadAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_conversation_reads_conv_agent" ON "conversation_reads" ("conversationId", "agentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conversation_reads_agent" ON "conversation_reads" ("agentId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "conversation_reads"`);
  }
}
