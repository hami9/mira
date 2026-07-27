import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CannedResponseEntity } from '../../database/entities';
import { CreateCannedResponseRequestDto } from './dto/create-canned-response.dto';
import { UpdateCannedResponseRequestDto } from './dto/update-canned-response.dto';

@Injectable()
export class CannedResponsesService {
  constructor(
    @InjectRepository(CannedResponseEntity)
    private readonly repository: Repository<CannedResponseEntity>,
  ) {}

  listForSite(siteId: string): Promise<CannedResponseEntity[]> {
    return this.repository.find({ where: { siteId }, order: { title: 'ASC' } });
  }

  async create(siteId: string, dto: CreateCannedResponseRequestDto): Promise<CannedResponseEntity> {
    const entity = this.repository.create({ ...dto, siteId });
    return this.repository.save(entity);
  }

  async update(
    id: string,
    siteId: string,
    dto: UpdateCannedResponseRequestDto,
  ): Promise<CannedResponseEntity> {
    const entity = await this.findOwnedBySite(id, siteId);
    Object.assign(entity, dto);
    return this.repository.save(entity);
  }

  async remove(id: string, siteId: string): Promise<void> {
    const entity = await this.findOwnedBySite(id, siteId);
    await this.repository.remove(entity);
  }

  private async findOwnedBySite(id: string, siteId: string): Promise<CannedResponseEntity> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity || entity.siteId !== siteId) {
      throw new NotFoundException('پاسخ آماده پیدا نشد');
    }
    return entity;
  }
}
