import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';
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

// این فایل فقط برای CLI مایگریشن TypeORM استفاده می‌شه (npm run migration:run/generate)
dotenv.config({ path: join(__dirname, '../../../../.env') });

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
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
  migrations: [join(__dirname, 'migrations/*.{ts,js}')],
  synchronize: false,
  logging: false,
});
