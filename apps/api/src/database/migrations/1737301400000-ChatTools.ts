import { MigrationInterface, QueryRunner } from 'typeorm';
export class ChatTools1737301400000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE messages ADD "toolMetadata" jsonb`);
    await q.query(
      `CREATE TABLE chat_forms (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "siteId" uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE, "creatorId" uuid NOT NULL, title varchar(120) NOT NULL, description varchar(500) NOT NULL DEFAULT '', fields jsonb NOT NULL, revision integer NOT NULL DEFAULT 1, "archivedAt" timestamptz, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`,
    );
    await q.query(`CREATE INDEX ON chat_forms ("siteId","createdAt")`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE chat_forms');
    await q.query('ALTER TABLE messages DROP "toolMetadata"');
  }
}
