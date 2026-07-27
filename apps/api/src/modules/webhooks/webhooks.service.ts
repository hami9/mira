import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { CreateWebhookDto, UpdateWebhookDto, WebhookDto } from '@mira/shared-types';
import { WebhookEntity } from '../../database/entities';

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(WebhookEntity)
    private readonly webhooksRepository: Repository<WebhookEntity>,
  ) {}

  async listForSite(siteId: string): Promise<WebhookDto[]> {
    const webhooks = await this.webhooksRepository.find({ where: { siteId }, order: { createdAt: 'ASC' } });
    return webhooks.map(toDto);
  }

  async create(siteId: string, dto: CreateWebhookDto): Promise<WebhookDto> {
    const webhook = this.webhooksRepository.create({
      siteId,
      url: dto.url,
      events: dto.events,
      secret: randomBytes(24).toString('hex'),
      enabled: true,
    });
    return toDto(await this.webhooksRepository.save(webhook));
  }

  async update(siteId: string, id: string, dto: UpdateWebhookDto): Promise<WebhookDto> {
    const webhook = await this.webhooksRepository.findOne({ where: { id, siteId } });
    if (!webhook) {
      throw new NotFoundException('وب‌هوک پیدا نشد');
    }
    if (dto.url !== undefined) webhook.url = dto.url;
    if (dto.events !== undefined) webhook.events = dto.events;
    if (dto.enabled !== undefined) webhook.enabled = dto.enabled;
    return toDto(await this.webhooksRepository.save(webhook));
  }

  async delete(siteId: string, id: string): Promise<void> {
    await this.webhooksRepository.delete({ id, siteId });
  }
}

function toDto(webhook: WebhookEntity): WebhookDto {
  return {
    id: webhook.id,
    url: webhook.url,
    events: webhook.events,
    enabled: webhook.enabled,
    secret: webhook.secret,
    createdAt: webhook.createdAt.toISOString(),
  };
}
