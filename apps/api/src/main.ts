import 'reflect-metadata';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './modules/chat/redis-io.adapter';
import { SitesService } from './modules/sites/sites.service';
import { createSecurityHeadersMiddleware } from './common/security/security-headers.middleware';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const sitesService = app.get(SitesService);

  const isProduction = config.get<string>('NODE_ENV') === 'production';

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // هدرهای امنیتی باید *پیش از* useStaticAssets ثبت شوند، وگرنه فایل‌های استاتیک
  // (از جمله صفحه‌ی دمو ویجت) بدون هیچ هدر امنیتی سرو می‌شوند — با تست واقعی تأیید شد.
  app.use(
    createSecurityHeadersMiddleware({
      publicApiUrl: config.get<string>('PUBLIC_API_URL', ''),
      isProduction,
    }),
  );

  // صفحه‌ی دمو فقط ابزار تست دستی است و کلید ویجت نمونه را داخل خودش دارد؛
  // در production سرو نمی‌شود تا روی هر استقرار واقعی یک صفحه‌ی عمومی اضافی باز نماند.
  // (این چک باید *پیش از* useStaticAssets باشد وگرنه فایل استاتیک زودتر پاسخ می‌دهد.)
  if (isProduction) {
    app.use(
      (
        req: { path: string },
        res: { status: (code: number) => { end: () => void } },
        next: () => void,
      ) => {
        if (req.path === '/demo.html') {
          res.status(404).end();
          return;
        }
        next();
      },
    );
  }

  // فایل‌های استاتیک: خروجی build ویجت (`/widget-dist/widget.js`) که در production هم لازم است
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // حالت یک‌آدرسی برای نصب سبک و پنل‌های میزبانی؛ فایل تنظیم فقط آدرس عمومی دارد.
  if (config.get<string>('SERVE_DASHBOARD') === 'true') {
    app.use('/config.js', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-store');
      res.type('application/javascript').send('window.__MIRA_API_URL__ = window.location.origin;');
    });
    app.useStaticAssets(join(__dirname, '..', 'dashboard'));
  }

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

  app.enableShutdownHooks();
  const port = config.get<number>('PORT') || config.get<number>('API_PORT', 3000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`میرا API روی پورت ${port} بالا آمد`, 'Bootstrap');
}

bootstrap();
