import { Module } from '@nestjs/common';
import { RedisRateLimiterService } from './redis-rate-limiter.service';

// این ماژول به RedisModule سراسری (@Global) وابسته است که در AppModule ایمپورت می‌شه
@Module({
  providers: [RedisRateLimiterService],
  exports: [RedisRateLimiterService],
})
export class RateLimitModule {}
