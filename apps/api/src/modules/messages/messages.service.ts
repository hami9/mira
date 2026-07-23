import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { MessageSenderType } from '@mira/shared-types';
import { MessageEntity } from '../../database/entities';
import { sanitizeMessageContent } from '../../common/sanitize/sanitize-message.util';

export interface CreateMessageInput {
  siteId: string;
  conversationId: string;
  senderType: MessageSenderType;
  senderId: string | null;
  rawContent: string;
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
  ) {}

  async create(input: CreateMessageInput): Promise<MessageEntity> {
    // محتوا همیشه پیش از ذخیره sanitize می‌شه — نقطه‌ی واحد جلوگیری از XSS ذخیره‌شده
    const content = sanitizeMessageContent(input.rawContent);
    const message = this.messagesRepository.create({
      siteId: input.siteId,
      conversationId: input.conversationId,
      senderType: input.senderType,
      senderId: input.senderId,
      content,
    });
    return this.messagesRepository.save(message);
  }

  async countForConversation(conversationId: string): Promise<number> {
    return this.messagesRepository.count({ where: { conversationId } });
  }

  async listForConversation(
    conversationId: string,
    options: ListMessagesOptions = {},
  ): Promise<MessageEntity[]> {
    const limit = Math.min(options.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const messages = await this.messagesRepository.find({
      where: {
        conversationId,
        ...(options.before ? { createdAt: LessThan(new Date(options.before)) } : {}),
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return messages.reverse();
  }
}
