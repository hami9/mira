import { describe, it, expect } from 'vitest';
import {
  splitKeywords,
  containsUrgentKeywords,
  containsHumanRequestKeywords,
} from '@mira/shared-types';

// این فایل مستقیماً از باگ واقعی ۲ (بخش ۶ AGENTS.md) محافظت می‌کند:
// جداکننده فقط `,` انگلیسی را می‌شناخت در حالی که placeholder خود UI به کاربر می‌گفت
// با «،» فارسی بنویسد — یعنی عملاً هیچ قانون اتوماسیونی هرگز match نمی‌شد.
describe('splitKeywords', () => {
  it('کامای انگلیسی را جدا می‌کند', () => {
    expect(splitKeywords('refund,shipping,delay')).toEqual(['refund', 'shipping', 'delay']);
  });

  it('کامای فارسی «،» را هم جدا می‌کند — همان باگ واقعی ۲', () => {
    expect(splitKeywords('مرجوعی،ارسال،تاخیر')).toEqual(['مرجوعی', 'ارسال', 'تاخیر']);
  });

  it('ترکیب هر دو کاما در یک رشته', () => {
    expect(splitKeywords('refund،ارسال,delay')).toEqual(['refund', 'ارسال', 'delay']);
  });

  it('فاصله‌های اضافی را trim می‌کند', () => {
    expect(splitKeywords('  refund ,  ارسال  ')).toEqual(['refund', 'ارسال']);
  });

  it('به حروف کوچک نرمال می‌کند تا تطبیق بی‌تفاوت به بزرگی حروف باشد', () => {
    expect(splitKeywords('REFUND,Shipping')).toEqual(['refund', 'shipping']);
  });

  it('بخش‌های خالی را دور می‌ریزد', () => {
    expect(splitKeywords('refund,,،  ,shipping')).toEqual(['refund', 'shipping']);
  });

  it('رشته‌ی خالی آرایه‌ی خالی می‌دهد، نه [""]', () => {
    expect(splitKeywords('')).toEqual([]);
    expect(splitKeywords('   ')).toEqual([]);
  });

  it('یک کلیدواژه‌ی تنها بدون جداکننده', () => {
    expect(splitKeywords('مرجوعی')).toEqual(['مرجوعی']);
  });
});

describe('containsUrgentKeywords', () => {
  it('کلیدواژه‌ی فوریت فارسی را می‌گیرد', () => {
    expect(containsUrgentKeywords('این خیلی فوری است لطفا رسیدگی کنید')).toBe(true);
    expect(containsUrgentKeywords('میخوام شکایت کنم')).toBe(true);
  });

  it('کلیدواژه‌ی فوریت انگلیسی را می‌گیرد و به بزرگی حروف حساس نیست', () => {
    expect(containsUrgentKeywords('This is URGENT')).toBe(true);
    expect(containsUrgentKeywords('i am Furious about this')).toBe(true);
  });

  it('پیام عادی را فوری تشخیص نمی‌دهد', () => {
    expect(containsUrgentKeywords('سلام، سفارش من کی می‌رسد؟')).toBe(false);
    expect(containsUrgentKeywords('hello, when does my order arrive?')).toBe(false);
  });

  it('رشته‌ی خالی', () => {
    expect(containsUrgentKeywords('')).toBe(false);
  });
});

describe('containsHumanRequestKeywords', () => {
  it('درخواست اپراتور انسانی به فارسی', () => {
    expect(containsHumanRequestKeywords('میخوام با یک اپراتور صحبت کنم')).toBe(true);
    expect(containsHumanRequestKeywords('لطفا وصل کنید به کارشناس')).toBe(true);
  });

  it('درخواست اپراتور انسانی به انگلیسی', () => {
    expect(containsHumanRequestKeywords('can I talk to a human please')).toBe(true);
    expect(containsHumanRequestKeywords('Real Person now')).toBe(true);
  });

  it('سوال معمولی درخواست انسان نیست', () => {
    expect(containsHumanRequestKeywords('قیمت این محصول چند است؟')).toBe(false);
  });
});
