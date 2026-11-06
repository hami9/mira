import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { In, IsNull, Not, Repository } from 'typeorm';
import {
  ConversationStatus,
  hasPermission,
  visitorModerationState,
  type ConversationUnreadDto,
} from '@mira/shared-types';
import { ModerationService } from '../moderation/moderation.service';
import {
  ConversationEntity,
  ConversationReadEntity,
  CsatRatingEntity,
} from '../../database/entities';

export const CONVERSATION_RESOLVED_EVENT = 'conversation.resolved';

export interface ConversationResolvedEvent {
  conversationId: string;
  siteId: string;
  conversationVersion: number;
  visitorVersion: number;
}

export interface ListConversationsOptions {
  deleted?: 'only';
  status?: ConversationStatus;
  department?: string;
  // جست‌وجو در نام/ایمیل بازدیدکننده یا دپارتمان مکالمه
  search?: string;
  limit?: number;
  cursor?: string; // createdAt ISO — صفحه‌بندی ساده بر اساس زمان ایجاد
}

export interface UpdateConversationDetailsInput {
  priority?: 'normal' | 'high';
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
    @InjectRepository(ConversationReadEntity)
    private readonly readsRepository: Repository<ConversationReadEntity>,
    private readonly eventEmitter: EventEmitter2,
    private readonly moderation: ModerationService,
  ) {}

  async createConversation(
    siteId: string,
    visitorId: string,
    entryPage?: { url: string; title: string | null },
  ): Promise<ConversationEntity> {
    return this.conversationsRepository.manager.transaction(async (manager) => {
      const visitors = await manager.query(
        `SELECT id FROM visitors WHERE id=$1 AND "siteId"=$2 FOR UPDATE`,
        [visitorId, siteId],
      );
      if (!visitors.length) throw new NotFoundException('بازدیدکننده پیدا نشد');
      await this.moderation.assertVisitorAllowed(siteId, visitorId);
      const repository = manager.getRepository(ConversationEntity);
      const existing = await repository.findOne({
        where: {
          siteId,
          visitorId,
          deletedAt: IsNull(),
          status: In([ConversationStatus.OPEN, ConversationStatus.PENDING]),
        },
        order: { createdAt: 'DESC' },
      });
      if (existing) return existing;
      return repository.save(
        repository.create({
          siteId,
          visitorId,
          status: ConversationStatus.OPEN,
          entryPage: entryPage ?? null,
        }),
      );
    });
  }

  async openForVisitor(
    siteId: string,
    visitorId: string,
    agentId: string,
  ): Promise<ConversationEntity> {
    const id = await this.conversationsRepository.manager.transaction(async (manager) => {
      const visitors = await manager.query(
        `SELECT id FROM visitors WHERE id=$1 AND "siteId"=$2 FOR UPDATE`,
        [visitorId, siteId],
      );
      if (!visitors.length) throw new NotFoundException('بازدیدکننده پیدا نشد');
      const agents = await manager.query(`SELECT id FROM agents WHERE id=$1 AND "siteId"=$2`, [
        agentId,
        siteId,
      ]);
      if (!agents.length) throw new ForbiddenException('دسترسی به این فروشگاه مجاز نیست');
      const active = await manager.query(
        `SELECT id FROM conversations WHERE "visitorId"=$1 AND "siteId"=$2 AND "deletedAt" IS NULL AND status IN ('open','pending') ORDER BY "createdAt" DESC LIMIT 1`,
        [visitorId, siteId],
      );
      if (active.length) return active[0].id as string;
      const pages = await manager.query(
        `SELECT url,title FROM visitor_page_views WHERE "visitorId"=$1 AND "siteId"=$2 ORDER BY "visitedAt" DESC LIMIT 1`,
        [visitorId, siteId],
      );
      const rows = await manager.query(
        `INSERT INTO conversations ("siteId","visitorId","assignedAgentId","aiPaused","entryPage") VALUES ($1,$2,$3,true,$4) RETURNING id`,
        [siteId, visitorId, agentId, pages[0] ? JSON.stringify(pages[0]) : null],
      );
      return rows[0].id as string;
    });
    await this.eventEmitter.emitAsync('conversation.operator-started', {
      siteId,
      visitorId,
      conversationId: id,
    });
    return this.findByIdForSite(id, siteId);
  }

  // برای وقتی ویجت دوباره باز می‌شه: اگه مکالمه باز/در انتظار داره همون رو برگردون، تا تاریخچه گم نشه
  async findActiveForVisitor(
    visitorId: string,
    siteId: string,
  ): Promise<ConversationEntity | null> {
    return this.conversationsRepository.findOne({
      where: {
        visitorId,
        siteId,
        deletedAt: IsNull(),
        status: In([ConversationStatus.OPEN, ConversationStatus.PENDING]),
      },
      order: { createdAt: 'DESC' },
    });
  }

  // مکالمه‌ی به‌تازگی حل‌شده‌ای که هنوز CSAT نگرفته — برای نشون دادن دوباره‌ی پرامپت امتیازدهی بعد از رفرش
  async findPendingRatingForVisitor(
    visitorId: string,
    siteId: string,
  ): Promise<ConversationEntity | null> {
    const windowStart = new Date(Date.now() - PENDING_RATING_WINDOW_HOURS * 60 * 60 * 1000);
    return this.conversationsRepository
      .createQueryBuilder('conversation')
      .leftJoin('csat_ratings', 'csat', 'csat."conversationId" = conversation.id')
      .where('conversation.visitorId = :visitorId', { visitorId })
      .andWhere('conversation.siteId = :siteId', { siteId })
      .andWhere('conversation.deletedAt IS NULL')
      .andWhere('conversation.status = :status', { status: ConversationStatus.RESOLVED })
      .andWhere('conversation.resolvedAt > :windowStart', { windowStart })
      .andWhere('csat.id IS NULL')
      .orderBy('conversation.resolvedAt', 'DESC')
      .getOne();
  }

  async findByIdForSite(id: string, siteId: string): Promise<ConversationEntity> {
    const conversation = await this.conversationsRepository.findOne({
      where: { id, siteId, deletedAt: IsNull() },
    });
    if (!conversation) {
      throw new NotFoundException('مکالمه پیدا نشد');
    }
    if (conversation.siteId !== siteId) {
      throw new ForbiddenException('دسترسی به این مکالمه مجاز نیست');
    }
    const visitor = await this.moderation.visitor(siteId, conversation.visitorId);
    return Object.assign(conversation, {
      visitorName: visitor.name,
      visitorExternalId: visitor.externalId,
      visitorDisplayName: visitor.displayName,
      visitorFlags: visitor.flags ?? [],
      visitorModeration: visitorModerationState(visitor),
    });
  }

  async ensureVisitorOwnsConversation(
    id: string,
    visitorId: string,
    siteId?: string,
  ): Promise<ConversationEntity> {
    const conversation = await this.conversationsRepository.findOne({
      where: { id, ...(siteId ? { siteId } : {}) },
    });
    if (!conversation) throw new NotFoundException('مکالمه پیدا نشد');
    if (conversation.visitorId !== visitorId) {
      throw new ForbiddenException('دسترسی به این مکالمه مجاز نیست');
    }
    if (conversation.deletedAt) throw new NotFoundException('مکالمه پیدا نشد');
    return conversation;
  }

  // فهرست مکالمات + تعداد پیام نخوانده‌ی هر مکالمه از دید همین اپراتور (برای badge در داشبورد)
  async listForSite(
    siteId: string,
    agentId: string,
    options: ListConversationsOptions = {},
  ): Promise<ConversationWithUnreadCount[]> {
    const limit = Math.min(options.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    if (options.deleted === 'only') {
      const [agent] = await this.conversationsRepository.manager.query(
        'SELECT role,permissions FROM agents WHERE id=$1 AND "siteId"=$2',
        [agentId, siteId],
      );
      if (!agent || !hasPermission(agent.role, agent.permissions, 'deleteConversations'))
        throw new ForbiddenException('دسترسی به زباله‌دان مجاز نیست');
    }
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
      .andWhere(
        options.deleted === 'only'
          ? 'conversation.deletedAt IS NOT NULL'
          : 'conversation.deletedAt IS NULL',
      )
      .leftJoin(
        'visitors',
        'identity',
        'identity.id = conversation.visitorId AND identity."siteId" = :siteId',
        { siteId },
      )
      .addSelect('identity.name', 'visitorName')
      .addSelect('identity.externalId', 'visitorExternalId')
      .addSelect('identity.displayName', 'visitorDisplayName')
      .addSelect('identity.flags', 'visitorFlags')
      .addSelect('identity.blockedAt', 'visitorBlockedAt')
      .addSelect('identity.blockedUntil', 'visitorBlockedUntil')
      .addSelect('identity.mutedUntil', 'visitorMutedUntil')
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
          '(visitor.name ILIKE :search OR visitor."displayName" ILIKE :search OR visitor.id::text ILIKE :search OR visitor.email ILIKE :search OR conversation.department ILIKE :search)',
          { search: `%${options.search}%` },
        );
    }

    const { entities, raw } = await query.getRawAndEntities();
    return entities.map((entity, index) => ({
      ...entity,
      visitorName: raw[index]?.visitorName ?? null,
      visitorExternalId: raw[index]?.visitorExternalId ?? null,
      visitorDisplayName: raw[index]?.visitorDisplayName ?? null,
      visitorFlags: raw[index]?.visitorFlags ?? [],
      visitorModeration: visitorModerationState({
        blockedAt: raw[index]?.visitorBlockedAt,
        blockedUntil: raw[index]?.visitorBlockedUntil,
        mutedUntil: raw[index]?.visitorMutedUntil,
      }),
      unreadCount: parseInt(raw[index]?.unreadCount ?? '0', 10),
    }));
  }

  async unreadForSite(siteId: string, agentId: string): Promise<ConversationUnreadDto> {
    // شمارنده به صفحه‌بندی صندوق وابسته نیست و دسترسی همین حساب دوباره بررسی می‌شود.
    const rows = await this.conversationsRepository.manager.query(
      `SELECT COUNT(m.id)::int AS "unreadCount"
       FROM agents a
       LEFT JOIN conversations c ON c."siteId" = $1 AND c."deletedAt" IS NULL
       LEFT JOIN conversation_reads r ON r."conversationId" = c.id AND r."agentId" = a.id
       LEFT JOIN messages m ON m."conversationId" = c.id AND m."siteId" = $1
         AND m."senderType" != 'agent'
         AND m."createdAt" > COALESCE(r."lastReadAt", 'epoch')
       WHERE a.id = $2 AND a."siteId" = $1
       GROUP BY a.id`,
      [siteId, agentId],
    );
    if (!rows.length) throw new ForbiddenException('دسترسی به این فروشگاه مجاز نیست');
    return { unreadCount: Number(rows[0].unreadCount) };
  }

  async assignAgent(
    conversationId: string,
    siteId: string,
    agentId: string,
  ): Promise<ConversationEntity> {
    return this.changeAiControl(conversationId, siteId, agentId, false);
  }

  async resumeAi(
    conversationId: string,
    siteId: string,
    agentId: string,
  ): Promise<ConversationEntity> {
    return this.changeAiControl(conversationId, siteId, agentId, true);
  }

  private async changeAiControl(
    conversationId: string,
    siteId: string,
    agentId: string,
    resume: boolean,
  ): Promise<ConversationEntity> {
    const updated = await this.conversationsRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(ConversationEntity);
      const { conversation, visitor } = await this.moderation.lockConversation(
        manager,
        siteId,
        conversationId,
      );
      if (!conversation) throw new NotFoundException('گفتگو پیدا نشد');
      const [agent] = await manager.query('SELECT role FROM agents WHERE id=$1 AND "siteId"=$2', [
        agentId,
        siteId,
      ]);
      if (!agent) throw new ForbiddenException('دسترسی به این فروشگاه مجاز نیست');
      if (resume && conversation.status === ConversationStatus.RESOLVED)
        throw new BadRequestException('گفتگو بسته شده است');
      if (resume) {
        this.moderation.assertAllowed(visitor);
        if (
          conversation.assignedAgentId &&
          conversation.assignedAgentId !== agentId &&
          agent.role !== 'admin'
        )
          throw new ForbiddenException('این گفتگو به پشتیبان دیگری سپرده شده است');
        const [site] = await manager.query('SELECT "aiEnabled" FROM sites WHERE id=$1', [siteId]);
        if (!site?.aiEnabled) throw new BadRequestException('دستیار این فروشگاه خاموش است');
      }
      conversation.assignedAgentId = resume ? null : agentId;
      conversation.aiPaused = !resume;
      conversation.status = resume
        ? ConversationStatus.OPEN
        : conversation.status === ConversationStatus.OPEN
          ? ConversationStatus.PENDING
          : conversation.status;
      return repository.save(conversation);
    });
    this.eventEmitter.emit('conversation.control-updated', {
      conversationId,
      siteId,
      status: updated.status,
    });
    return updated;
  }

  async updateDetails(
    conversationId: string,
    siteId: string,
    input: UpdateConversationDetailsInput,
  ): Promise<ConversationEntity> {
    return this.mutate(conversationId, siteId, (conversation) => {
      if (input.department !== undefined) {
        conversation.department = input.department;
      }
      if (input.tags !== undefined) {
        conversation.tags = input.tags;
      }
      if (input.priority !== undefined) conversation.priority = input.priority;
    });
  }

  // اعمال ترکیبی نتیجه‌ی چند قانون اتوماسیون روی یک مکالمه با یک save (فاز ۶) — به‌جای یک نوشتن جدا به‌ازای هر قانون
  async applyAutomationEffects(
    conversationId: string,
    siteId: string,
    effects: { department?: string; addTags?: string[]; setPriorityHigh?: boolean },
  ): Promise<ConversationEntity> {
    return this.mutate(conversationId, siteId, (conversation) => {
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
    });
  }

  async resolve(conversationId: string, siteId: string): Promise<ConversationEntity> {
    const saved = await this.mutate(conversationId, siteId, (conversation) => {
      if (conversation.status !== ConversationStatus.RESOLVED) {
        conversation.status = ConversationStatus.RESOLVED;
        conversation.resolvedAt = new Date();
      }
    });

    // ChatGateway به این رویداد گوش می‌ده و به اتاق مکالمه/سایت اطلاع می‌ده (بدون وابستگی حلقوی بین ماژول‌ها)
    const event: ConversationResolvedEvent = {
      conversationId: saved.id,
      siteId: saved.siteId,
      conversationVersion: saved.lifecycleVersion,
      visitorVersion: (saved as ConversationEntity & { visitorVersion: number }).visitorVersion,
    };
    this.eventEmitter.emit(CONVERSATION_RESOLVED_EVENT, event);

    return saved;
  }

  // وقتی بازدیدکننده به یک مکالمه‌ی حل‌شده دوباره پیام می‌ده، خودکار بازش کن
  async reopenIfResolved(conversation: ConversationEntity): Promise<ConversationEntity> {
    return this.mutate(conversation.id, conversation.siteId, (current) => {
      if (current.status === ConversationStatus.RESOLVED) {
        current.status = ConversationStatus.OPEN;
        current.resolvedAt = null;
      }
    });
  }

  async submitCsatAsVisitor(
    conversationId: string,
    visitorId: string,
    score: number,
    comment?: string,
    siteId?: string,
  ): Promise<void> {
    const owned = await this.ensureVisitorOwnsConversation(conversationId, visitorId, siteId);
    await this.conversationsRepository.manager.transaction(async (manager) => {
      const { conversation } = await this.moderation.lockConversation(
        manager,
        owned.siteId,
        conversationId,
      );
      if (conversation.visitorId !== visitorId) throw new ForbiddenException('دسترسی مجاز نیست');
      if (conversation.status !== ConversationStatus.RESOLVED) {
        throw new ConflictException('فقط مکالمه‌ی حل‌شده قابل امتیازدهی است');
      }

      const ratings = manager.getRepository(CsatRatingEntity);
      const existing = await ratings.findOne({
        where: { conversationId, siteId: conversation.siteId },
      });
      if (existing) {
        throw new ConflictException('این مکالمه قبلاً امتیازدهی شده است');
      }

      const rating = ratings.create({
        siteId: conversation.siteId,
        conversationId,
        score,
        comment: comment ?? null,
      });
      await ratings.save(rating);
    });
  }

  // اپراتور مکالمه رو دیده (باز کرده، یا الان مشغول دیدنشه) — badge نخوانده صفر می‌شه
  async markAsRead(conversationId: string, siteId: string, agentId: string): Promise<void> {
    await this.findByIdForSite(conversationId, siteId); // مطمئن شو مکالمه متعلق به همین سایته
    await this.touchRead(conversationId, agentId, siteId);
  }

  // نسخه‌ی سبک‌تر برای داخل ChatGateway که خودش قبلاً مالکیت مکالمه رو تأیید کرده
  async touchRead(conversationId: string, agentId: string, siteId?: string): Promise<void> {
    const [agent] = await this.readsRepository.manager.query(
      'SELECT "siteId" FROM agents WHERE id=$1',
      [agentId],
    );
    if (!agent || (siteId && agent.siteId !== siteId))
      throw new ForbiddenException('اپراتور پیدا نشد');
    await this.readsRepository.manager.transaction(async (manager) => {
      await this.moderation.lockConversation(manager, agent.siteId, conversationId);
      await manager
        .getRepository(ConversationReadEntity)
        .upsert({ conversationId, agentId, lastReadAt: new Date() }, ['conversationId', 'agentId']);
    });
  }

  // فراخوانی فقط وقتی محتوای پیام کلیدواژه‌ی فوریت داشته باشه (چک شده در ChatGateway)
  async escalateIfUrgent(
    conversationId: string,
    siteId: string,
  ): Promise<ConversationEntity | null> {
    return this.mutate(conversationId, siteId, (conversation) => {
      conversation.priority = 'high';
    });
  }

  private async mutate(
    id: string,
    siteId: string,
    apply: (conversation: ConversationEntity) => void,
  ): Promise<ConversationEntity> {
    return this.conversationsRepository.manager.transaction(async (manager) => {
      const { conversation, visitor } = await this.moderation.lockConversation(manager, siteId, id);
      apply(conversation);
      const saved = await manager.getRepository(ConversationEntity).save(conversation);
      Object.defineProperty(saved, 'visitorVersion', {
        value: visitor.moderationVersion,
        enumerable: false,
      });
      return saved;
    });
  }

  async setTrashed(
    id: string,
    siteId: string,
    agentId: string,
    deleted: boolean,
  ): Promise<ConversationEntity & { restoredAsHistory: boolean }> {
    const saved = await this.conversationsRepository.manager.transaction(async (manager) => {
      const { conversation } = await this.moderation.lockConversation(manager, siteId, id, true);
      let restoredAsHistory = false;
      if (Boolean(conversation.deletedAt) !== deleted) {
        if (!deleted) {
          const active = await manager.getRepository(ConversationEntity).findOne({
            where: {
              id: Not(id),
              siteId,
              visitorId: conversation.visitorId,
              deletedAt: IsNull(),
              status: In([ConversationStatus.OPEN, ConversationStatus.PENDING]),
            },
          });
          if (active) {
            conversation.status = ConversationStatus.RESOLVED;
            conversation.resolvedAt = new Date();
            restoredAsHistory = true;
          }
        }
        conversation.deletedAt = deleted ? new Date() : null;
        conversation.deletedById = deleted ? agentId : null;
        conversation.lifecycleVersion++;
        conversation.aiPaused = true;
        await manager.getRepository(ConversationEntity).save(conversation);
      }
      return Object.assign(conversation, { restoredAsHistory });
    });
    this.eventEmitter.emit('conversation.lifecycle', {
      siteId,
      visitorId: saved.visitorId,
      conversationId: id,
      deleted,
      deletedAt: saved.deletedAt?.toISOString() ?? null,
      status: saved.status,
      restoredAsHistory: saved.restoredAsHistory,
    });
    return saved;
  }

  async jobVersions(
    id: string,
    siteId: string,
  ): Promise<{ conversationVersion: number; visitorVersion: number }> {
    return this.conversationsRepository.manager.transaction(async (manager) => {
      const { conversation, visitor } = await this.moderation.lockConversation(manager, siteId, id);
      this.moderation.assertAllowed(visitor);
      return {
        conversationVersion: conversation.lifecycleVersion,
        visitorVersion: visitor.moderationVersion,
      };
    });
  }
}
