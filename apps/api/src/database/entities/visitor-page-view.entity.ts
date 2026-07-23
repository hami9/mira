import { Column, Entity, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('visitor_page_views')
export class VisitorPageViewEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  siteId!: string;

  @Index()
  @Column({ type: 'uuid' })
  visitorId!: string;

  @Column({ type: 'varchar', length: 1024 })
  url!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  visitedAt!: Date;
}
