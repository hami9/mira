import 'reflect-metadata';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './modules/chat/redis-io.adapter';
import { SitesService } from './modules/sites/sites.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const sitesService = app.get(SitesService);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // فایل‌های استاتیک صفحه دمو ویجت (فقط برای تست دستی فاز ۱ — در تولید واقعی از CDN/هاست جدا سرو می‌شه)
  app.useStaticAssets(join(__dirname, '..', 'public'));

  const dashboardOrigins = (config.get<string>('CORS_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // CORS برای مسیرهای REST: داشبورد از env، ویجت از دامنه‌های ثبت‌شده هر سایت (نه '*')
  app.enableCors({
    origin: (origin, callback) => {
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
    credentials: false,
  });

  app.useWebSocketAdapter(new RedisIoAdapter(app));

  const port = config.get<number>('API_PORT', 3000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`میرا API روی پورت ${port} بالا آمد`, 'Bootstrap');
}

bootstrap();
