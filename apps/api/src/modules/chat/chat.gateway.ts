import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import {
  AgentStatus,
  ConversationStatus,
  MessagePayload,
  MessageSenderType,
  SOCKET_BRIDGE_CHANNEL,
  SocketBridgeMessage,
  SocketEvent,
  TypingPayload,
  containsUrgentKeywords,
} from '@mira/shared-types';
import { ConversationEntity } from '../../database/entities';
import { REDIS_CLIENT } from '../../common/redis/redis.constants';
import { TokenService } from '../../common/token/token.service';
import { RedisRateLimiterService } from '../../common/rate-limit/redis-rate-limiter.service';
import { AiQueueService } from '../../common/queue/ai-queue.service';
import { WebhookQueueService } from '../../common/queue/webhook-queue.service';
import { AutomationService } from '../automation/automation.service';
import {
  CONVERSATION_RESOLVED_EVENT,
  ConversationResolvedEvent,
  ConversationsService,
} from '../conversations/conversations.service';
import { MessagesService } from '../messages/messages.service';
import { AgentsService } from '../agents/agents.service';

type SocketRole = 'agent' | 'visitor';

// state متصل به هر Socket — با client.data نگه‌داری می‌شه (نوع اختصاصی برای type-safety داخل این فایل)
interface SocketData {
  role?: SocketRole;
  agentId?: string;
  agentSiteId?: string;
  visitorId?: string;
  visitorSiteId?: string;
}

const MESSAGE_MAX_LENGTH = 8000;
const LONG_CONVERSATION_MESSAGE_THRESHOLD = 6;

