import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ai_usage')
export class AiUsageEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column({ type: 'uuid' }) siteId!: string;
  @Column({ type: 'uuid', nullable: true }) conversationId!: string | null;
  @Column({ type: 'uuid', nullable: true }) visitorId!: string | null;
  @Column({ type: 'uuid', nullable: true }) agentId!: string | null;
  @Column({ type: 'varchar', length: 20 }) kind!: string;
  @Column({ type: 'varchar', length: 150 }) model!: string;
  @Column({ type: 'varchar', length: 20 }) provider!: string;
  @Column({ type: 'varchar', length: 10 }) status!: string;
  @Column({ type: 'integer', nullable: true }) inputTokens!: number | null;
  @Column({ type: 'integer', nullable: true }) outputTokens!: number | null;
  @Column({ type: 'integer', nullable: true }) totalTokens!: number | null;
  @Column({ type: 'varchar', length: 150, nullable: true }) requestId!: string | null;
  @Column({ type: 'numeric', precision: 20, scale: 10, nullable: true }) costUsd!: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
