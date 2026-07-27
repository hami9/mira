import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { In, Repository } from 'typeorm';
import { ConversationStatus } from '@mira/shared-types';
import {
  ConversationEntity,
  ConversationReadEntity,
  CsatRatingEntity,
} from '../../database/entities';

export const CONVERSATION_RESOLVED_EVENT = 'conversation.resolved';

export interface ConversationResolvedEvent {
  conversationId: string;
  siteId: string;
}

export interface ListConversationsOptions {
  status?: ConversationStatus;
  department?: string;
  // جست‌وجو در نام/ایمیل بازدیدکننده یا دپارتمان مکالمه
  search?: string;
  limit?: number;
  cursor?: string; // createdAt ISO — صفحه‌بندی ساده بر اساس زمان ایجاد
}

export interface UpdateConversationDetailsInput {
  department?: string | null;
  tags?: string[];
}

export interface ConversationWithUnreadCount extends ConversationEntity {
  unreadCount: number;
}

const DEFAULT_LIST_LIMIT = 30;
const MAX_LIST_LIMIT = 100;
const PENDING_RATING_WINDOW_HOURS = 24;

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(ConversationEntity)
    private readonly conversationsRepository: Repository<ConversationEntity>,
    @InjectRepository(CsatRatingEntity)
    private readonly csatRepository: Repository<CsatRatingEntity>,
    @InjectRepository(ConversationReadEntity)
    private readonly readsRepository: Repository<ConversationReadEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createConversation(siteId: string, visitorId: string): Promise<ConversationEntity> {
    const conversation = this.conversationsRepository.create({
      siteId,
      visitorId,
      status: ConversationStatus.OPEN,
    });
    return this.conversationsRepository.save(conversation);
  }

  // برای وقتی ویجت دوباره باز می‌شه: اگه مکالمه باز/در انتظار داره همون رو برگردون، تا تاریخچه گم نشه
  async findActiveForVisitor(visitorId: string): Promise<ConversationEntity | null> {
    return this.conversationsRepository.findOne({
      where: { visitorId, status: In([ConversationStatus.OPEN, ConversationStatus.PENDING]) },
      order: { createdAt: 'DESC' },
    });
  }

  // مکالمه‌ی به‌تازگی حل‌شده‌ای که هنوز CSAT نگرفته — برای نشون دادن دوباره‌ی پرامپت امتیازدهی بعد از رفرش
  async findPendingRatingForVisitor(visitorId: string): Promise<ConversationEntity | null> {
    const windowStart = new Date(Date.now() - PENDING_RATING_WINDOW_HOURS * 60 * 60 * 1000);
    return this.conversationsRepository
      .createQueryBuilder('conversation')
      .leftJoin('csat_ratings', 'csat', 'csat."conversationId" = conversation.id')
      .where('conversation.visitorId = :visitorId', { visitorId })
      .andWhere('conversation.status = :status', { status: ConversationStatus.RESOLVED })
      .andWhere('conversation.resolvedAt > :windowStart', { windowStart })
      .andWhere('csat.id IS NULL')
      .orderBy('conversation.resolvedAt', 'DESC')
      .getOne();
  }

  async findByIdForSite(id: string, siteId: string): Promise<ConversationEntity> {
    const conversation = await this.conversationsRepository.findOne({ where: { id } });
    if (!conversation) {
      throw new NotFoundException('مکالمه پیدا نشد');
    }
    if (conversation.siteId !== siteId) {
      throw new ForbiddenException('دسترسی به این مکالمه مجاز نیست');
    }
    return conversation;
  }

  async ensureVisitorOwnsConversation(id: string, visitorId: string): Promise<ConversationEntity> {
    const conversation = await this.conversationsRepository.findOne({ where: { id } });
    if (!conversation || conversation.visitorId !== visitorId) {
      throw new ForbiddenException('دسترسی به این مکالمه مجاز نیست');
    }
    return conversation;
  }

  // فهرست مکالمات + تعداد پیام نخوانده‌ی هر مکالمه از دید همین اپراتور (برای badge در داشبورد)
  async listForSite(
    siteId: string,
    agentId: string,
    options: ListConversationsOptions = {},
  ): Promise<ConversationWithUnreadCount[]> {
    const limit = Math.min(options.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const query = this.conversationsRepository
      .createQueryBuilder('conversation')
      .leftJoin(
        'conversation_reads',
        'read',
        'read."conversationId" = conversation.id AND read."agentId" = :agentId',
        { agentId },
      )
      .addSelect(
        `(
          SELECT COUNT(*) FROM "messages" m
          WHERE m."conversationId" = conversation.id
            AND m."senderType" != 'agent'
            AND m."createdAt" > COALESCE(read."lastReadAt", 'epoch')
        )`,
        'unreadCount',
      )
      .where('conversation.siteId = :siteId', { siteId })
      .orderBy('conversation.createdAt', 'DESC')
      .take(limit);

    if (options.status) {
      query.andWhere('conversation.status = :status', { status: options.status });
    }
    if (options.cursor) {
      query.andWhere('conversation.createdAt < :cursor', { cursor: options.cursor });
    }
    if (options.department) {
      query.andWhere('conversation.department = :department', { department: options.department });
    }
    if (options.search) {
      query
        .leftJoin('visitors', 'visitor', 'visitor.id = conversation.visitorId')
        .andWhere(
          '(visitor.name ILIKE :search OR visitor.email ILIKE :search OR conversation.department ILIKE :search)',
          { search: `%${options.search}%` },
        );
    }

    const { entities, raw } = await query.getRawAndEntities();
    return entities.map((entity, index) => ({
      ...entity,
      unreadCount: parseInt(raw[index]?.unreadCount ?? '0', 10),
    }));
  }

  async assignAgent(
    conversationId: string,
    siteId: string,
    agentId: string,
  ): Promise<ConversationEntity> {
    const conversation = await this.findByIdForSite(conversationId, siteId);
    conversation.assignedAgentId = agentId;
    if (conversation.status === ConversationStatus.OPEN) {
      conversation.status = ConversationStatus.PENDING;
    }
    return this.conversationsRepository.save(conversation);
  }

  async updateDetails(
    conversationId: string,
    siteId: string,
    input: UpdateConversationDetailsInput,
  ): Promise<ConversationEntity> {
    const conversation = await this.findByIdForSite(conversationId, siteId);
    if (input.department !== undefined) {
      conversation.department = input.department;
    }
    if (input.tags !== undefined) {
      conversation.tags = input.tags;
    }
    return this.conversationsRepository.save(conversation);
  }

  // اعمال ترکیبی نتیجه‌ی چند قانون اتوماسیون روی یک مکالمه با یک save (فاز ۶) — به‌جای یک نوشتن جدا به‌ازای هر قانون
  async applyAutomationEffects(
    conversationId: string,
    siteId: string,
    effects: { department?: string; addTags?: string[]; setPriorityHigh?: boolean },
  ): Promise<ConversationEntity> {
    const conversation = await this.findByIdForSite(conversationId, siteId);
    if (effects.department !== undefined) {
      conversation.department = effects.department;
    }
    if (effects.addTags?.length) {
      const merged = new Set([...conversation.tags, ...effects.addTags]);
      conversation.tags = [...merged];
    }
    if (effects.setPriorityHigh) {
      conversation.priority = 'high';
    }
    return this.conversationsRepository.save(conversation);
  }

  async resolve(conversationId: string, siteId: string): Promise<ConversationEntity> {
    const conversation = await this.findByIdForSite(conversationId, siteId);
    if (conversation.status === ConversationStatus.RESOLVED) {
      return conversation;
    }
    conversation.status = ConversationStatus.RESOLVED;
    conversation.resolvedAt = new Date();
    const saved = await this.conversationsRepository.save(conversation);

    // ChatGateway به این رویداد گوش می‌ده و به اتاق مکالمه/سایت اطلاع می‌ده (بدون وابستگی حلقوی بین ماژول‌ها)
    const event: ConversationResolvedEvent = { conversationId: saved.id, siteId: saved.siteId };
    this.eventEmitter.emit(CONVERSATION_RESOLVED_EVENT, event);

    return saved;
  }

  // وقتی بازدیدکننده به یک مکالمه‌ی حل‌شده دوباره پیام می‌ده، خودکار بازش کن
  async reopenIfResolved(conversation: ConversationEntity): Promise<ConversationEntity> {
    if (conversation.status !== ConversationStatus.RESOLVED) {
      return conversation;
    }
    conversation.status = ConversationStatus.OPEN;
    conversation.resolvedAt = null;
    return this.conversationsRepository.save(conversation);
  }

  async submitCsatAsVisitor(
    conversationId: string,
    visitorId: string,
    score: number,
    comment?: string,
  ): Promise<void> {
    const conversation = await this.ensureVisitorOwnsConversation(conversationId, visitorId);
    if (conversation.status !== ConversationStatus.RESOLVED) {
      throw new ConflictException('فقط مکالمه‌ی حل‌شده قابل امتیازدهی است');
    }

    const existing = await this.csatRepository.findOne({ where: { conversationId } });
    if (existing) {
      throw new ConflictException('این مکالمه قبلاً امتیازدهی شده است');
    }

    const rating = this.csatRepository.create({
      siteId: conversation.siteId,
      conversationId,
      score,
      comment: comment ?? null,
    });
    await this.csatRepository.save(rating);
  }

  // اپراتور مکالمه رو دیده (باز کرده، یا الان مشغول دیدنشه) — badge نخوانده صفر می‌شه
  async markAsRead(conversationId: string, siteId: string, agentId: string): Promise<void> {
    await this.findByIdForSite(conversationId, siteId); // مطمئن شو مکالمه متعلق به همین سایته
    await this.touchRead(conversationId, agentId);
  }

  // نسخه‌ی سبک‌تر برای داخل ChatGateway که خودش قبلاً مالکیت مکالمه رو تأیید کرده
  async touchRead(conversationId: string, agentId: string): Promise<void> {
    await this.readsRepository.upsert({ conversationId, agentId, lastReadAt: new Date() }, [
      'conversationId',
      'agentId',
    ]);
  }

  // فراخوانی فقط وقتی محتوای پیام کلیدواژه‌ی فوریت داشته باشه (چک شده در ChatGateway)
  async escalateIfUrgent(conversationId: string): Promise<ConversationEntity | null> {
    const conversation = await this.conversationsRepository.findOne({
      where: { id: conversationId },
    });
    if (!conversation || conversation.priority === 'high') {
      return null;
    }
    conversation.priority = 'high';
    return this.conversationsRepository.save(conversation);
  }
}
