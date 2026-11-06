import { Module } from '@nestjs/common';
import { ChatToolsController } from './chat-tools.controller';
import { ChatToolsService } from './chat-tools.service';
@Module({ controllers: [ChatToolsController], providers: [ChatToolsService] })
export class ChatToolsModule {}
