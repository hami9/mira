import { describe, it, expect } from 'vitest';
import { createSecurityHeadersMiddleware } from '../../apps/api/src/common/security/security-headers.middleware';

// این فایل نگهبان دو باگ واقعی بخش ۶ AGENTS.md است:
//
//  باگ ۵ — فایل‌های استاتیک (صفحه‌ی دمو ویجت) از زنجیره‌ی middleware نست عبور نمی‌کردند و
//          بدون هیچ هدر امنیتی سرو می‌شدند و `X-Powered-By` را لو می‌دادند.
//  باگ ۶ — ‏CSP روی پاسخ‌های JSON ست می‌شد ولی روی HTML نه، چون middleware به‌جای
//          `req.originalUrl` از `req.path` می‌خواند.
//
// چون این یک factory خالص است، بدون بوت NestJS و بدون دیتابیس قابل تست است.

type Handler = ReturnType<typeof createSecurityHeadersMiddleware>;

/** یک جفت req/res ساختگی که فقط همان چیزی را دارد که middleware لمس می‌کند. */
function run(handler: Handler, originalUrl: string) {
  const headers: Record<string, string> = {};
  let nextCalled = false;

  const req = { originalUrl, url: originalUrl } as never;
  const res = {
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    removeHeader(name: string) {
      delete headers[name];
    },
  } as never;

  // X-Powered-By را از قبل ست می‌کنیم تا حذف شدنش قابل اثبات باشد
  (res as unknown as { setHeader(n: string, v: string): void }).setHeader(
    'X-Powered-By',
    'Express',
  );

  handler(req, res, () => {
    nextCalled = true;
  });

  return { headers, nextCalled };
}

const dev = () =>
  createSecurityHeadersMiddleware({ publicApiUrl: 'http://localhost:3000', isProduction: false });
const prod = () =>
  createSecurityHeadersMiddleware({ publicApiUrl: 'https://chat.example.com', isProduction: true });

describe('security headers', () => {
  it('همیشه next را صدا می‌زند — نباید زنجیره را قطع کند', () => {
    expect(run(dev(), '/v1/conversations').nextCalled).toBe(true);
  });

  it('هدرهای پایه روی هر پاسخی ست می‌شوند', () => {
    const { headers } = run(dev(), '/v1/conversations');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(headers['Permissions-Policy']).toContain('camera=()');
  });

  it('X-Powered-By حذف می‌شود — باگ واقعی ۵', () => {
    expect(run(dev(), '/demo.html').headers['X-Powered-By']).toBeUndefined();
    expect(run(dev(), '/v1/conversations').headers['X-Powered-By']).toBeUndefined();
  });
});

describe('CSP is applied to HTML and only HTML — real bug #6', () => {
  it('صفحه‌ی HTML هدر CSP می‌گیرد', () => {
    expect(run(dev(), '/demo.html').headers['Content-Security-Policy']).toBeDefined();
  });

  it('ریشه‌ی سایت هم HTML حساب می‌شود', () => {
    expect(run(dev(), '/').headers['Content-Security-Policy']).toBeDefined();
  });

  it('پاسخ JSON هدر CSP نمی‌گیرد — نیمه‌ی دیگر باگ ۶', () => {
    expect(run(dev(), '/v1/conversations').headers['Content-Security-Policy']).toBeUndefined();
    expect(run(dev(), '/health').headers['Content-Security-Policy']).toBeUndefined();
  });

  it('query string جلوی تشخیص HTML را نمی‌گیرد — ریشه‌ی دقیق باگ ۶', () => {
    // با `req.path` این کار می‌کرد ولی در مسیرهای mount‌شده اشتباه بود؛ با `originalUrl`
    // باید query string دستی کنار گذاشته شود، وگرنه `.html` انتهای رشته نیست
    expect(run(dev(), '/demo.html?utm=x').headers['Content-Security-Policy']).toBeDefined();
    expect(run(dev(), '/?ref=y').headers['Content-Security-Policy']).toBeDefined();
  });

  it('فایل استاتیک غیر HTML مثل خود ویجت CSP نمی‌گیرد', () => {
    expect(run(dev(), '/widget-dist/widget.js').headers['Content-Security-Policy']).toBeUndefined();
  });

  it('CSP دامنه‌ی API را در connect-src دارد — هم http و هم ws', () => {
    const csp = run(prod(), '/demo.html').headers['Content-Security-Policy'];
    expect(csp).toContain('https://chat.example.com');
    expect(csp).toContain('wss://chat.example.com');
  });

  it('CSP اسکریپت درون‌خطی را مجاز نمی‌کند', () => {
    const csp = run(dev(), '/demo.html').headers['Content-Security-Policy'];
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });
});

describe('HSTS', () => {
  it('در production ست می‌شود', () => {
    expect(run(prod(), '/demo.html').headers['Strict-Transport-Security']).toContain('max-age=');
  });

  it('در توسعه ست نمی‌شود — روی http مرورگر را گیر می‌اندازد', () => {
    expect(run(dev(), '/demo.html').headers['Strict-Transport-Security']).toBeUndefined();
  });
});
