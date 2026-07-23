import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeBaseChunkEntity, KnowledgeBaseDocumentEntity } from '../../database/entities';
import { GuardsModule } from '../../common/guards/guards.module';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeBaseController } from './knowledge-base.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([KnowledgeBaseDocumentEntity, KnowledgeBaseChunkEntity]),
    GuardsModule,
  ],
  controllers: [KnowledgeBaseController],
  providers: [KnowledgeBaseService],
})
export class KnowledgeBaseModule {}
