import { defineConfig } from 'vitest/config';

// تست‌ها دو دسته‌اند و عمداً از هم جدا نگه داشته می‌شوند:
//   tests/unit/        منطق خالص — بدون دیتابیس/شبکه، همه‌جا و همیشه اجرا می‌شود
//   tests/integration/ نیازمند Postgres و Redis واقعی (قاعده‌ی ۸: با سرویس واقعی تست کن،
//                      نه با ماک). در CI با service containerها اجرا می‌شود؛ اگر
//                      DATABASE_URL ست نباشد، فایل‌هایش خودشان را skip می‌کنند.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // ماژول‌های workspace از خروجی build خوانده می‌شوند، پس ترتیب اجرا اهمیتی ندارد
    pool: 'forks',
    testTimeout: 20_000,
  },
});
