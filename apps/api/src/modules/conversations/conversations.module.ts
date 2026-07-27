import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ConversationEntity,
  ConversationReadEntity,
  CsatRatingEntity,
} from '../../database/entities';
import { GuardsModule } from '../../common/guards/guards.module';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConversationEntity, CsatRatingEntity, ConversationReadEntity]),
    GuardsModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
