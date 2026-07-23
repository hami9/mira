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
        ],
        // مایگریشن‌ها دستی و کنترل‌شده اجرا می‌شن؛ synchronize هیچ‌وقت در پروژه روشن نیست
        synchronize: false,
        autoLoadEntities: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