@WebSocketGateway({ transports: ['websocket', 'polling'] })
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  // اتصال جدا برای subscribe — کلاینت subscribe شده نمی‌تونه دستور دیگه‌ای اجرا کنه
  private bridgeSubscriber!: Redis;

  constructor(
    private readonly tokenService: TokenService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly agentsService: AgentsService,
    private readonly rateLimiter: RedisRateLimiterService,
    private readonly aiQueue: AiQueueService,
    private readonly webhookQueue: WebhookQueueService,
    private readonly automationService: AutomationService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // پل Redis pub/sub: worker (فرآیند جدا) نتیجه‌ی AI رو روی این کانال منتشر می‌کنه چون
  // Socket.io فقط داخل فرآیند api زنده‌ست و worker مستقیم به این server دسترسی ندارد
  async onModuleInit(): Promise<void> {
    this.bridgeSubscriber = this.redis.duplicate();
    await this.bridgeSubscriber.subscribe(SOCKET_BRIDGE_CHANNEL);
    this.bridgeSubscriber.on('message', (_channel, raw) => {
      try {
        const message = JSON.parse(raw) as SocketBridgeMessage;
        this.server.to(message.room).emit(message.event, message.data);
      } catch {
        // پیام بدشکل روی صف رو نادیده بگیر — نباید کل گیت‌وی رو بترکونه
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.bridgeSubscriber?.quit();
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      this.rejectConnection(client, 'توکن ارسال نشده است');
      return;
    }

    const origin = client.handshake.headers.origin;

    // ابتدا به‌عنوان اپراتور امتحان می‌کنیم، چون سکرت‌های access/visitor مستقل‌اند
    // و امتحان خطا فقط یک verify سریع JWT است (بدون هزینه‌ی قابل‌توجه)
    try {
      const agentPayload = this.tokenService.verifyAgentAccessToken(token);
      const data: SocketData = {
        role: 'agent',
        agentId: agentPayload.sub,
        agentSiteId: agentPayload.siteId,
      };
      Object.assign(client.data, data);
      await client.join(`site:${agentPayload.siteId}`);
      await this.agentsService.setStatus(agentPayload.sub, AgentStatus.ONLINE);
      return;
    } catch {
      // توکن اپراتور نبود؛ به‌عنوان بازدیدکننده امتحان می‌کنیم
    }

    try {
      const visitorPayload = this.tokenService.verifyVisitorToken(token);
      if (!origin || origin !== visitorPayload.domain) {
        this.rejectConnection(client, 'دامنه اتصال با توکن مطابقت ندارد');
        return;
      }
      const data: SocketData = {
        role: 'visitor',
        visitorId: visitorPayload.sub,
        visitorSiteId: visitorPayload.siteId,
      };
      Object.assign(client.data, data);
    } catch {
      this.rejectConnection(client, 'توکن نامعتبر یا منقضی شده است');
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const data = client.data as SocketData;
    if (data.role === 'agent' && data.agentId) {
      await this.agentsService.setStatus(data.agentId, AgentStatus.OFFLINE);
    }
  }

  @SubscribeMessage(SocketEvent.ConversationJoin)
  async onConversationJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string },
  ): Promise<void> {
    if (!body?.conversationId) return;
    const conversation = await this.assertAccess(client, body.conversationId);
    if (conversation) {
      await client.join(`conversation:${conversation.id}`);
      // اپراتوری که وارد اتاق مکالمه می‌شه یعنی داره می‌بینتش — badge نخوانده صفر می‌شه
      const data = client.data as SocketData;
      if (data.role === 'agent' && data.agentId) {
        await this.conversationsService.touchRead(conversation.id, data.agentId);
      }
    }
  }

  @SubscribeMessage(SocketEvent.MessageSend)
  async onMessageSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string; content?: string; clientMessageId?: string },
  ): Promise<void> {
    if (!body?.conversationId || !body?.content?.trim()) return;

    let conversation = await this.assertAccess(client, body.conversationId);
    if (!conversation) return;

    const data = client.data as SocketData;
    const isAgent = data.role === 'agent';

    // اگه بازدیدکننده به یک مکالمه‌ی حل‌شده پیام بده، خودکار دوباره باز می‌شه
    if (!isAgent && conversation.status === ConversationStatus.RESOLVED) {
      conversation = await this.conversationsService.reopenIfResolved(conversation);
      this.broadcastConversationStatus(conversation.id, conversation.siteId, conversation.status);
    }
    const rateLimitKey = isAgent
      ? `ws-msg-agent:${data.agentId}`
      : `ws-msg-visitor:${data.visitorId}`;
    const allowed = await this.rateLimiter.consume(rateLimitKey, isAgent ? 60 : 20, 10);
    if (!allowed) {
      this.emitError(client, 'ارسال پیام بیش از حد مجاز است، لحظه‌ای صبر کنید');
      return;
    }

    const senderType = isAgent ? MessageSenderType.AGENT : MessageSenderType.VISITOR;
    const senderId = (isAgent ? data.agentId : data.visitorId) ?? null;

    const message = await this.messagesService.create({
      siteId: conversation.siteId,
      conversationId: conversation.id,
      senderType,
      senderId,
      rawContent: body.content.slice(0, MESSAGE_MAX_LENGTH),
      clientMessageId: body.clientMessageId?.slice(0, 64) || null,
    });

    const payload: MessagePayload = {
      id: message.id,
      conversationId: message.conversationId,
      senderType: message.senderType,
      senderId: message.senderId,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    };

    this.server.to(`conversation:${conversation.id}`).emit(SocketEvent.MessageNew, payload);

    // وب‌هوک message.created (فاز ۶) — در صف، چون سرور گیرنده ممکنه کند یا از دسترس خارج باشه
    await this.webhookQueue.enqueueDispatch({
      siteId: conversation.siteId,
      event: 'message.created',
      payload: { ...payload },
    });

    // اگه اپراتور پاسخ داده، یعنی مکالمه رو دیده — badge نخوانده براش صفر می‌شه
    if (isAgent && data.agentId) {
      await this.conversationsService.touchRead(conversation.id, data.agentId);
    }

    if (senderType === MessageSenderType.VISITOR) {
      // تشخیص فوریت/نارضایتی شدید با کلیدواژه (ارزان، بدون فراخوانی مدل زبانی) — فاز ۴
      const escalated = containsUrgentKeywords(message.content)
        ? await this.conversationsService.escalateIfUrgent(conversation.id)
        : null;

      // قوانین اتوماسیون (فاز ۶) — هم فقط کلیدواژه‌ست، پس روی مسیر زنده مشکلی نداره.
      // بعد از escalation اجرا می‌شه و خودش مکالمه رو تازه می‌خونه، پس نوشتن قبلی گم نمی‌شه.
      await this.automationService.evaluateAndApply(
        conversation.siteId,
        conversation.id,
        message.content,
      );

      // پیام مجزا (نه MessageNew) به کل سایت — چون اپراتورهایی که هم‌زمان در اتاق site و اتاق
      // همین conversation عضو هستن، با emit روی MessageNew پیام رو دوبار دریافت می‌کردن
      this.server.to(`site:${conversation.siteId}`).emit(SocketEvent.ConversationUpdated, {
        conversationId: conversation.id,
        lastMessage: payload,
        priority: escalated?.priority,
      });

      // اگه هنوز اپراتوری assign نشده، ربات RAG (فاز ۴) سعی می‌کنه توی صف BullMQ پاسخ بده —
      // مسیر Socket.io هیچ‌وقت منتظر پاسخ کند مدل زبانی نمی‌مونه
      if (!conversation.assignedAgentId) {
        await this.aiQueue.enqueueBotReply({
          siteId: conversation.siteId,
          conversationId: conversation.id,
          visitorMessageId: message.id,
        });
      }
    }
  }

  @SubscribeMessage(SocketEvent.TypingStart)
  onTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string },
  ): void {
    if (body?.conversationId) this.broadcastTyping(client, body.conversationId, true);
  }

  @SubscribeMessage(SocketEvent.TypingStop)
  onTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string },
  ): void {
    if (body?.conversationId) this.broadcastTyping(client, body.conversationId, false);
  }

  // وقتی از طریق REST (دکمه‌ی «حل مکالمه» در داشبورد) resolve انجام می‌شه، ConversationsService
  // این event رو منتشر می‌کنه (بدون وابستگی حلقوی ماژول) و اینجا به Socket.io ترجمه می‌شه
  @OnEvent(CONVERSATION_RESOLVED_EVENT)
  async handleConversationResolvedEvent(event: ConversationResolvedEvent): Promise<void> {
    this.broadcastConversationStatus(
      event.conversationId,
      event.siteId,
      ConversationStatus.RESOLVED,
    );

    // وب‌هوک conversation.resolved (فاز ۶)
    await this.webhookQueue.enqueueDispatch({
      siteId: event.siteId,
      event: 'conversation.resolved',
      payload: { conversationId: event.conversationId, resolvedAt: new Date().toISOString() },
    });

    // خلاصه‌سازی خودکار فقط برای گفتگوهای «طولانی» ارزش AI-call رو داره (فاز ۴)
    const messageCount = await this.messagesService.countForConversation(event.conversationId);
    if (messageCount >= LONG_CONVERSATION_MESSAGE_THRESHOLD) {
      await this.aiQueue.enqueueSummarizeConversation({
        siteId: event.siteId,
        conversationId: event.conversationId,
      });
    }
  }

  private broadcastConversationStatus(
    conversationId: string,
    siteId: string,
    status: ConversationStatus,
  ): void {
    const payload = { conversationId, status };
    this.server.to(`conversation:${conversationId}`).emit(SocketEvent.ConversationUpdated, payload);
    this.server.to(`site:${siteId}`).emit(SocketEvent.ConversationUpdated, payload);
  }

  private broadcastTyping(client: Socket, conversationId: string, isTyping: boolean): void {
    const data = client.data as SocketData;
    const senderType = data.role === 'agent' ? MessageSenderType.AGENT : MessageSenderType.VISITOR;
    const payload: TypingPayload = { conversationId, senderType, isTyping };
    client.to(`conversation:${conversationId}`).emit(SocketEvent.Typing, payload);
  }

  private async assertAccess(
    client: Socket,
    conversationId: string,
  ): Promise<ConversationEntity | null> {
    const data = client.data as SocketData;
    try {
      if (data.role === 'agent' && data.agentSiteId) {
        return await this.conversationsService.findByIdForSite(conversationId, data.agentSiteId);
      }
      if (data.role === 'visitor' && data.visitorId) {
        return await this.conversationsService.ensureVisitorOwnsConversation(
          conversationId,
          data.visitorId,
        );
      }
    } catch {
      this.emitError(client, 'دسترسی به این مکالمه مجاز نیست');
      return null;
    }
    this.emitError(client, 'احراز هویت نامعتبر است');
    return null;
  }

  private emitError(client: Socket, message: string): void {
    client.emit(SocketEvent.ConnectionError, { message });
  }

  private rejectConnection(client: Socket, message: string): void {
    this.emitError(client, message);
    client.disconnect(true);
  }
}
