import { MigrationInterface, QueryRunner } from 'typeorm';

export class Avatars1737301200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE avatars (
      "siteId" uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      "ownerId" uuid NOT NULL,
      "agentId" uuid REFERENCES agents(id) ON DELETE CASCADE,
      version uuid NOT NULL,
      data bytea NOT NULL CHECK (octet_length(data) <= 300000),
      PRIMARY KEY ("siteId", "ownerId")
    )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE avatars');
  }
}
