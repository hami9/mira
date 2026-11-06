import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { createHash, randomUUID } from 'node:crypto';
import {
  DEFAULT_MODERATION_POLICY,
  MessageSenderType,
  visitorModerationState,
  type ModerateVisitorDto,
  type UpdateVisitorDetailsDto,
  type VisitorUpdatedPayload,
  type MessageSendErrorCode,
} from '@mira/shared-types';
import { REDIS_CLIENT } from '../../common/redis/redis.constants';
import { ConversationEntity, MessageEntity, VisitorEntity } from '../../database/entities';
import { sanitizeMessageContent } from '../../common/sanitize/sanitize-message.util';
import type { CreateMessageInput } from '../messages/messages.service';

const SPAM_WINDOW = `
local now=tonumber(ARGV[1]);local member=ARGV[2]
redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',now-10000)
redis.call('ZREMRANGEBYSCORE',KEYS[2],'-inf',now-15000)
redis.call('ZADD',KEYS[1],now,member);redis.call('ZADD',KEYS[2],now,member)
redis.call('PEXPIRE',KEYS[1],16000);redis.call('PEXPIRE',KEYS[2],16000)
if redis.call('ZCARD',KEYS[1])>=15 or redis.call('ZCARD',KEYS[2])>=6 then return 1 end
return 0`;

export function moderationException(
  code: MessageSendErrorCode,
  message: string,
  retryUntil?: string,
): ForbiddenException {
  return new ForbiddenException({ code, message, ...(retryUntil ? { retryUntil } : {}) });
}

