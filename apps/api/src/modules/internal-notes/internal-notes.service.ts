import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InternalNoteDto } from '@mira/shared-types';
import { InternalNoteEntity } from '../../database/entities';
import { ModerationService } from '../moderation/moderation.service';
import { sanitizeMessageContent } from '../../common/sanitize/sanitize-message.util';

@Injectable()
export class InternalNotesService {
  constructor(
    @InjectRepository(InternalNoteEntity)
    private readonly notesRepository: Repository<InternalNoteEntity>,
    private readonly moderation: ModerationService,
  ) {}

  async listForConversation(siteId: string, conversationId: string): Promise<InternalNoteDto[]> {
    return this.notesRepository.manager.transaction(async (manager) => {
      await this.moderation.lockConversation(manager, siteId, conversationId);
      const rows = await manager
        .getRepository(InternalNoteEntity)
        .createQueryBuilder('note')
        .leftJoin('agents', 'agent', 'agent.id = note."agentId" AND agent."siteId" = note."siteId"')
        .addSelect('agent."fullName"', 'agentFullName')
        .where('note."conversationId" = :conversationId AND note."siteId" = :siteId', {
          conversationId,
          siteId,
        })
        .orderBy('note."createdAt"', 'ASC')
        .getRawAndEntities();
      return rows.entities.map((note, index) => toDto(note, rows.raw[index]?.agentFullName));
    });
  }

  async create(
    siteId: string,
    conversationId: string,
    agentId: string,
    content: string,
  ): Promise<InternalNoteDto> {
    return this.notesRepository.manager.transaction(async (manager) => {
      await this.moderation.lockConversation(manager, siteId, conversationId);
      const [agentRow]: { fullName: string }[] = await manager.query(
        `SELECT "fullName" FROM agents WHERE id=$1 AND "siteId"=$2`,
        [agentId, siteId],
      );
      if (!agentRow) throw new NotFoundException('اپراتور پیدا نشد');
      const notes = manager.getRepository(InternalNoteEntity);
      const saved = await notes.save(
        notes.create({ siteId, conversationId, agentId, content: sanitizeMessageContent(content) }),
      );
      return toDto(saved, agentRow.fullName);
    });
  }
}

function toDto(note: InternalNoteEntity, agentFullName: string | undefined): InternalNoteDto {
  return {
    id: note.id,
    conversationId: note.conversationId,
    agentId: note.agentId,
    agentName: agentFullName ?? 'اپراتور',
    content: note.content,
    createdAt: note.createdAt.toISOString(),
  };
}
