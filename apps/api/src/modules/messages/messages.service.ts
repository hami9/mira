import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageSenderType } from '@mira/shared-types';
import { MessageEntity } from '../../database/entities';
import { ModerationService } from '../moderation/moderation.service';

export interface CreateMessageInput {
  siteId: string;
  conversationId: string;
  senderType: MessageSenderType;
  senderId: string | null;
  rawContent: string;
  // شناسه‌ی تولیدشده توسط کلاینت؛ اگر ست شود، ارسال دوباره‌ی همان پیام تکراری ایجاد نمی‌کند
  clientMessageId?: string | null;
}

export interface ListMessagesOptions {
  limit?: number;
  before?: string; // createdAt ISO — برای بارگذاری صفحه قبلی تاریخچه
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(MessageEntity)
    private readonly messagesRepository: Repository<MessageEntity>,
    private readonly moderation: ModerationService,
  ) {}

  async create(input: CreateMessageInput): Promise<MessageEntity> {
    return (await this.moderation.acceptMessage(input)).message;
  }

  async countForConversation(conversationId: string): Promise<number> {
    return this.messagesRepository
      .createQueryBuilder('message')
      .innerJoin(
        'conversations',
        'conversation',
        'conversation.id=message.conversationId AND conversation.siteId=message.siteId AND conversation.deletedAt IS NULL',
      )
      .where('message.conversationId=:conversationId', { conversationId })
      .getCount();
  }

  async listForConversation(
    conversationId: string,
    options: ListMessagesOptions = {},
  ): Promise<MessageEntity[]> {
    const limit = Math.min(options.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const query = this.messagesRepository
      .createQueryBuilder('message')
      .innerJoin(
        'conversations',
        'conversation',
        'conversation.id=message.conversationId AND conversation.siteId=message.siteId AND conversation.deletedAt IS NULL',
      )
      .where('message.conversationId=:conversationId', { conversationId })
      .orderBy('message.createdAt', 'DESC')
      .take(limit);
    if (options.before)
      query.andWhere('message.createdAt < :before', { before: new Date(options.before) });
    const messages = await query.getMany();
    return messages.reverse();
  }
}
