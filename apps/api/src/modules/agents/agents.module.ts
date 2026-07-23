import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from '../../database/entities';
import { AgentsService } from './agents.service';

@Module({
  imports: [TypeOrmModule.forFeature([AgentEntity])],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
