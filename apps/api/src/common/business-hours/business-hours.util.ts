import { BusinessHours, Weekday } from '@mira/shared-types';

const WEEKDAY_MAP: Record<string, Weekday> = {
  Sat: 'sat',
  Sun: 'sun',
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
};

// روز هفته و دقیقه‌ی سپری‌شده از نیمه‌شب رو به وقت تهران (نه UTC سرور) استخراج می‌کنه —
// چون تصمیم «داخل ساعت کاری هستیم یا نه» باید بر اساس منطقه‌زمانی کسب‌وکار گرفته بشه
function getTehranWeekdayAndMinutes(date: Date): { weekday: Weekday; minutesSinceMidnight: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const weekdayValue = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const hourValue = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minuteValue = parts.find((p) => p.type === 'minute')?.value ?? '00';

  const weekday = WEEKDAY_MAP[weekdayValue] ?? 'sun';
  const hour = parseInt(hourValue, 10) % 24; // برخی پیاده‌سازی‌های Intl نیمه‌شب رو "24" برمی‌گردونن
  const minutesSinceMidnight = hour * 60 + parseInt(minuteValue, 10);

  return { weekday, minutesSinceMidnight };
}

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map((value) => parseInt(value, 10));
  return hours * 60 + minutes;
}

// اگه ساعت کاری تنظیم نشده باشه، سایت همیشه آنلاین در نظر گرفته می‌شه (رفتار پیش‌فرض فاز ۱)
export function isWithinBusinessHours(
  businessHours: BusinessHours | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!businessHours) return true;

  const { weekday, minutesSinceMidnight } = getTehranWeekdayAndMinutes(now);
  const day = businessHours.days?.[weekday];
  if (!day || !day.enabled) return false;

  const start = parseTimeToMinutes(day.start);
  const end = parseTimeToMinutes(day.end);
  return minutesSinceMidnight >= start && minutesSinceMidnight < end;
}
