import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { MessageSenderType } from '@mira/shared-types';

@Entity('messages')
export class MessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // تکرار site_id روی پیام (علاوه بر conversation_id) طبق الزام امنیتی چندمستأجری —
  // هر کوئری روی messages باید مستقیماً بتونه با site_id فیلتر بشه، بدون join اجباری
  @Index()
  @Column({ type: 'uuid' })
  siteId!: string;

  @Index()
  @Column({ type: 'uuid' })
  conversationId!: string;

  @Column({ type: 'enum', enum: MessageSenderType })
  senderType!: MessageSenderType;

  // شناسه agent یا visitor فرستنده؛ برای پیام‌های bot مقدار null
  @Column({ type: 'uuid', nullable: true })
  senderId!: string | null;

  // محتوای پیام همیشه پیش از ذخیره sanitize می‌شود (جلوگیری از XSS ذخیره‌شده)
  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  attachmentUrl!: string | null;

  // شناسه‌ی تولیدشده توسط کلاینت برای idempotency — اگر کلاینت به‌خاطر قطعی شبکه
  // همان پیام را دوباره بفرستد، پیام تکراری ساخته نمی‌شود (فاز ۷)
  @Column({ type: 'varchar', length: 64, nullable: true })
  clientMessageId!: string | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
