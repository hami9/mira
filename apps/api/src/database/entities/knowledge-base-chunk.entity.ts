import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// توجه: ستون embedding (vector) عمداً در این Entity نیست — فقط worker مستقیم با SQL خام
// آن را می‌خواند/می‌نویسد (TypeORM از نوع pgvector پشتیبانی مستقیم ندارد). این Entity فقط
// برای شمارش/حذف chunkها از سمت api استفاده می‌شه.
@Entity('knowledge_base_chunks')
export class KnowledgeBaseChunkEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  siteId!: string;

  @Index()
  @Column({ type: 'uuid' })
  documentId!: string;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
