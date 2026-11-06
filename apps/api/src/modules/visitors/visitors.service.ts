import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { VisitorEntity, VisitorPageViewEntity } from '../../database/entities';

export interface UpsertVisitorInput {
  externalId?: string | null;
  siteId: string;
  visitorRef?: string;
  name?: string;
  email?: string;
  userAgent?: string;
}

const RECENT_PAGE_VIEWS_LIMIT = 20;

@Injectable()
export class VisitorsService {
  constructor(
    @InjectRepository(VisitorEntity)
    private readonly visitorsRepository: Repository<VisitorEntity>,
    @InjectRepository(VisitorPageViewEntity)
    private readonly pageViewsRepository: Repository<VisitorPageViewEntity>,
  ) {}

  // اگر visitorRef معتبر برای همین سایت داده شده باشه، همون بازدیدکننده رو ادامه می‌دیم
  // (بدون این‌کار هر بازخوانی صفحه یک بازدیدکننده/مکالمه جدید می‌ساخت)
  async findOrCreate(input: UpsertVisitorInput): Promise<VisitorEntity> {
    if (input.visitorRef) {
      const existing = await this.visitorsRepository.findOne({
        where: { siteId: input.siteId, visitorRef: input.visitorRef },
      });
      if (existing) {
        await this.visitorsRepository.update(
          { id: existing.id, siteId: input.siteId },
          {
            lastSeenAt: new Date(),
            ...(input.externalId !== undefined ? { externalId: input.externalId } : {}),
            ...(input.name ? { name: input.name } : {}),
            ...(input.email ? { email: input.email } : {}),
            ...(input.userAgent ? { userAgent: input.userAgent } : {}),
          },
        );
        return this.findByIdForSite(existing.id, input.siteId);
      }
    }

    const visitor = this.visitorsRepository.create({
      siteId: input.siteId,
      visitorRef: input.visitorRef ?? randomUUID(),
      name: input.name ?? null,
      email: input.email ?? null,
      userAgent: input.userAgent ?? null,
      externalId: input.externalId ?? null,
    });
    return this.visitorsRepository.save(visitor);
  }

  async findByIdForSite(id: string, siteId: string): Promise<VisitorEntity> {
    const visitor = await this.visitorsRepository.findOne({ where: { id } });
    if (!visitor || visitor.siteId !== siteId) {
      throw new NotFoundException('بازدیدکننده پیدا نشد');
    }
    return visitor;
  }

  async recordPageView(
    siteId: string,
    visitorId: string,
    url: string,
    title?: string,
  ): Promise<void> {
    await this.visitorsRepository.update({ id: visitorId, siteId }, { lastSeenAt: new Date() });
    const previous = await this.pageViewsRepository.findOne({
      where: { siteId, visitorId },
      order: { visitedAt: 'DESC' },
    });
    if (previous?.url === url && previous.title === (title ?? null)) return;
    const pageView = this.pageViewsRepository.create({
      siteId,
      visitorId,
      url,
      title: title ?? null,
    });
    await this.pageViewsRepository.save(pageView);
  }

  async listRecentPageViews(visitorId: string, siteId: string): Promise<VisitorPageViewEntity[]> {
    return this.pageViewsRepository.find({
      where: { visitorId, siteId },
      order: { visitedAt: 'DESC' },
      take: RECENT_PAGE_VIEWS_LIMIT,
    });
  }
}
