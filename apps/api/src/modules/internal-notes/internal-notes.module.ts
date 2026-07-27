import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InternalNoteEntity } from '../../database/entities';
import { GuardsModule } from '../../common/guards/guards.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { InternalNotesService } from './internal-notes.service';
import { InternalNotesController } from './internal-notes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([InternalNoteEntity]), GuardsModule, ConversationsModule],
  controllers: [InternalNotesController],
  providers: [InternalNotesService],
})
export class InternalNotesModule {}
