import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// بازدیدکننده ناشناس/شناسایی‌شده روی ویجت — همیشه وابسته به یک site_id مشخص
@Entity('visitors')
export class VisitorEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  siteId!: string;

  // شناسه غیرحساس و غیر-PII که ویجت در localStorage نگه می‌داره تا بین بازخوانی صفحه، مکالمه ادامه پیدا کنه
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  visitorRef!: string;

  // شناسه کاربر وردپرس در صورت ورود به سایت (برای ادغام ووکامرس در فاز ۳)
  @Column({ type: 'varchar', length: 64, nullable: true })
  externalId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  firstSeenAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  lastSeenAt!: Date;
}
