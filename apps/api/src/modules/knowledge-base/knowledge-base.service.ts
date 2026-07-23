import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateKnowledgeDocumentDto, KnowledgeDocumentDto } from '@mira/shared-types';
import { KnowledgeBaseChunkEntity, KnowledgeBaseDocumentEntity } from '../../database/entities';
import { AiQueueService } from '../../common/queue/ai-queue.service';

@Injectable()
export class KnowledgeBaseService {
  constructor(
    @InjectRepository(KnowledgeBaseDocumentEntity)
    private readonly documentsRepository: Repository<KnowledgeBaseDocumentEntity>,
    @InjectRepository(KnowledgeBaseChunkEntity)
    private readonly chunksRepository: Repository<KnowledgeBaseChunkEntity>,
    private readonly aiQueue: AiQueueService,
  ) {}

  async create(siteId: string, dto: CreateKnowledgeDocumentDto): Promise<KnowledgeDocumentDto> {
    const document = await this.documentsRepository.save(
      this.documentsRepository.create({
        siteId,
        title: dto.title,
        content: dto.content,
        sourceType: 'text',
        status: 'pending',
      }),
    );
    // chunk کردن و تولید embedding کند است (فراخوانی AI) — در صف BullMQ انجام می‌شه، نه اینجا
    await this.aiQueue.enqueueEmbedDocument({ siteId, documentId: document.id });
    return this.toDto(document, 0);
  }

  async listForSite(siteId: string): Promise<KnowledgeDocumentDto[]> {
    const documents = await this.documentsRepository.find({
      where: { siteId },
      order: { createdAt: 'DESC' },
    });
    const counts = await this.chunksRepository
      .createQueryBuilder('chunk')
      .select('chunk.documentId', 'documentId')
      .addSelect('COUNT(*)', 'count')
      .where('chunk.siteId = :siteId', { siteId })
      .groupBy('chunk.documentId')
      .getRawMany<{ documentId: string; count: string }>();
    const countByDocument = new Map(counts.map((row) => [row.documentId, parseInt(row.count, 10)]));
    return documents.map((document) => this.toDto(document, countByDocument.get(document.id) ?? 0));
  }

  async delete(siteId: string, documentId: string): Promise<void> {
    const document = await this.documentsRepository.findOne({ where: { id: documentId } });
    if (!document || document.siteId !== siteId) {
      throw new NotFoundException('سند پیدا نشد');
    }
    // chunkهای مرتبط با ON DELETE CASCADE در دیتابیس حذف می‌شن
    await this.documentsRepository.remove(document);
  }

  private toDto(document: KnowledgeBaseDocumentEntity, chunkCount: number): KnowledgeDocumentDto {
    return {
      id: document.id,
      title: document.title,
      content: document.content,
      status: document.status,
      chunkCount,
      createdAt: document.createdAt.toISOString(),
    };
  }
}
