import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  MessageSenderType,
  safeHttpUrl,
  type ChatToolMetadata,
  type ChatFormDto,
  type SaveChatFormDto,
  type MessagePayload,
} from '@mira/shared-types';
import { MessageEntity, ConversationReadEntity } from '../../database/entities';
import { ModerationService } from '../moderation/moderation.service';
import { clientId, formInput, formAnswers, text } from './chat-tools.validation';
@Injectable()
export class ChatToolsService {
  constructor(
    private readonly db: DataSource,
    private readonly moderation: ModerationService,
    private readonly events: EventEmitter2,
  ) {}
  async agent(
    siteId: string,
    id: string,
    manager: EntityManager = this.db.manager,
  ): Promise<{ role: string }> {
    const [agent] = await manager.query('SELECT role FROM agents WHERE id=$1 AND "siteId"=$2', [
      id,
      siteId,
    ]);
    if (!agent) throw new ForbiddenException('اپراتور پیدا نشد');
    return agent;
  }
  async list(siteId: string, agentId: string): Promise<ChatFormDto[]> {
    await this.agent(siteId, agentId);
    return this.db.query(
      'SELECT id,title,description,fields,revision,"creatorId","archivedAt" FROM chat_forms WHERE "siteId"=$1 AND "archivedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 100',
      [siteId],
    );
  }
  async save(
    siteId: string,
    agentId: string,
    raw: SaveChatFormDto,
    id?: string,
  ): Promise<ChatFormDto> {
    const dto = formInput(raw);
    return this.db.transaction(async (m) => {
      const agent = await this.agent(siteId, agentId, m);
      if (id) {
        const [existing] = await m.query(
          'SELECT * FROM chat_forms WHERE id=$1 AND "siteId"=$2 AND "archivedAt" IS NULL FOR UPDATE',
          [id, siteId],
        );
        if (!existing) throw new NotFoundException('فرم پیدا نشد');
        if (existing.creatorId !== agentId && agent.role !== 'admin')
          throw new ForbiddenException('ویرایش فرم مجاز نیست');
        return (
          await m.query(
            'UPDATE chat_forms SET title=$3,description=$4,fields=$5,revision=revision+1,"updatedAt"=now() WHERE id=$1 AND "siteId"=$2 RETURNING *',
            [id, siteId, dto.title, dto.description, JSON.stringify(dto.fields)],
          )
        )[0];
      }
      return (
        await m.query(
          'INSERT INTO chat_forms("siteId","creatorId",title,description,fields) VALUES($1,$2,$3,$4,$5) RETURNING *',
          [siteId, agentId, dto.title, dto.description, JSON.stringify(dto.fields)],
        )
      )[0];
    });
  }
  async archive(siteId: string, agentId: string, id: string): Promise<void> {
    const agent = await this.agent(siteId, agentId);
    const result = await this.db.query(
      'UPDATE chat_forms SET "archivedAt"=now(),revision=revision+1 WHERE id=$1 AND "siteId"=$2 AND ("creatorId"=$3 OR $4) RETURNING id',
      [id, siteId, agentId, agent.role === 'admin'],
    );
    if (!result.length) throw new NotFoundException('فرم پیدا نشد یا دسترسی ندارید');
  }
  payload(message: MessageEntity): MessagePayload {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderType: message.senderType,
      senderId: message.senderId,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      toolMetadata: message.toolMetadata,
    };
  }
  publish(
    siteId: string,
    visitorId: string,
    message: MessageEntity,
    updated?: MessageEntity,
  ): void {
    this.events.emit('chat-tool.message', {
      siteId,
      visitorId,
      message: this.payload(message),
      updated: updated ? this.payload(updated) : undefined,
    });
  }
  async send(
    siteId: string,
    agentId: string,
    conversationId: string,
    rawId: unknown,
    build: (m: EntityManager) => Promise<ChatToolMetadata>,
  ): Promise<MessagePayload> {
    const id = clientId(rawId);
    const result = await this.db.transaction(async (m) => {
      await this.agent(siteId, agentId, m);
      const { conversation, visitor } = await this.moderation.lockConversation(
        m,
        siteId,
        conversationId,
      );
      const repo = m.getRepository(MessageEntity);
      const existing = await repo.findOne({
        where: { siteId, conversationId, clientMessageId: id },
      });
      if (existing) {
        if (existing.senderId !== agentId || existing.senderType !== MessageSenderType.AGENT)
          throw new ForbiddenException('شناسه پیام معتبر نیست');
        return { message: existing, visitorId: visitor.id, duplicate: true };
      }
      const metadata = await build(m);
      conversation.aiPaused = true;
      conversation.assignedAgentId = agentId;
      if (conversation.status === 'open')
        conversation.status = 'pending' as typeof conversation.status;
      await m.getRepository('ConversationEntity').save(conversation);
      const message = await repo.save(
        repo.create({
          siteId,
          conversationId,
          senderId: agentId,
          senderType: MessageSenderType.AGENT,
          clientMessageId: id,
          content:
            metadata.kind === 'link'
              ? metadata.title
              : `فرم ${metadata.kind === 'form-request' ? metadata.title : ''}`,
          toolMetadata: metadata,
        }),
      );
      await m
        .getRepository(ConversationReadEntity)
        .upsert({ conversationId, agentId, lastReadAt: new Date() }, ['conversationId', 'agentId']);
      return { message, visitorId: visitor.id, duplicate: false };
    });
    if (!result.duplicate) this.publish(siteId, result.visitorId, result.message);
    return this.payload(result.message);
  }
  link(
    siteId: string,
    agentId: string,
    id: string,
    dto: { url: string; title?: string; description?: string; clientMessageId: string },
  ) {
    const raw = text(dto?.url, 2048, true);
    const url = safeHttpUrl(raw);
    if (!url) throw new BadRequestException('لینک باید نشانی معتبر HTTP یا HTTPS باشد');
    const host = new URL(url).host;
    return this.send(siteId, agentId, id, dto.clientMessageId, async () => ({
      kind: 'link',
      url,
      host,
      title: dto.title === undefined ? host : text(dto.title, 160, true),
      description: dto.description === undefined ? '' : text(dto.description, 500),
    }));
  }
  form(
    siteId: string,
    agentId: string,
    id: string,
    dto: { templateId: string; clientMessageId: string },
  ) {
    if (
      !dto ||
      typeof dto.templateId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dto.templateId)
    )
      throw new BadRequestException('شناسه فرم معتبر نیست');
    return this.send(siteId, agentId, id, dto.clientMessageId, async (m) => {
      const [form] = await m.query(
        'SELECT * FROM chat_forms WHERE id=$1 AND "siteId"=$2 AND "archivedAt" IS NULL FOR SHARE',
        [dto.templateId, siteId],
      );
      if (!form) throw new NotFoundException('فرم پیدا نشد');
      return {
        kind: 'form-request',
        templateId: form.id,
        revision: form.revision,
        title: form.title,
        description: form.description,
        fields: form.fields,
        submittedAt: null,
      };
    });
  }
  async submit(
    siteId: string,
    visitorId: string,
    conversationId: string,
    messageId: string,
    dto: { answers: unknown; clientMessageId: string },
  ): Promise<MessagePayload> {
    const id = clientId(dto?.clientMessageId);
    const result = await this.db.transaction(async (m) => {
      const { visitor, conversation } = await this.moderation.lockConversation(
        m,
        siteId,
        conversationId,
      );
      if (visitor.id !== visitorId) throw new ForbiddenException('دسترسی به گفتگو مجاز نیست');
      this.moderation.assertAllowed(visitor);
      const repo = m.getRepository(MessageEntity);
      const request = await repo.findOne({
        where: { id: messageId, siteId, conversationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!request || request.toolMetadata?.kind !== 'form-request')
        throw new NotFoundException('درخواست فرم پیدا نشد');
      const metadata = request.toolMetadata;
      if (metadata.submittedAt) {
        const previous = await repo
          .createQueryBuilder('m')
          .where(
            'm."siteId"=:siteId AND m."conversationId"=:conversationId AND m."toolMetadata"->>\'requestMessageId\'=:messageId',
            { siteId, conversationId, messageId },
          )
          .getOne();
        if (!previous) throw new BadRequestException('این فرم قبلاً ارسال شده است');
        return { message: previous, request, duplicate: true };
      }
      const collision = await repo.findOne({
        where: { siteId, conversationId, clientMessageId: id },
      });
      if (collision) throw new BadRequestException('شناسه پیام تکراری است');
      const answers = formAnswers(metadata.fields, dto.answers);
      request.toolMetadata = { ...metadata, submittedAt: new Date().toISOString() };
      await repo.save(request);
      const response = await repo.save(
        repo.create({
          siteId,
          conversationId,
          senderId: visitorId,
          senderType: MessageSenderType.VISITOR,
          clientMessageId: id,
          content: 'پاسخ فرم ثبت شد',
          toolMetadata: {
            kind: 'form-response',
            requestMessageId: messageId,
            title: metadata.title,
            fields: metadata.fields,
            answers,
          },
        }),
      );
      if (conversation.status === 'resolved') {
        conversation.status = 'open' as typeof conversation.status;
        conversation.resolvedAt = null;
        await m.getRepository('ConversationEntity').save(conversation);
      }
      return { message: response, request, duplicate: false };
    });
    if (!result.duplicate) this.publish(siteId, visitorId, result.message, result.request);
    return this.payload(result.message);
  }
}
