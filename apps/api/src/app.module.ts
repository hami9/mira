import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './common/redis/redis.module';
import { AiQueueModule } from './common/queue/ai-queue.module';
import { HealthModule } from './modules/health/health.module';
import { SitesModule } from './modules/sites/sites.module';
import { AuthModule } from './modules/auth/auth.module';
import { AgentsModule } from './modules/agents/agents.module';
import { CannedResponsesModule } from './modules/canned-responses/canned-responses.module';
import { VisitorsModule } from './modules/visitors/visitors.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { MessagesModule } from './modules/messages/messages.module';
import { ChatModule } from './modules/chat/chat.module';
import { KnowledgeBaseModule } from './modules/knowledge-base/knowledge-base.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // سقف پیش‌فرض rate-limit برای همه‌ی endpointهای REST؛ مقادیر سخت‌گیرانه‌تر روی مسیرهای عمومی با @Throttle ست می‌شه
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    // برای رویدادهای داخلی مثل «مکالمه resolve شد» که باید بدون وابستگی حلقوی به ChatGateway برسه
    EventEmitterModule.forRoot(),
    RedisModule,
    AiQueueModule,
    DatabaseModule,
    HealthModule,
    SitesModule,
    AuthModule,
    AgentsModule,
    CannedResponsesModule,
    VisitorsModule,
    ConversationsModule,
    MessagesModule,
    ChatModule,
    KnowledgeBaseModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
