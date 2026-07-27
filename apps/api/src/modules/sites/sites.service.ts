import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, createHash } from 'node:crypto';
import { GeneratedApiKeyDto, PublicApiKeyStatusDto, UpdateSiteSettingsDto } from '@mira/shared-types';
import { SiteEntity } from '../../database/entities';

const API_KEY_PREFIX = 'mira_';

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

// نگهدارنده کش سبک دامنه‌های مجاز همه‌ی سایت‌ها، برای چک سریع CORS در هندشیک Socket.io
// بدون این‌که هر اتصال مجبور به یک کوئری دیتابیس باشه
interface DomainCacheEntry {
  domains: Set<string>;
  expiresAt: number;
}

const DOMAIN_CACHE_TTL_MS = 30_000;

@Injectable()
export class SitesService {
  private allDomainsCache: DomainCacheEntry | null = null;

  constructor(
    @InjectRepository(SiteEntity)
    private readonly sitesRepository: Repository<SiteEntity>,
  ) {}

  async findByWidgetKey(widgetKey: string): Promise<SiteEntity> {
    const site = await this.sitesRepository.findOne({ where: { widgetKey } });
    if (!site) {
      throw new NotFoundException('سایت با این widgetKey پیدا نشد');
    }
    return site;
  }

  async findById(id: string): Promise<SiteEntity> {
    const site = await this.sitesRepository.findOne({ where: { id } });
    if (!site) {
      throw new NotFoundException('سایت پیدا نشد');
    }
    return site;
  }

  async updateSettings(siteId: string, dto: UpdateSiteSettingsDto): Promise<SiteEntity> {
    const site = await this.findById(siteId);
    Object.assign(site, dto);
    const saved = await this.sitesRepository.save(site);
    // اگه allowedDomains تغییر کرده باشه، کش رو باطل کن تا فوراً اعمال بشه (نه بعد از TTL)
    this.allDomainsCache = null;
    return saved;
  }

  // فقط hash نگه داشته می‌شه (مثل passwordHash اپراتور)؛ کلید واقعی فقط همین یک‌بار برگردونده می‌شه
  async generateApiKey(siteId: string): Promise<GeneratedApiKeyDto> {
    const site = await this.findById(siteId);
    const apiKey = `${API_KEY_PREFIX}${randomBytes(24).toString('hex')}`;
    const keyPrefix = apiKey.slice(0, 12);
    site.apiKeyHash = hashApiKey(apiKey);
    site.apiKeyPrefix = keyPrefix;
    site.apiKeyCreatedAt = new Date();
    await this.sitesRepository.save(site);
    return { apiKey, keyPrefix };
  }

  async revokeApiKey(siteId: string): Promise<void> {
    await this.sitesRepository.update({ id: siteId }, { apiKeyHash: null, apiKeyPrefix: null, apiKeyCreatedAt: null });
  }

  async getApiKeyStatus(siteId: string): Promise<PublicApiKeyStatusDto> {
    const site = await this.findById(siteId);
    return {
      hasKey: !!site.apiKeyHash,
      keyPrefix: site.apiKeyPrefix,
      createdAt: site.apiKeyCreatedAt ? site.apiKeyCreatedAt.toISOString() : null,
    };
  }

  async findByApiKey(apiKey: string): Promise<SiteEntity | null> {
    return this.sitesRepository.findOne({ where: { apiKeyHash: hashApiKey(apiKey) } });
  }

  isDomainAllowed(site: SiteEntity, origin: string): boolean {
    const normalizedOrigin = this.normalizeDomain(origin);
    return site.allowedDomains.some((domain) => this.normalizeDomain(domain) === normalizedOrigin);
  }

  // استفاده در سطح CORS ترنسپورت Socket.io: آیا این origin برای *هر* سایتی مجاز است؟
  // تطبیق دقیق (به کدوم سایت) در handleConnection گیت‌وی با توکن بازدیدکننده انجام می‌شه
  async isOriginAllowedForAnySite(origin: string): Promise<boolean> {
    const cache = await this.getAllDomainsCached();
    return cache.has(this.normalizeDomain(origin));
  }

  private async getAllDomainsCached(): Promise<Set<string>> {
    const now = Date.now();
    if (this.allDomainsCache && this.allDomainsCache.expiresAt > now) {
      return this.allDomainsCache.domains;
    }
    const sites = await this.sitesRepository.find();
    const domains = new Set<string>();
    for (const site of sites) {
      for (const domain of site.allowedDomains) {
        domains.add(this.normalizeDomain(domain));
      }
    }
    this.allDomainsCache = { domains, expiresAt: now + DOMAIN_CACHE_TTL_MS };
    return domains;
  }

  private normalizeDomain(value: string): string {
    return value.trim().toLowerCase().replace(/\/+$/, '');
  }
}