@Injectable()
export class ModerationService {
  constructor(
    private readonly db: DataSource,
    private readonly events: EventEmitter2,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async visitor(siteId: string, visitorId: string): Promise<VisitorEntity> {
    const visitor = await this.db
      .getRepository(VisitorEntity)
      .findOne({ where: { id: visitorId, siteId } });
    if (!visitor) throw new NotFoundException('بازدیدکننده پیدا نشد');
    return visitor;
  }

  assertAllowed(visitor: VisitorEntity): void {
    const state = visitorModerationState(visitor);
    if (state.blocked)
      throw moderationException(
        'VISITOR_BLOCKED',
        'ارسال پیام برای این بازدیدکننده مسدود است',
        state.blockedUntil ?? undefined,
      );
    if (state.mutedUntil)
      throw moderationException(
        'VISITOR_MUTED',
        'ارسال پیام موقتاً بی‌صدا شده است',
        state.mutedUntil,
      );
  }

  async assertVisitorAllowed(siteId: string, visitorId: string): Promise<void> {
    this.assertAllowed(await this.visitor(siteId, visitorId));
  }

  async lockConversation(
    manager: EntityManager,
    siteId: string,
    id: string,
    allowDeleted = false,
  ): Promise<{ visitor: VisitorEntity; conversation: ConversationEntity }> {
    const initial = await manager
      .getRepository(ConversationEntity)
      .findOne({ where: { id, siteId } });
    if (!initial) throw new NotFoundException('گفتگو پیدا نشد');
    const visitor = await manager
      .getRepository(VisitorEntity)
      .findOne({ where: { id: initial.visitorId, siteId }, lock: { mode: 'pessimistic_write' } });
    if (!visitor) throw new NotFoundException('بازدیدکننده پیدا نشد');
    const conversation = await manager
      .getRepository(ConversationEntity)
      .findOne({ where: { id, siteId }, lock: { mode: 'pessimistic_write' } });
    if (!conversation) throw new NotFoundException('گفتگو پیدا نشد');
    if (!allowDeleted && conversation.deletedAt)
      throw moderationException('CONVERSATION_DELETED', 'این گفتگو به زباله‌دان منتقل شده است');
    return { visitor, conversation };
  }

  publicDetails(visitor: VisitorEntity): VisitorUpdatedPayload {
    return {
      visitorId: visitor.id,
      displayName: visitor.displayName,
      flags: visitor.flags ?? [],
      moderation: visitorModerationState(visitor),
    };
  }

  async updateDetails(
    siteId: string,
    id: string,
    dto: UpdateVisitorDetailsDto,
  ): Promise<VisitorUpdatedPayload> {
    const visitor = await this.db.transaction(async (manager) => {
      const row = await manager
        .getRepository(VisitorEntity)
        .findOne({ where: { id, siteId }, lock: { mode: 'pessimistic_write' } });
      if (!row) throw new NotFoundException('بازدیدکننده پیدا نشد');
      if (dto.displayName !== undefined) row.displayName = dto.displayName?.trim() || null;
      if (dto.flags !== undefined) row.flags = dto.flags;
      return manager.getRepository(VisitorEntity).save(row);
    });
    this.publish(siteId, visitor);
    return this.publicDetails(visitor);
  }

  async moderate(
    siteId: string,
    id: string,
    dto: ModerateVisitorDto,
  ): Promise<VisitorUpdatedPayload> {
    const visitor = await this.db.transaction(async (manager) => {
      const row = await manager
        .getRepository(VisitorEntity)
        .findOne({ where: { id, siteId }, lock: { mode: 'pessimistic_write' } });
      if (!row) throw new NotFoundException('بازدیدکننده پیدا نشد');
      const until = dto.durationMinutes ? new Date(Date.now() + dto.durationMinutes * 60000) : null;
      if (dto.action === 'block') {
        row.blockedAt = new Date();
        row.blockedUntil = until;
        row.blockSource = 'manual';
        row.blockReason = dto.reason?.trim() || null;
      }
      if (dto.action === 'unblock') {
        row.blockedAt = null;
        row.blockedUntil = null;
        row.blockSource = null;
        row.blockReason = null;
      }
      if (dto.action === 'mute') row.mutedUntil = until;
      if (dto.action === 'unmute') row.mutedUntil = null;
      row.moderationVersion++;
      return manager.getRepository(VisitorEntity).save(row);
    });
    this.publish(siteId, visitor);
    return this.publicDetails(visitor);
  }

  publish(siteId: string, visitor: VisitorEntity): void {
    this.events.emit('visitor.updated', { siteId, ...this.publicDetails(visitor) });
  }

  async acceptMessage(
    input: CreateMessageInput,
    rateCheck?: () => Promise<boolean>,
  ): Promise<{
    message: MessageEntity;
    conversation: ConversationEntity;
    visitorVersion: number;
    duplicate: boolean;
  }> {
    const result = await this.db.transaction(async (manager) => {
      const { visitor, conversation } = await this.lockConversation(
        manager,
        input.siteId,
        input.conversationId,
        true,
      );
      if (input.senderType === MessageSenderType.VISITOR && input.senderId !== visitor.id)
        throw new ForbiddenException('دسترسی به گفتگو مجاز نیست');
      if (conversation.deletedAt)
        throw moderationException('CONVERSATION_DELETED', 'این گفتگو به زباله‌دان منتقل شده است');
      const messages = manager.getRepository(MessageEntity);
      if (input.clientMessageId) {
        const existing = await messages.findOne({
          where: {
            siteId: input.siteId,
            conversationId: input.conversationId,
            clientMessageId: input.clientMessageId,
          },
        });
        if (existing) {
          if (existing.senderType !== input.senderType || existing.senderId !== input.senderId)
            throw new ForbiddenException('شناسه پیام معتبر نیست');
          return {
            message: existing,
            conversation,
            visitorVersion: visitor.moderationVersion,
            duplicate: true,
          };
        }
      }
      if (rateCheck && !(await rateCheck()))
        throw moderationException(
          'RATE_LIMITED',
          'ارسال پیام بیش از حد مجاز است؛ لحظه‌ای صبر کنید',
        );
      const content = sanitizeMessageContent(input.rawContent);
      if (input.senderType === MessageSenderType.VISITOR) {
        this.assertAllowed(visitor);
        const [site] = await manager.query('SELECT "moderationPolicy" FROM sites WHERE id=$1', [
          input.siteId,
        ]);
        const policy = { ...DEFAULT_MODERATION_POLICY, ...site?.moderationPolicy };
        if (policy.spamEnabled) {
          const hash = createHash('sha256')
            .update(content.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim())
            .digest('hex');
          const key = `mira:spam:${input.siteId}:${visitor.id}`;
          let spam: unknown;
          try {
            spam = await this.redis.eval(
              SPAM_WINDOW,
              2,
              `${key}:burst`,
              `${key}:${hash}`,
              Date.now(),
              randomUUID(),
            );
          } catch {
            throw new ServiceUnavailableException({
              code: 'SEND_FAILED',
              message: 'بررسی ارسال موقتاً در دسترس نیست؛ دوباره تلاش کنید',
            });
          }
          if (Number(spam) === 1) {
            visitor.blockedAt = new Date();
            visitor.blockedUntil = new Date(Date.now() + policy.blockMinutes * 60000);
            visitor.blockSource = 'spam';
            visitor.blockReason = 'ارسال تکراری یا پیاپی';
            visitor.moderationVersion++;
            await manager.getRepository(VisitorEntity).save(visitor);
            return { blocked: visitor };
          }
        }
        if (conversation.status === 'resolved') {
          conversation.status = 'open' as ConversationEntity['status'];
          conversation.resolvedAt = null;
        }
      } else if (input.senderType === MessageSenderType.AGENT) {
        const [agent] = await manager.query('SELECT id FROM agents WHERE id=$1 AND "siteId"=$2', [
          input.senderId,
          input.siteId,
        ]);
        if (!agent) throw new ForbiddenException('اپراتور پیدا نشد');
        conversation.assignedAgentId = input.senderId;
        conversation.aiPaused = true;
        if (conversation.status === 'open')
          conversation.status = 'pending' as ConversationEntity['status'];
      }
      await manager.getRepository(ConversationEntity).save(conversation);
      const message = await messages.save(
        messages.create({
          siteId: input.siteId,
          conversationId: input.conversationId,
          senderType: input.senderType,
          senderId: input.senderId,
          content,
          clientMessageId: input.clientMessageId ?? null,
        }),
      );
      return { message, conversation, visitorVersion: visitor.moderationVersion, duplicate: false };
    });
    if ('blocked' in result && result.blocked) {
      this.publish(input.siteId, result.blocked);
      throw moderationException(
        'VISITOR_BLOCKED',
        'ارسال پیاپی باعث مسدود شدن موقت شد',
        result.blocked.blockedUntil?.toISOString(),
      );
    }
    return result as {
      message: MessageEntity;
      conversation: ConversationEntity;
      visitorVersion: number;
      duplicate: boolean;
    };
  }
}
