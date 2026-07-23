import { MigrationInterface, QueryRunner } from 'typeorm';

// اسکیمای فاز ۳: اتصال سایت به یک نصب وردپرس/ووکامرس برای پنل مشتری کنار گفتگو
export class Phase3Schema1737300200000 implements MigrationInterface {
  name = 'Phase3Schema1737300200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sites"
        ADD COLUMN "wordpressSiteUrl" varchar(1024),
        ADD COLUMN "wordpressApiKey" varchar(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sites"
        DROP COLUMN "wordpressSiteUrl",
        DROP COLUMN "wordpressApiKey"
    `);
  }
}
