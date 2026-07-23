// اعتبارسنجی حداقلی متغیرهای محیطی الزامی هنگام بالا آمدن سرویس
// اگر یکی از این‌ها ست نشده باشه، سرویس عمداً بالا نمی‌آد (fail-fast به‌جای رفتار نامشخص بعداً)
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'REDIS_HOST',
  'REDIS_PORT',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'WIDGET_TOKEN_SECRET',
] as const;

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED_ENV_VARS.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`متغیرهای محیطی الزامی تنظیم نشده‌اند: ${missing.join(', ')}`);
  }
  return config;
}
