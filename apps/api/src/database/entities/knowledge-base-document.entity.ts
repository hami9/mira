import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { KnowledgeDocumentStatus } from '@mira/shared-types';

// یک سند پایگاه دانش (فعلاً فقط متن مستقیم — نه فایل/URL) که برای پاسخ ربات RAG استفاده می‌شه
@Entity('knowledge_base_documents')
export class KnowledgeBaseDocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  siteId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 20, default: 'text' })
  sourceType!: string;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  sourceUrl!: string | null;

  @Column({ type: 'text' })
  content!: string;

  // pending تا زمانی که worker هنوز chunk/embed نکرده؛ ready بعد از تولید موفق embedding؛ failed اگه AI شکست بخوره
  @Column({ type: 'varchar', length: 10, default: 'pending' })
  status!: KnowledgeDocumentStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
