import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AutomationActionType, AutomationTriggerType } from '@mira/shared-types';

// قانون اتوماسیون ساده (فاز ۶): اگر کلیدواژه در پیام بازدیدکننده باشد، یک اکشن روی مکالمه اجرا شود
@Entity('automation_rules')
export class AutomationRuleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  siteId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 30, default: 'keyword_in_message' })
  triggerType!: AutomationTriggerType;

  @Column({ type: 'text' })
  triggerValue!: string;

  @Column({ type: 'varchar', length: 30 })
  actionType!: AutomationActionType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  actionValue!: string | null;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
