import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentStatus } from '@mira/shared-types';
import { AgentEntity } from '../../database/entities';

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentsRepository: Repository<AgentEntity>,
  ) {}

  // به‌روزرسانی وضعیت آنلاین/آفلاین اپراتور، هنگام اتصال/قطع اتصال Socket.io
  async setStatus(agentId: string, status: AgentStatus): Promise<void> {
    await this.agentsRepository.update({ id: agentId }, { status });
  }
}
