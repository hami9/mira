import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';

// شمارنده ساده fixed-window روی Redis برای rate-limit اندپوینت‌های عمومی ویجت
// (شروع مکالمه، ارسال پیام) — چون این‌ها بدون احراز هویت اپراتور در دسترس‌اند
@Injectable()
export class RedisRateLimiterService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * @returns true اگر درخواست مجاز باشه، false اگر از سقف عبور کرده باشه
   */
  async consume(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const redisKey = `ratelimit:${key}`;
    const current = await this.redis.incr(redisKey);
    if (current === 1) {
      await this.redis.expire(redisKey, windowSeconds);
    }
    return current <= limit;
  }
}
