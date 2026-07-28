import { describe, it, expect } from 'vitest';
import { parseUserAgent } from '../../apps/api/src/common/user-agent/parse-user-agent.util';

// این تابع فقط برای نمایش «مرورگر/سیستم» در پنل اطلاعات بازدیدکننده است، ولی روی هر
// درخواست اجرا می‌شود — پس هرگز نباید روی ورودی غیرمنتظره throw کند.
describe('parseUserAgent', () => {
  it('ورودی null همه‌چیز را null می‌دهد', () => {
    expect(parseUserAgent(null)).toEqual({ browser: null, os: null, deviceType: null });
  });

  it('رشته‌ی خالی هم امن است (بدون throw)', () => {
    expect(() => parseUserAgent('')).not.toThrow();
    expect(parseUserAgent('')).toEqual({ browser: null, os: null, deviceType: null });
  });

  it('کروم روی ویندوز را می‌شناسد', () => {
    const result = parseUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
    expect(result.browser).toContain('Chrome');
    expect(result.os).toContain('Windows');
    expect(result.deviceType).toBe('desktop');
  });

  it('سافاری روی آیفون را موبایل تشخیص می‌دهد', () => {
    const result = parseUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    );
    expect(result.browser).toContain('Safari');
    expect(result.os).toContain('iOS');
    expect(result.deviceType).toBe('mobile');
  });

  it('وقتی نوع دستگاه تشخیص داده نشود، پیش‌فرض desktop است', () => {
    const result = parseUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
    expect(result.deviceType).toBe('desktop');
  });

  it('رشته‌ی بی‌معنی throw نمی‌کند', () => {
    expect(() => parseUserAgent('!!! not a user agent !!!')).not.toThrow();
  });
});
