import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from '../../database/entities';
import { GuardsModule } from '../../common/guards/guards.module';
import { AgentsService } from './agents.service';
import { AgentsManagementService } from './agents-management.service';
import { AgentsController } from './agents.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AgentEntity]), GuardsModule],
  controllers: [AgentsController],
  providers: [AgentsService, AgentsManagementService],
  exports: [AgentsService],
})
export class AgentsModule {}
