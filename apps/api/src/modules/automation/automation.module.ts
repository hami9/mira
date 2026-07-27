import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutomationRuleEntity } from '../../database/entities';
import { GuardsModule } from '../../common/guards/guards.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { AutomationService } from './automation.service';
import { AutomationController } from './automation.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AutomationRuleEntity]), GuardsModule, ConversationsModule],
  controllers: [AutomationController],
  providers: [AutomationService],
  exports: [AutomationService],
})
export class AutomationModule {}
