import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { WebhookEventType } from '@mira/shared-types';

// تنظیمات وب‌هوک هر سایت — برای امضای درخواست خروجی (HMAC-SHA256) استفاده می‌شه، نه احراز هویت ورودی
@Entity('webhooks')
export class WebhookEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  siteId!: string;

  @Column({ type: 'varchar', length: 1024 })
  url!: string;

  @Column({ type: 'varchar', length: 64 })
  secret!: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  events!: WebhookEventType[];

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
