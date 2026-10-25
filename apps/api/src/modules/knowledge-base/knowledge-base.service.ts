import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateKnowledgeDocumentDto,
  KnowledgeDocumentDto,
  UpdateKnowledgeDocumentDto,
} from '@mira/shared-types';
import { KnowledgeBaseChunkEntity, KnowledgeBaseDocumentEntity } from '../../database/entities';
import { AiQueueService } from '../../common/queue/ai-queue.service';

const keywords = (values: string[]) => [
  ...new Set(values.map((value) => value.normalize('NFKC').trim()).filter(Boolean)),
];

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
    if (dto.title.trim().length < 2 || dto.content.trim().length < 10)
      throw new BadRequestException('عنوان یا متن سند کوتاه است');
    const document = await this.documentsRepository.save(
      this.documentsRepository.create({
        siteId,
        title: dto.title.trim(),
        content: dto.content.trim(),
        sourceType: dto.sourceType ?? 'text',
        enabled: dto.enabled ?? true,
        keywords: keywords(dto.keywords ?? []),
        status: 'pending',
      }),
    );
    if (document.enabled) await this.enqueue(document);
    return this.toDto(document, 0);
  }

  async listForSite(siteId: string): Promise<KnowledgeDocumentDto[]> {
    // متن کامل فقط موقع ویرایش دریافت می‌شود؛ فهرست منابع سبک می‌ماند.
    const rows: Record<string, unknown>[] = await this.documentsRepository.query(
      `SELECT d.id,d.title,d.status,d.enabled,d.keywords,d."sourceType",d."usageCount",d."lastUsedAt",d."createdAt",char_length(d.content)::int AS "contentLength",
      (SELECT COUNT(*)::int FROM knowledge_base_chunks c WHERE c."documentId"=d.id AND c."siteId"=$1) AS "chunkCount"
      FROM knowledge_base_documents d WHERE d."siteId"=$1 ORDER BY d."createdAt" DESC`,
      [siteId],
    );
    return rows.map(
      (row) =>
        ({
          ...row,
          createdAt: (row.createdAt as Date).toISOString(),
          lastUsedAt: row.lastUsedAt ? (row.lastUsedAt as Date).toISOString() : null,
        }) as KnowledgeDocumentDto,
    );
  }

  async get(siteId: string, documentId: string): Promise<KnowledgeDocumentDto> {
    const document = await this.documentsRepository.findOne({ where: { id: documentId, siteId } });
    if (!document) throw new NotFoundException('سند پیدا نشد');
    return this.toDto(
      document,
      await this.chunksRepository.count({ where: { documentId, siteId } }),
    );
  }

  async update(
    siteId: string,
    documentId: string,
    dto: UpdateKnowledgeDocumentDto,
  ): Promise<KnowledgeDocumentDto> {
    const { document, reindex } = await this.documentsRepository.manager.transaction(
      async (manager) => {
        const repository = manager.getRepository(KnowledgeBaseDocumentEntity);
        const document = await repository.findOne({
          where: { id: documentId, siteId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!document) throw new NotFoundException('سند پیدا نشد');
        const before = {
          title: document.title,
          content: document.content,
          keywords: JSON.stringify(document.keywords),
          enabled: document.enabled,
        };
        if (dto.title !== undefined) document.title = dto.title.trim();
        if (dto.content !== undefined) document.content = dto.content.trim();
        if (document.title.length < 2 || document.content.length < 10)
          throw new BadRequestException('عنوان یا متن سند کوتاه است');
        if (dto.keywords !== undefined) document.keywords = keywords(dto.keywords);
        if (dto.sourceType !== undefined) document.sourceType = dto.sourceType;
        if (dto.enabled !== undefined) document.enabled = dto.enabled;
        const changed =
          before.title !== document.title ||
          before.content !== document.content ||
          before.keywords !== JSON.stringify(document.keywords);
        if (changed || before.enabled !== document.enabled) document.revision++;
        if (changed) {
          document.status = 'pending';
        }
        const reindex =
          document.enabled && (changed || (!before.enabled && document.status !== 'ready'));
        if (reindex) document.status = 'pending';
        await repository.save(document);
        return { document, reindex };
      },
    );
    if (reindex) await this.enqueue(document);
    return this.get(siteId, documentId);
  }

  async reindex(siteId: string, documentId: string): Promise<KnowledgeDocumentDto> {
    const result = await this.documentsRepository
      .createQueryBuilder()
      .update()
      .set({ status: 'pending', revision: () => 'revision+1' })
      .where('id=:id AND "siteId"=:siteId AND enabled=true', { id: documentId, siteId })
      .execute();
    if (!result.affected) throw new BadRequestException('منبع پیدا نشد یا غیرفعال است');
    const document = await this.documentsRepository.findOneByOrFail({ id: documentId, siteId });
    await this.enqueue(document);
    return this.get(siteId, documentId);
  }

  async delete(siteId: string, documentId: string): Promise<void> {
    const result = await this.documentsRepository.delete({ id: documentId, siteId });
    if (!result.affected) throw new NotFoundException('سند پیدا نشد');
  }

  private async enqueue(document: KnowledgeBaseDocumentEntity): Promise<void> {
    try {
      await this.aiQueue.enqueueEmbedDocument({
        siteId: document.siteId,
        documentId: document.id,
        revision: document.revision,
      });
    } catch {
      await this.documentsRepository.update(
        { id: document.id, siteId: document.siteId, revision: document.revision },
        { status: 'failed' },
      );
      document.status = 'failed';
    }
  }

  private toDto(document: KnowledgeBaseDocumentEntity, chunkCount: number): KnowledgeDocumentDto {
    return {
      id: document.id,
      title: document.title,
      content: document.content,
      status: document.status,
      chunkCount,
      enabled: document.enabled,
      keywords: document.keywords,
      sourceType: document.sourceType,
      usageCount: document.usageCount,
      lastUsedAt: document.lastUsedAt?.toISOString() ?? null,
      contentLength: document.content.length,
      createdAt: document.createdAt.toISOString(),
    };
  }
}
