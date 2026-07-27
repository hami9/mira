import { NextFunction, Request, Response } from 'express';

// هدرهای امنیتی به‌صورت دستی نوشته شدن (نه با helmet) چون فقط همین چند هدر ثابت لازمه و
// افزودن یک وابستگی جدید برای ~۲۰ خط هدر، با اصل «بدون پیچیدگی غیرضروری» این پروژه جور نبود.
//
// این به‌صورت یک middleware ساده‌ی express در main.ts و *پیش از* useStaticAssets ثبت می‌شه،
// نه از طریق MiddlewareConsumer نست. دلیلش با تست واقعی مشخص شد: فایل‌های استاتیک
// (صفحه‌ی دمو ویجت) کلاً از زنجیره‌ی middleware نست عبور نمی‌کردن و بدون هیچ هدر امنیتی
// سرو می‌شدن — یعنی دقیقاً همان صفحه‌ای که بیشترین نیاز به CSP را دارد، محافظت نمی‌شد.
export function createSecurityHeadersMiddleware(options: {
  publicApiUrl: string;
  isProduction: boolean;
}) {
  const publicUrl = options.publicApiUrl.trim();
  const wsUrl = publicUrl.replace(/^http/, 'ws');
  // connect-src باید شامل خود دامنه‌ی API باشه تا ویجت بتونه به آن REST/WebSocket بزنه
  const connectSrc = publicUrl ? `'self' ${publicUrl} ${wsUrl}` : "'self'";

  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    `connect-src ${connectSrc}`,
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  return function securityHeaders(req: Request, res: Response, next: NextFunction): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    // Express به‌طور پیش‌فرض نسخه‌ی خودش را لو می‌دهد
    res.removeHeader('X-Powered-By');

    // HSTS فقط روی HTTPS معنی دارد؛ در توسعه‌ی محلی (http) ست‌کردنش مرورگر را گیر می‌اندازد
    if (options.isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // CSP فقط برای صفحه‌های HTML سرو‌شده توسط خود API (صفحه‌ی دمو ویجت).
    // برای پاسخ‌های JSON بی‌معنی است و روی سایت مشتری هم CSP را خودِ سایت تعیین می‌کند.
    // از originalUrl استفاده می‌کنیم (نه path) و query string را کنار می‌گذاریم.
    const pathname = (req.originalUrl || req.url || '').split('?')[0];
    if (pathname === '/' || pathname.endsWith('.html')) {
      res.setHeader('Content-Security-Policy', csp);
    }

    next();
  };
}
