import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AgentPermissionMap, AgentRole, AgentStatus } from '@mira/shared-types';

// اپراتور/ادمین — هر اپراتور به یک سایت مشخص تعلق دارد (جداسازی چندمستأجری)
@Entity('agents')
export class AgentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  siteId!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 255 })
  fullName!: string;

  @Column({ type: 'enum', enum: AgentRole, default: AgentRole.AGENT })
  role!: AgentRole;

  @Column({ type: 'enum', enum: AgentStatus, default: AgentStatus.OFFLINE })
  status!: AgentStatus;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  avatarUrl!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone!: string | null;

  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  // دسترسی‌های دقیق نقش «اپراتور»؛ ادمین همیشه همه را دارد و این ستون برایش نادیده گرفته می‌شود
  @Column({ type: 'jsonb', default: () => "'{}'" })
  permissions!: AgentPermissionMap;

  // سکرت TOTP — تا وقتی twoFactorEnabled=false هست برای ورود استفاده نمی‌شه (ممکنه از یک setup ناتمام باقی مونده باشه)
  @Column({ type: 'varchar', length: 64, nullable: true })
  twoFactorSecret!: string | null;

  @Column({ type: 'boolean', default: false })
  twoFactorEnabled!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
