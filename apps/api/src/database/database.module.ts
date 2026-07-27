import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  SiteEntity,
  AgentEntity,
  VisitorEntity,
  ConversationEntity,
  MessageEntity,
  CannedResponseEntity,
  CsatRatingEntity,
  VisitorPageViewEntity,
  ConversationReadEntity,
  KnowledgeBaseDocumentEntity,
  KnowledgeBaseChunkEntity,
  AutomationRuleEntity,
  InternalNoteEntity,
  WebhookEntity,
} from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [
          SiteEntity,
          AgentEntity,
          VisitorEntity,
          ConversationEntity,
          MessageEntity,
          CannedResponseEntity,
          CsatRatingEntity,
          VisitorPageViewEntity,
          ConversationReadEntity,
          KnowledgeBaseDocumentEntity,
          KnowledgeBaseChunkEntity,
          AutomationRuleEntity,
          InternalNoteEntity,
          WebhookEntity,
        ],
        // مایگریشن‌ها دستی و کنترل‌شده اجرا می‌شن؛ synchronize هیچ‌وقت در پروژه روشن نیست
        synchronize: false,
        autoLoadEntities: false,
        // تنظیمات pool: بدون این‌ها، اتصال بی‌کارِ pg بعد از مدتی توسط NAT داکر/شبکه بی‌صدا قطع
        // می‌شد و pool یک اتصال مرده نگه می‌داشت — نتیجه‌اش «Connection terminated unexpectedly»
        // و بعدش هنگ کردن نامحدود همه‌ی درخواست‌های وابسته به دیتابیس (از جمله لاگین) بود.
        extra: {
          // TCP keepalive تا اتصال بی‌کار توسط میانی‌ها قطع نشه
          keepAlive: true,
          keepAliveInitialDelayMillis: 10_000,
          // اتصال بی‌کار زودتر از مهلت معمول NAT بسته و بازسازی می‌شه
          idleTimeoutMillis: 30_000,
          // اگه اتصال جدید در این مدت برقرار نشد، به‌جای انتظار بی‌پایان خطا بده
          connectionTimeoutMillis: 10_000,
          max: 10,
        },
      }),
    }),
  ],
})
export class DatabaseModule {}
