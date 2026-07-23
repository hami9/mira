import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// آخرین لحظه‌ای که یک اپراتور مشخص یک مکالمه‌ی مشخص رو دیده — پایه‌ی محاسبه‌ی unreadCount
// lastReadAt عمداً @UpdateDateColumn نیست: چون از upsert() استفاده می‌کنیم، مقدارش رو صریحاً
// در سرویس ست می‌کنیم تا رفتارش با هوک‌های خاص TypeORM قاطی نشه
@Entity('conversation_reads')
@Index(['conversationId', 'agentId'], { unique: true })
export class ConversationReadEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  conversationId!: string;

  @Index()
  @Column({ type: 'uuid' })
  agentId!: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  lastReadAt!: Date;
}
