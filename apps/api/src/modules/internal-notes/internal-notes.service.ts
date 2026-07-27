import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InternalNoteDto } from '@mira/shared-types';
import { InternalNoteEntity } from '../../database/entities';

@Injectable()
export class InternalNotesService {
  constructor(
    @InjectRepository(InternalNoteEntity)
    private readonly notesRepository: Repository<InternalNoteEntity>,
  ) {}

  async listForConversation(conversationId: string): Promise<InternalNoteDto[]> {
    const rows = await this.notesRepository
      .createQueryBuilder('note')
      .leftJoin('agents', 'agent', 'agent.id = note."agentId"')
      .addSelect('agent."fullName"', 'agentFullName')
      .where('note."conversationId" = :conversationId', { conversationId })
      .orderBy('note."createdAt"', 'ASC')
      .getRawAndEntities();

    return rows.entities.map((note, index) => toDto(note, rows.raw[index]?.agentFullName));
  }

  async create(
    siteId: string,
    conversationId: string,
    agentId: string,
    content: string,
  ): Promise<InternalNoteDto> {
    const note = this.notesRepository.create({ siteId, conversationId, agentId, content });
    const saved = await this.notesRepository.save(note);
    const agentRow: { fullName: string } | undefined = await this.notesRepository.manager
      .query(`SELECT "fullName" FROM agents WHERE id = $1`, [agentId])
      .then((rows) => rows[0]);
    return toDto(saved, agentRow?.fullName);
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
