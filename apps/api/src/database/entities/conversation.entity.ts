import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ConversationStatus } from '@mira/shared-types';

@Entity('conversations')
export class ConversationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  siteId!: string;

  @Index()
  @Column({ type: 'uuid' })
  visitorId!: string;

  @Column({ type: 'uuid', nullable: true })
  assignedAgentId!: string | null;

  @Index()
  @Column({ type: 'enum', enum: ConversationStatus, default: ConversationStatus.OPEN })
  status!: ConversationStatus;

  // دپارتمان/برچسب‌ها — ستون از فاز ۱ وجود دارد، منطق کامل مسیریابی در فاز ۲
  @Column({ type: 'varchar', length: 100, nullable: true })
  department!: string | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  tags!: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  // تشخیص فوریت/نارضایتی شدید بر اساس کلیدواژه در پیام‌های بازدیدکننده (فاز ۴)
  @Column({ type: 'varchar', length: 10, default: 'normal' })
  priority!: 'normal' | 'high';

  // خلاصه‌ی خودکار گفتگو هنگام resolve شدن (برای گفتگوهای طولانی) — فاز ۴
  @Column({ type: 'text', nullable: true })
  summary!: string | null;
}
