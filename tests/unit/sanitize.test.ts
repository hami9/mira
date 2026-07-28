import { describe, it, expect } from 'vitest';
import { sanitizeMessageContent } from '../../apps/api/src/common/sanitize/sanitize-message.util';

// `sanitizeMessageContent` تنها نقطه‌ی ورودی پاکسازی در کل پروژه است (قاعده‌ی ۵).
// اگر این تابع نشتی بدهد، XSS ذخیره‌شده مستقیم در داشبورد اپراتور اجرا می‌شود.
describe('sanitizeMessageContent', () => {
  it('تگ script را کامل حذف می‌کند', () => {
    const result = sanitizeMessageContent('<script>alert("xss")</script>');
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert(');
  });

  it('هندلر رویداد روی تگ را حذف می‌کند', () => {
    const result = sanitizeMessageContent('<img src=x onerror="alert(1)">');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('<img');
  });

  it('لینک javascript: را باقی نمی‌گذارد', () => {
    const result = sanitizeMessageContent('<a href="javascript:alert(1)">click</a>');
    expect(result).not.toContain('<a');
    expect(result).not.toContain('href');
  });

  it('همه‌ی تگ‌های HTML حذف می‌شوند ولی متن قابل خواندن می‌ماند', () => {
    expect(sanitizeMessageContent('<b>سلام</b> <i>دنیا</i>')).toBe('سلام دنیا');
  });

  it('متن فارسی معمولی دست‌نخورده می‌ماند', () => {
    const text = 'سلام، سفارش شماره ۱۲۳۴ من کی ارسال می‌شود؟';
    expect(sanitizeMessageContent(text)).toBe(text);
  });

  it('ایموجی حفظ می‌شود', () => {
    expect(sanitizeMessageContent('ممنون 🙏')).toBe('ممنون 🙏');
  });

  it('فاصله‌ی ابتدا و انتها trim می‌شود', () => {
    expect(sanitizeMessageContent('   سلام   ')).toBe('سلام');
  });

  it('طول خروجی به ۸۰۰۰ کاراکتر محدود می‌شود', () => {
    const result = sanitizeMessageContent('ا'.repeat(9000));
    expect(result).toHaveLength(8000);
  });

  it('رشته‌ی خالی امن است', () => {
    expect(sanitizeMessageContent('')).toBe('');
    expect(sanitizeMessageContent('    ')).toBe('');
  });
});
