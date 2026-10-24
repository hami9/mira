import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { getHeapStatistics } from 'v8';
import { runtimeLimits, SystemStatusDto } from '@mira/shared-types';
import { REDIS_CLIENT } from '../../common/redis/redis.constants';

@Injectable()
export class SystemService {
  private cpu = process.cpuUsage();
  private time = process.hrtime.bigint();

  constructor(
    private readonly config: ConfigService,
    @InjectDataSource() private readonly db: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async status(siteId: string, agentId: string): Promise<SystemStatusDto> {
    const admin = await this.db.query(
      `SELECT id FROM agents WHERE id = $1 AND "siteId" = $2 AND role = 'admin'`,
      [agentId, siteId],
    );
    if (!admin.length) throw new ForbiddenException('مشاهده منابع فقط برای مدیر مجاز است');
    const result: SystemStatusDto = {
      authorized: false,
      checkedAt: new Date().toISOString(),
      limits: null,
      api: null,
      worker: null,
      databaseBytes: null,
      warnings: [],
    };
    // آمار کل نصب متعلق به مدیر میزبان است؛ مدیر هر فروشگاه به آن دسترسی ندارد.
    if (this.config.get<string>('SYSTEM_SITE_ID') !== siteId) return result;
    result.authorized = true;
    result.limits = runtimeLimits({
      API_DB_POOL_MAX: this.config.get('API_DB_POOL_MAX'),
      WORKER_DB_POOL_MAX: this.config.get('WORKER_DB_POOL_MAX'),
      WORKER_CONCURRENCY: this.config.get('WORKER_CONCURRENCY'),
    });
    const now = process.hrtime.bigint();
    const usage = process.cpuUsage(this.cpu);
    const elapsed = Number(now - this.time) / 1000;
    this.time = now;
    this.cpu = process.cpuUsage();
    const memory = process.memoryUsage();
    result.api = {
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapLimitBytes: getHeapStatistics().heap_size_limit,
      cpuPercent: elapsed > 0 ? ((usage.user + usage.system) / elapsed) * 100 : null,
      uptimeSeconds: process.uptime(),
    };
    const checks = await Promise.allSettled([
      this.db.query('SELECT pg_database_size(current_database()) AS bytes'),
      this.redis.get(`${this.config.get('QUEUE_PREFIX', 'mira')}:runtime:worker`),
    ]);
    if (checks[0].status === 'fulfilled') result.databaseBytes = Number(checks[0].value[0].bytes);
    else result.warnings.push('اندازه دیتابیس دریافت نشد.');
    if (checks[1].status === 'fulfilled' && checks[1].value) {
      try {
        const value = JSON.parse(checks[1].value);
        if (
          ['rssBytes', 'heapUsedBytes', 'heapLimitBytes', 'uptimeSeconds'].every(
            (key) =>
              typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0,
          ) &&
          typeof value.checkedAt === 'string' &&
          Date.now() - Date.parse(value.checkedAt) < 45_000
        ) {
          result.worker = {
            rssBytes: value.rssBytes,
            heapUsedBytes: value.heapUsedBytes,
            heapLimitBytes: value.heapLimitBytes,
            uptimeSeconds: value.uptimeSeconds,
            cpuPercent:
              typeof value.cpuPercent === 'number' && Number.isFinite(value.cpuPercent)
                ? value.cpuPercent
                : null,
            checkedAt: value.checkedAt,
          };
        }
      } catch {
        // وضعیت نامعتبر مثل پردازشگر قطع‌شده نمایش داده می‌شود.
      }
    }
    if (!result.worker) result.warnings.push('گزارش تازه‌ای از پردازشگر پس‌زمینه نرسیده است.');
    return result;
  }
}
