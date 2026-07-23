import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { BusinessHours, TriggerMessageConfig } from '@mira/shared-types';

// هر ردیف این جدول یک سایت/کسب‌وکار متصل‌شده به میرا است (پایه چندمستأجری بودن سیستم)
@Entity('sites')
export class SiteEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  widgetKey!: string;

  // دامنه‌هایی که این widgetKey از اونا پذیرفته می‌شه (whitelist دامنه، نه CORS باز)
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  allowedDomains!: string[];

  @Column({ type: 'jsonb', default: () => "'{}'" })
  appearance!: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  businessHours!: BusinessHours | null;

  // متن پیام خودکاری که خارج از ساعت کاری برای بازدیدکننده ارسال می‌شه
  @Column({ type: 'text', nullable: true })
  offlineMessage!: string | null;

  // پیام محرک زمان‌دار که ویجت بعد از چند ثانیه حضور در صفحه (بدون شروع گفتگو) نشون می‌ده
  @Column({ type: 'jsonb', default: () => `'{"enabled": false, "delaySeconds": 30, "text": ""}'` })
  triggerMessage!: TriggerMessageConfig;

  // آدرس سایت وردپرس متصل‌شده و کلید API که برای صدا زدن REST endpoint سفارشی وردپرس استفاده می‌شه (فاز ۳)
  @Column({ type: 'varchar', length: 1024, nullable: true })
  wordpressSiteUrl!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  wordpressApiKey!: string | null;

  // ربات پاسخ‌گوی اول با RAG — قابل خاموش کردن به‌ازای هر سایت (فاز ۴)
  @Column({ type: 'boolean', default: true })
  aiEnabled!: boolean;

  // شخصیت/دستورالعمل قابل‌تنظیم ربات؛ اگر خالی باشه یک پرامپت پیش‌فرض داخل worker استفاده می‌شه
  @Column({ type: 'text', nullable: true })
  aiSystemPrompt!: string | null;

  // آستانه‌ی اطمینان (۰ تا ۱) — پایین‌تر از این عدد، ربات پاسخ نمی‌ده و مکالمه به اپراتور محول می‌شه
  @Column({ type: 'real', default: 0.6 })
  aiConfidenceThreshold!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
