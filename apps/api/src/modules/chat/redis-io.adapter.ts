import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { ServerOptions } from 'socket.io';
import { SitesService } from '../sites/sites.service';

// آداپتور سفارشی Socket.io: CORS دینامیک (دامنه‌های ثبت‌شده هر سایت + آدرس داشبورد)
// + اتصال به آداپتور Redis برای پخش پیام بین چند instance سرور در آینده
export class RedisIoAdapter extends IoAdapter {
  constructor(private readonly appContext: INestApplicationContext) {
    super(appContext);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const config = this.appContext.get(ConfigService);
    const sitesService = this.appContext.get(SitesService);

    const dashboardOrigins = (config.get<string>('CORS_ALLOWED_ORIGINS') ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    const corsOptions: ServerOptions['cors'] = {
      credentials: false,
      origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => {
        if (!origin) {
          callback(null, true);
          return;
        }
        if (dashboardOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        sitesService
          .isOriginAllowedForAnySite(origin)
          .then((allowed) => callback(null, allowed))
          .catch(() => callback(null, false));
      },
    };

    const server = super.createIOServer(port, { ...options, cors: corsOptions });

    const pubClient = new Redis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
      password: config.get<string>('REDIS_PASSWORD') || undefined,
    });
    const subClient = pubClient.duplicate();
    server.adapter(createAdapter(pubClient, subClient));

    return server;
  }
}
