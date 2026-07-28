import { describe, it, expect } from 'vitest';
import type { BusinessHours } from '@mira/shared-types';
import { isWithinBusinessHours } from '../../apps/api/src/common/business-hours/business-hours.util';

// ساعت کاری همیشه به وقت **تهران** ارزیابی می‌شود، نه UTC سرور. تست‌ها لحظه‌ها را در UTC
// می‌سازند و انتظار را بر اساس تبدیل به تهران (UTC+03:30) می‌گذارند، تا اگر کسی روزی
// منطقه‌زمانی را حذف کند این تست‌ها بشکنند.
function hours(partial: Partial<BusinessHours['days']>): BusinessHours {
  const closed = { enabled: false, start: '09:00', end: '17:00' };
  return {
    days: {
      sat: closed,
      sun: closed,
      mon: closed,
      tue: closed,
      wed: closed,
      thu: closed,
      fri: closed,
      ...partial,
    },
  } as BusinessHours;
}

describe('isWithinBusinessHours', () => {
  it('بدون تنظیم ساعت کاری، سایت همیشه باز است', () => {
    expect(isWithinBusinessHours(null)).toBe(true);
    expect(isWithinBusinessHours(undefined)).toBe(true);
  });

  it('روز غیرفعال همیشه بسته است', () => {
    // ۲۰۲۶-۰۷-۲۷ دوشنبه است؛ ۱۰:۰۰ UTC = ۱۳:۳۰ تهران
    const monday10Utc = new Date('2026-07-27T10:00:00Z');
    expect(isWithinBusinessHours(hours({}), monday10Utc)).toBe(false);
  });

  it('داخل بازه‌ی روز فعال باز است', () => {
    const monday10Utc = new Date('2026-07-27T10:00:00Z'); // ۱۳:۳۰ تهران
    const config = hours({ mon: { enabled: true, start: '09:00', end: '17:00' } });
    expect(isWithinBusinessHours(config, monday10Utc)).toBe(true);
  });

  it('پیش از شروع بازه بسته است', () => {
    const monday04Utc = new Date('2026-07-27T04:00:00Z'); // ۰۷:۳۰ تهران
    const config = hours({ mon: { enabled: true, start: '09:00', end: '17:00' } });
    expect(isWithinBusinessHours(config, monday04Utc)).toBe(false);
  });

  it('بعد از پایان بازه بسته است', () => {
    const monday15Utc = new Date('2026-07-27T15:00:00Z'); // ۱۸:۳۰ تهران
    const config = hours({ mon: { enabled: true, start: '09:00', end: '17:00' } });
    expect(isWithinBusinessHours(config, monday15Utc)).toBe(false);
  });

  it('انتهای بازه انحصاری است (end شامل نمی‌شود)', () => {
    const monday1330Utc = new Date('2026-07-27T13:30:00Z'); // دقیقاً ۱۷:۰۰ تهران
    const config = hours({ mon: { enabled: true, start: '09:00', end: '17:00' } });
    expect(isWithinBusinessHours(config, monday1330Utc)).toBe(false);
  });

  it('ابتدای بازه شامل است (start در محدوده است)', () => {
    const monday0530Utc = new Date('2026-07-27T05:30:00Z'); // دقیقاً ۰۹:۰۰ تهران
    const config = hours({ mon: { enabled: true, start: '09:00', end: '17:00' } });
    expect(isWithinBusinessHours(config, monday0530Utc)).toBe(true);
  });

  it('بر اساس وقت تهران تصمیم می‌گیرد، نه UTC — نزدیک نیمه‌شب روز عوض می‌شود', () => {
    // ۲۰۲۶-۰۷-۲۷T۲۱:۰۰Z = سه‌شنبه ۰۰:۳۰ به وقت تهران، نه دوشنبه
    const lateUtc = new Date('2026-07-27T21:00:00Z');
    const monOpen = hours({ mon: { enabled: true, start: '00:00', end: '23:59' } });
    const tueOpen = hours({ tue: { enabled: true, start: '00:00', end: '23:59' } });
    expect(isWithinBusinessHours(monOpen, lateUtc)).toBe(false);
    expect(isWithinBusinessHours(tueOpen, lateUtc)).toBe(true);
  });
});
