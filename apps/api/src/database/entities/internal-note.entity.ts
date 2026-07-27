import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// یادداشت داخلی خصوصی روی مکالمه — جدول مجزا از messages تا هیچ مسیر کدی نتونه به‌اشتباه
// محتواش رو برای بازدیدکننده پخش کنه (ایزوله‌ی تضمینی، نه فقط شرط فیلتر)
@Entity('internal_notes')
export class InternalNoteEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  siteId!: string;

  @Index()
  @Column({ type: 'uuid' })
  conversationId!: string;

  @Column({ type: 'uuid' })
  agentId!: string;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
