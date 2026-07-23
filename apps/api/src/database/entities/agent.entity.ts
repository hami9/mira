import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AgentRole, AgentStatus } from '@mira/shared-types';

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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
