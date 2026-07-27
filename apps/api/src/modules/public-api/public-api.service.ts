import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PublicConversationDto, PublicMessageDto } from '@mira/shared-types';

const DEFAULT_LIST_LIMIT = 30;
const MAX_LIST_LIMIT = 100;

@Injectable()
export class PublicApiService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async listConversations(
    siteId: string,
    options: { status?: string; limit?: number },
  ): Promise<PublicConversationDto[]> {
    const limit = Math.min(options.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const params: unknown[] = [siteId];
    let statusFilter = '';
    if (options.status) {
      params.push(options.status);
      statusFilter = `AND status = $${params.length}`;
    }
    params.push(limit);

    const rows = await this.dataSource.query(
      `SELECT id, status, department, tags, priority, "createdAt", "updatedAt", "resolvedAt"
       FROM conversations
       WHERE "siteId" = $1 ${statusFilter}
       ORDER BY "createdAt" DESC
       LIMIT $${params.length}`,
      params,
    );

    return rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      status: row.status as string,
      department: row.department as string | null,
      tags: row.tags as string[],
      priority: row.priority as string,
      createdAt: (row.createdAt as Date).toISOString(),
      updatedAt: (row.updatedAt as Date).toISOString(),
      resolvedAt: row.resolvedAt ? (row.resolvedAt as Date).toISOString() : null,
    }));
  }

  async listMessages(siteId: string, conversationId: string): Promise<PublicMessageDto[]> {
    const conversation = await this.dataSource.query(
      `SELECT id FROM conversations WHERE id = $1 AND "siteId" = $2`,
      [conversationId, siteId],
    );
    if (conversation.length === 0) {
      throw new NotFoundException('مکالمه پیدا نشد');
    }

    const rows = await this.dataSource.query(
      `SELECT id, "senderType", content, "createdAt" FROM messages
       WHERE "conversationId" = $1 ORDER BY "createdAt" ASC`,
      [conversationId],
    );
    return rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      senderType: row.senderType as string,
      content: row.content as string,
      createdAt: (row.createdAt as Date).toISOString(),
    }));
  }
}
